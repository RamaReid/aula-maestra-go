import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PDFDocument, StandardFonts, rgb, degrees } from "https://esm.sh/pdf-lib@1.17.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── Validation helpers ──

function cleanMarkdownArtifacts(text: string): string {
  return text.replace(/```(?:html|HTML)?\s*/gi, "").trim();
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function countWords(text: string): number {
  return text.split(/\s+/).filter((w) => w.length > 0).length;
}

function normalizeKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function isFyHctSubject(subject: string): boolean {
  return normalizeKey(subject).includes("filosofia e historia de la ciencia y la tecnologia");
}

function isFilosofiaSubject(subject: string): boolean {
  return normalizeKey(subject) === "filosofia";
}

function extractLessonCanon(
  activitiesSummary: string | null | undefined,
  fallbackTheme: string
): { operation: string; minimumEvidence: string } {
  const summary = (activitiesSummary || "").trim();
  if (!summary) {
    return {
      operation: `Desarrollo guiado sobre ${fallbackTheme}.`,
      minimumEvidence: `Produccion breve verificable alineada con ${fallbackTheme}.`,
    };
  }

  const operationMatch = summary.match(/operacion\s*:\s*([\s\S]*?)(?=evidencia minima\s*:|$)/i);
  const evidenceMatch = summary.match(/evidencia minima\s*:\s*([\s\S]*)$/i);
  const operation = (operationMatch?.[1] || summary).replace(/\s+/g, " ").trim();
  const minimumEvidence = (evidenceMatch?.[1] || `Produccion breve verificable alineada con ${fallbackTheme}.`)
    .replace(/\s+/g, " ")
    .trim();

  return { operation, minimumEvidence };
}

function formatSequenceNeighbor(
  label: string,
  lesson:
    | {
        lesson_number: number;
        theme: string | null;
        activities_summary: string | null;
      }
    | null
): string {
  if (!lesson) {
    return `${label}: no disponible.`;
  }

  const canon = extractLessonCanon(lesson.activities_summary, lesson.theme || "la secuencia");
  return `${label}: Clase ${lesson.lesson_number} - ${lesson.theme || "Sin foco"}. Operacion: ${canon.operation} Evidencia minima: ${canon.minimumEvidence}`;
}

function validateReadingMaterial(
  html: string,
  bibliographyIds: string[],
  subject: string
): { valid: boolean; reasons: string[] } {
  const reasons: string[] = [];

  if (/<ul\b/i.test(html) || /<ol\b/i.test(html) || /<li\b/i.test(html)) {
    reasons.push("Contiene listas HTML prohibidas");
  }
  if (/^\d+\./m.test(stripHtml(html))) {
    reasons.push("Contiene listas numeradas en texto");
  }
  // M-2: Validate no subtitles
  if (/<h[1-6]\b/i.test(html)) {
    reasons.push("Contiene subtítulos HTML prohibidos");
  }

  if (/=\s*\d+/.test(stripHtml(html))) {
    reasons.push("Contiene resolución matemática");
  }
  const mathPhrases = ["la solución es", "por lo tanto x =", "la respuesta es"];
  const plainText = stripHtml(html).toLowerCase();
  for (const phrase of mathPhrases) {
    if (plainText.includes(phrase)) {
      reasons.push(`Contiene frase prohibida: "${phrase}"`);
    }
  }

  const subjectLower = subject.toLowerCase();
  if (
    subjectLower.includes("social") ||
    subjectLower.includes("historia") ||
    subjectLower.includes("geografía") ||
    subjectLower.includes("ciudadan")
  ) {
    const pMatches = html.match(/<p[^>]*>([\s\S]*?)<\/p>/gi) || [];
    const paragraphs = pMatches
      .map((p) => stripHtml(p))
      .filter((t) => t.length > 0);
    if (paragraphs.length > 0) {
      const lastParagraph = paragraphs[paragraphs.length - 1].toLowerCase();
      const closurePhrases = [
        "en conclusión",
        "por lo tanto",
        "en definitiva",
        "se puede afirmar que",
        "así se demuestra que",
      ];
      for (const phrase of closurePhrases) {
        if (lastParagraph.includes(phrase)) {
          reasons.push(`Cierre prohibido en Sociales: "${phrase}"`);
        }
      }
    }
  }

  const words = countWords(stripHtml(html));
  if (words < 1000 || words > 1300) {
    reasons.push(`Conteo de palabras fuera de rango: ${words} (debe ser 1000-1300)`);
  }

  for (const nodeId of bibliographyIds) {
    const regex = new RegExp(`data-ref=["']${nodeId}["']`, "i");
    if (!regex.test(html)) {
      reasons.push(`Falta tag data-ref para nodo ${nodeId}`);
    }
  }

  return { valid: reasons.length === 0, reasons };
}

// ── PDF generation with pdf-lib ──

async function generatePdfFromHtml(html: string): Promise<{ pdfBytes: Uint8Array; pageCount: number }> {
  const cleanHtml = html.replace(/<span\s+data-ref="[^"]*"\s*><\/span>/gi, "");
  
  const pMatches = cleanHtml.match(/<p[^>]*>([\s\S]*?)<\/p>/gi) || [];
  const paragraphs = pMatches
    .map((p) => stripHtml(p))
    .filter((t) => t.length > 0);

  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const PAGE_WIDTH = 595.28;
  const PAGE_HEIGHT = 841.89;
  const MARGIN = 72;
  const FONT_SIZE = 12;
  const LINE_HEIGHT = FONT_SIZE * 1.2;
  const USABLE_WIDTH = PAGE_WIDTH - 2 * MARGIN;
  const PARAGRAPH_SPACING = LINE_HEIGHT * 0.8;

  let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let cursorY = PAGE_HEIGHT - MARGIN;

  function wrapText(text: string): string[] {
    const words = text.split(/\s+/);
    const lines: string[] = [];
    let currentLine = "";

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const testWidth = font.widthOfTextAtSize(testLine, FONT_SIZE);
      if (testWidth > USABLE_WIDTH && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) lines.push(currentLine);
    return lines;
  }

  for (const paragraph of paragraphs) {
    const lines = wrapText(paragraph);

    if (cursorY - LINE_HEIGHT < MARGIN) {
      page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      cursorY = PAGE_HEIGHT - MARGIN;
    }

    for (const line of lines) {
      if (cursorY - LINE_HEIGHT < MARGIN) {
        page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
        cursorY = PAGE_HEIGHT - MARGIN;
      }

      page.drawText(line, {
        x: MARGIN,
        y: cursorY - FONT_SIZE,
        size: FONT_SIZE,
        font,
        color: rgb(0.1, 0.1, 0.1),
      });

      cursorY -= LINE_HEIGHT;
    }

    cursorY -= PARAGRAPH_SPACING;
  }

  const pdfBytes = await pdfDoc.save();
  const pageCount = pdfDoc.getPageCount();

  return { pdfBytes: new Uint8Array(pdfBytes), pageCount };
}

// ── Watermark helper ──

async function applyWatermark(pdfDoc: PDFDocument): Promise<void> {
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const pages = pdfDoc.getPages();
  const watermarkText = "DEMO - Plan Gratuito";
  const fontSize = 48;

  for (const page of pages) {
    const { width, height } = page.getSize();
    // 3 repetitions per page
    const positions = [
      { x: width * 0.5, y: height * 0.25 },
      { x: width * 0.5, y: height * 0.5 },
      { x: width * 0.5, y: height * 0.75 },
    ];
    for (const pos of positions) {
      const textWidth = font.widthOfTextAtSize(watermarkText, fontSize);
      page.drawText(watermarkText, {
        x: pos.x - textWidth / 2,
        y: pos.y,
        size: fontSize,
        font,
        color: rgb(0.5, 0.5, 0.5),
        opacity: 0.08,
        rotate: degrees(45),
      });
    }
  }
}

// ── AI call helper ──

async function callAI(
  apiKey: string,
  model: string,
  messages: Array<{ role: string; content: string }>,
  tools?: any[],
  toolChoice?: any
): Promise<any> {
  const body: any = { model, messages };
  if (tools) body.tools = tools;
  if (toolChoice) body.tool_choice = toolChoice;

  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`AI gateway error ${resp.status}: ${text}`);
  }

  return await resp.json();
}

function isMissingCurriculumColumnError(error: { message?: string } | null | undefined): boolean {
  const message = error?.message || "";
  return message.includes("curriculum_document_id") && message.includes("courses");
}

// ── Entitlements helpers ──

function getCurrentMonday(): string {
  const now = new Date();
  const day = now.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setUTCDate(now.getUTCDate() + diff);
  return monday.toISOString().split("T")[0];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const lovableApiKey = Deno.env.get("LOVABLE_API_KEY")!;

  // Auth check
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "No autorizado" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: userData, error: userError } = await userClient.auth.getUser(
    authHeader.replace("Bearer ", "")
  );
  if (userError || !userData?.user?.id) {
    return new Response(JSON.stringify({ error: "No autorizado" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const userId = userData.user.id;

  // Admin client for updates
  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  // G-2: Support multi-lesson sessions
  let lessonIds: string[];
  let regenerateOnly: "teaching" | "reading" | undefined;
  let mode: "single" | "full_session" = "single";
  try {
    const body = await req.json();
    if (body.lesson_ids && Array.isArray(body.lesson_ids)) {
      lessonIds = body.lesson_ids;
      mode = body.mode === "full_session" ? "full_session" : "single";
    } else if (body.lesson_id) {
      lessonIds = [body.lesson_id];
    } else {
      throw new Error("lesson_id o lesson_ids requerido");
    }
    regenerateOnly = body.regenerate_only;
    if (lessonIds.length === 0) throw new Error("Al menos un lesson_id requerido");
    // G-1: max_classes_per_session limits lessons per invocation (1-3)
    if (lessonIds.length > 3) {
      return new Response(JSON.stringify({ error: "Máximo 3 lecciones por sesión" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Body inválido" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // ── 0. Entitlements gating ──

    const { data: entitlements } = await adminClient
      .from("user_entitlements")
      .select("*")
      .eq("user_id", userId)
      .single();

    const { data: usageCounter } = await adminClient
      .from("usage_counters")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (entitlements && usageCounter) {
      // Lazy weekly reset
      const currentMonday = getCurrentMonday();
      if (usageCounter.week_start_date < currentMonday) {
        await adminClient
          .from("usage_counters")
          .update({ week_start_date: currentMonday, sessions_used_this_week: 0 })
          .eq("id", usageCounter.id);
        usageCounter.sessions_used_this_week = 0;
        usageCounter.week_start_date = currentMonday;
      }

      // Validate weekly sessions
      if (usageCounter.sessions_used_this_week >= entitlements.max_weekly_sessions) {
        return new Response(
          JSON.stringify({ error: `Alcanzaste el límite de ${entitlements.max_weekly_sessions} sesiones semanales de tu plan` }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // G-1: Validate lessons count per invocation against max_classes_per_session
      if (lessonIds.length > entitlements.max_classes_per_session) {
        return new Response(
          JSON.stringify({ error: `Máximo ${entitlements.max_classes_per_session} clases por sesión en tu plan` }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // G-2: Validate all lessons belong to the same course and same user
    const allResults: any[] = [];
    let sharedCourseId: string | null = null;

    for (const lessonId of lessonIds) {
      // ── 1. Validate preconditions per lesson ──
      const { data: lesson, error: lessonErr } = await userClient
        .from("lessons")
        .select("*, course_id, plan_lesson_id, status, is_generating, lesson_number")
        .eq("id", lessonId)
        .single();
      if (lessonErr || !lesson) {
        return new Response(JSON.stringify({ error: `Lección ${lessonId} no encontrada` }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Validate same course for multi-lesson
      if (sharedCourseId === null) {
        sharedCourseId = lesson.course_id;
      } else if (lesson.course_id !== sharedCourseId) {
        return new Response(JSON.stringify({ error: "Todas las lecciones deben pertenecer al mismo curso" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (lesson.is_generating) {
        return new Response(JSON.stringify({ error: `Lección ${lessonId} ya se está generando` }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // M-3: Atomic lock
      const { data: lockResult } = await adminClient
        .from("lessons")
        .update({ is_generating: true })
        .eq("id", lessonId)
        .eq("is_generating", false)
        .select("id");

      if (!lockResult || lockResult.length === 0) {
        return new Response(JSON.stringify({ error: `Lección ${lessonId} ya se está generando` }), {
          status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (lesson.status === "LOCKED") {
        await adminClient.from("lessons").update({ is_generating: false }).eq("id", lessonId);
        return new Response(JSON.stringify({ error: `Lección ${lessonId} está bloqueada` }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      let course:
        | {
            status: string;
            subject: string;
            curriculum_document_id?: string | null;
          }
        | null = null;

      const { data: courseWithCurriculum, error: courseWithCurriculumError } = await userClient
        .from("courses")
        .select("status, subject, curriculum_document_id")
        .eq("id", lesson.course_id)
        .single();

      if (!courseWithCurriculumError && courseWithCurriculum) {
        course = courseWithCurriculum;
      } else if (isMissingCurriculumColumnError(courseWithCurriculumError)) {
        const { data: legacyCourse, error: legacyCourseError } = await userClient
          .from("courses")
          .select("status, subject")
          .eq("id", lesson.course_id)
          .single();

        if (legacyCourseError || !legacyCourse) {
          await adminClient.from("lessons").update({ is_generating: false }).eq("id", lessonId);
          return new Response(JSON.stringify({ error: "Curso no encontrado" }), {
            status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        course = { ...legacyCourse, curriculum_document_id: null };
      } else if (courseWithCurriculumError) {
        await adminClient.from("lessons").update({ is_generating: false }).eq("id", lessonId);
        return new Response(JSON.stringify({ error: courseWithCurriculumError.message }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (!course || course.status !== "ACTIVE") {
        await adminClient.from("lessons").update({ is_generating: false }).eq("id", lessonId);
        return new Response(JSON.stringify({ error: "El curso no está activo" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: plan } = await userClient
        .from("plans")
        .select("status")
        .eq("course_id", lesson.course_id)
        .single();
      if (!plan || plan.status !== "VALIDATED") {
        await adminClient.from("lessons").update({ is_generating: false }).eq("id", lessonId);
        return new Response(JSON.stringify({ error: "El plan no está validado" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: planLesson } = await userClient
        .from("plan_lessons")
        .select("id, plan_id, lesson_number, theme, justification, learning_outcome, activities_summary")
        .eq("id", lesson.plan_lesson_id)
        .single();
      if (!planLesson) {
        await adminClient.from("lessons").update({ is_generating: false }).eq("id", lessonId);
        return new Response(JSON.stringify({ error: "Plan lesson no encontrado" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (!planLesson.theme || !planLesson.justification || !planLesson.learning_outcome) {
        await adminClient.from("lessons").update({ is_generating: false }).eq("id", lessonId);
        return new Response(
          JSON.stringify({ error: "El plan lesson debe tener tema, justificación y resultado de aprendizaje" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { operation: lessonOperation, minimumEvidence } = extractLessonCanon(
        planLesson.activities_summary,
        planLesson.theme
      );

      let previousPlanLesson:
        | { lesson_number: number; theme: string | null; activities_summary: string | null }
        | null = null;
      let nextPlanLesson:
        | { lesson_number: number; theme: string | null; activities_summary: string | null }
        | null = null;

      if (planLesson.plan_id && typeof planLesson.lesson_number === "number") {
        const neighborNumbers = [planLesson.lesson_number - 1, planLesson.lesson_number + 1].filter(
          (value) => value >= 1
        );
        if (neighborNumbers.length > 0) {
          const { data: neighbors } = await userClient
            .from("plan_lessons")
            .select("lesson_number, theme, activities_summary")
            .eq("plan_id", planLesson.plan_id)
            .in("lesson_number", neighborNumbers)
            .order("lesson_number");

          previousPlanLesson =
            (neighbors || []).find((candidate: any) => candidate.lesson_number === planLesson.lesson_number - 1) ||
            null;
          nextPlanLesson =
            (neighbors || []).find((candidate: any) => candidate.lesson_number === planLesson.lesson_number + 1) ||
            null;
        }
      }

      const { data: brief } = await userClient
        .from("lesson_briefs")
        .select("*")
        .eq("lesson_id", lessonId)
        .single();
      if (!brief || (brief.status !== "READY_FOR_PRODUCTION" && brief.status !== "PRODUCED")) {
        await adminClient.from("lessons").update({ is_generating: false }).eq("id", lessonId);
        return new Response(
          JSON.stringify({ error: "El relevamiento debe estar confirmado (READY_FOR_PRODUCTION o PRODUCED)" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (!brief.bibliografia_confirmada || brief.bibliografia_confirmada.length === 0) {
        await adminClient.from("lessons").update({ is_generating: false }).eq("id", lessonId);
        return new Response(JSON.stringify({ error: "Debe confirmar al menos una fuente bibliográfica" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // ── 3. Get curriculum context ──
      const { data: nodes } = await adminClient
        .from("curriculum_nodes")
        .select("id, name, node_type")
        .in("id", brief.bibliografia_confirmada);

      const curriculumContext = (nodes || [])
        .map((n: any) => `[${n.node_type}] ${n.name}`)
        .join("\n");

      const bibliographyIds = (nodes || []).map((n: any) => n.id);
      const bibliographyContext = (nodes || [])
        .map((n: any) => `- ${n.name} [${n.node_type}] (ID: ${n.id})`)
        .join("\n");
      const disciplineCanon = isFyHctSubject(course.subject)
        ? [
            "Canon disciplinar FyHyCyT:",
            "- Trabaja filosofia de la ciencia, historia de la ciencia y tecnologia juntas.",
            "- Prioriza casos, validacion, evidencia, metodos y decisiones responsables.",
            "- No conviertas la clase en filosofia abstracta sin situacion ni en tecnica sin criterio.",
          ].join("\n")
        : isFilosofiaSubject(course.subject)
          ? [
              "Canon disciplinar Filosofia:",
              "- Trabaja problemas, conceptos, posiciones, argumentos y objeciones.",
              "- No conviertas la clase en diseno experimental ni en metodologia cientifica general.",
            ].join("\n")
          : "Canon disciplinar: mantene la clase alineada con el plan, el tiempo real y la evidencia esperada.";

      // ── 4. Generate TeachingMaterial ──
      let teachingStatus = "VALIDATED";

      if (regenerateOnly !== "reading") {
        const teachingSystemPrompt = `Sos un experto en diseño de secuencias didácticas para nivel secundario en Argentina.
Generá un material didáctico completo para una clase real dentro de una planificación anual ya definida.

CONTEXTO:
- Materia: ${course.subject}
- Clase anual: ${planLesson.lesson_number}
- Tema: ${planLesson.theme}
- Justificación: ${planLesson.justification}
- Resultado de aprendizaje esperado: ${planLesson.learning_outcome}
- Operacion canonica: ${lessonOperation}
- Evidencia minima de la clase: ${minimumEvidence}
- Enfoque deseado: ${brief.enfoque_deseado || "No especificado"}
- Dinámica sugerida: ${brief.tipo_dinamica_sugerida || "No especificada"}
- Nivel de profundidad: ${brief.nivel_profundidad}
- Observaciones del docente: ${brief.observaciones_docente || "Ninguna"}

CONTENIDOS CURRICULARES:
${curriculumContext}

CONTINUIDAD DE LA SECUENCIA:
${formatSequenceNeighbor("Entrada esperada", previousPlanLesson)}
${formatSequenceNeighbor("Salida a preparar", nextPlanLesson)}

FUENTES CONFIRMADAS PARA ESTA CLASE:
${bibliographyContext || "- Sin detalle disponible"}

${disciplineCanon}

CANON OBLIGATORIO - Debe incluir todas estas secciones:
1. Proposito: alineado con el learning_outcome y con la operacion de esta clase.
2. Actividad inicial: debe retomar la evidencia previa o activar el problema concreto de esta clase.
3. Desarrollo secuenciado: con tiempos reales y continuidad visible hacia la evidencia minima.
4. Producto esperado: debe coincidir con la evidencia minima o ser su version inmediata y verificable.
5. 1-3 criterios de logro: observables y medibles sobre el producto o evidencia.
6. Diferenciacion: al menos un apoyo y un desafio. El apoyo debe ser usable como ajuste low-tech o de accesibilidad.
7. Cierre: debe dejar lista la salida hacia la próxima clase o consolidar lo producido hoy.

REGLAS:
- No inventes otra clase distinta del plan anual.
- No generes actividades sueltas: cada bloque debe empujar al producto esperado.
- No escribas una clase genérica "sobre el tema". Es esta clase, con esta operacion y esta evidencia.
- Si la materia es de Sociales, no uses cierres formulaicos como "En conclusión", "Por lo tanto" o "En definitiva".`;

        const teachingTools = [
          {
            type: "function",
            function: {
              name: "create_teaching_material",
              description: "Crear material didáctico estructurado",
              parameters: {
                type: "object",
                properties: {
                  purpose: { type: "string", description: "Propósito de la clase" },
                  activities: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        title: { type: "string" },
                        description: { type: "string" },
                        duration_minutes: { type: "number" },
                        type: { type: "string", enum: ["inicio", "desarrollo", "cierre"] },
                      },
                      required: ["title", "description", "duration_minutes", "type"],
                    },
                  },
                  expected_product: { type: "string" },
                  achievement_criteria: {
                    type: "array",
                    items: { type: "string" },
                    minItems: 1,
                    maxItems: 3,
                  },
                  differentiation: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        type: { type: "string", enum: ["apoyo", "desafío"] },
                        description: { type: "string" },
                      },
                      required: ["type", "description"],
                    },
                  },
                  closure: { type: "string" },
                },
                required: [
                  "purpose",
                  "activities",
                  "expected_product",
                  "achievement_criteria",
                  "differentiation",
                  "closure",
                ],
                additionalProperties: false,
              },
            },
          },
        ];

        const teachingResult = await callAI(
          lovableApiKey,
          "google/gemini-2.5-flash",
          [
            { role: "system", content: teachingSystemPrompt },
            { role: "user", content: "Generá el material didáctico completo." },
          ],
          teachingTools,
          { type: "function", function: { name: "create_teaching_material" } }
        );

        const teachingArgs = JSON.parse(
          teachingResult.choices[0].message.tool_calls[0].function.arguments
        );

        // M-1: Post-AI structural validation
        const teachingValidationErrors: string[] = [];
        if (!teachingArgs.purpose || teachingArgs.purpose.trim().length === 0) {
          teachingValidationErrors.push("purpose vacío");
        }
        if (!Array.isArray(teachingArgs.activities) || teachingArgs.activities.length === 0) {
          teachingValidationErrors.push("activities vacío");
        }
        const activityTypes = Array.isArray(teachingArgs.activities)
          ? teachingArgs.activities.map((activity: any) => activity.type)
          : [];
        if (!activityTypes.includes("inicio")) {
          teachingValidationErrors.push("falta actividad de inicio");
        }
        if (!activityTypes.includes("desarrollo")) {
          teachingValidationErrors.push("falta actividad de desarrollo");
        }
        if (!activityTypes.includes("cierre")) {
          teachingValidationErrors.push("falta actividad de cierre");
        }
        if (!teachingArgs.expected_product || teachingArgs.expected_product.trim().length === 0) {
          teachingValidationErrors.push("expected_product vacío");
        }
        if (!Array.isArray(teachingArgs.achievement_criteria) || teachingArgs.achievement_criteria.length === 0) {
          teachingValidationErrors.push("achievement_criteria vacío");
        }
        if (!teachingArgs.closure || teachingArgs.closure.trim().length === 0) {
          teachingValidationErrors.push("closure vacío");
        }
        if (!Array.isArray(teachingArgs.differentiation) || teachingArgs.differentiation.length === 0) {
          teachingValidationErrors.push("differentiation vacío");
        }
        const differentiationTypes = Array.isArray(teachingArgs.differentiation)
          ? teachingArgs.differentiation.map((item: any) => item.type)
          : [];
        if (!differentiationTypes.includes("apoyo")) {
          teachingValidationErrors.push("falta apoyo");
        }
        if (!differentiationTypes.includes("desafío")) {
          teachingValidationErrors.push("falta desafío");
        }

        if (teachingValidationErrors.length > 0) {
          teachingStatus = "INVALIDATED";
          console.error("TeachingMaterial validation failed:", teachingValidationErrors);
        }

        await adminClient.from("teaching_materials").upsert(
          {
            lesson_id: lessonId,
            purpose: teachingArgs.purpose,
            activities: teachingArgs.activities,
            expected_product: teachingArgs.expected_product,
            achievement_criteria: teachingArgs.achievement_criteria,
            differentiation: teachingArgs.differentiation,
            closure: teachingArgs.closure,
            status: teachingStatus,
          },
          { onConflict: "lesson_id" }
        );

        if (regenerateOnly === "teaching") {
          await adminClient
            .from("reading_materials")
            .update({ status: "INVALIDATED" })
            .eq("lesson_id", lessonId);
        }
      }

      // ── 5. Generate ReadingMaterial ──
      let readingStatus = "VALIDATED";
      let wordCount = 0;
      let lastReasons: string[] = [];
      let pdfPageCount = 0;
      let pdfUrl: string | null = null;
      let pdfBase64: string | null = null;
      let watermarkApplied = false;

      if (regenerateOnly !== "teaching") {
        const readingSystemPrompt = `Sos un redactor académico experto para nivel secundario en Argentina.
Escribí un texto de lectura para alumnos que apoye exactamente la clase indicada dentro de una planificación anual ya definida.

CONTEXTO:
- Materia: ${course.subject}
- Clase anual: ${planLesson.lesson_number}
- Tema: ${planLesson.theme}
- Operacion canonica: ${lessonOperation}
- Evidencia minima que la lectura debe ayudar a producir: ${minimumEvidence}
- Resultado de aprendizaje esperado: ${planLesson.learning_outcome}
- Nivel de profundidad: ${brief.nivel_profundidad}

CONTINUIDAD DE LA SECUENCIA:
${formatSequenceNeighbor("Entrada esperada", previousPlanLesson)}
${formatSequenceNeighbor("Salida a preparar", nextPlanLesson)}

CONTENIDOS CURRICULARES A REFERENCIAR:
${(nodes || []).map((n: any) => `- ${n.name} (ID: ${n.id})`).join("\n")}

FUENTES CONFIRMADAS:
${bibliographyContext || "- Sin detalle disponible"}

${disciplineCanon}

REGLAS OBLIGATORIAS:
1. Exactamente entre 1000 y 1300 palabras (contando solo texto visible).
2. Texto corrido en párrafos. NO usar subtítulos. NO usar listas. NO usar viñetas.
3. NO incluir consignas ni preguntas al alumno.
4. NO incluir meta-explicaciones ("en este texto vamos a...").
5. Para cada contenido curricular referenciado, incluir al menos un tag invisible: <span data-ref="ID_DEL_NODO"></span> en algún punto relevante del texto.
6. ${course.subject.toLowerCase().includes("social") || course.subject.toLowerCase().includes("historia") ? "En el último párrafo NO usar 'En conclusión', 'Por lo tanto', 'En definitiva', 'Se puede afirmar que', 'Así se demuestra que'." : ""}
7. ${course.subject.toLowerCase().includes("matemática") ? "NO resolver ejercicios. NO mostrar soluciones numéricas." : ""}
8. Devolver el texto como HTML válido con tags <p> para cada párrafo.
9. Los tags <span data-ref="..."></span> deben estar DENTRO de los párrafos, como elementos inline invisibles.
10. El texto no debe ser una explicación genérica del tema. Debe preparar o sostener la operacion de esta clase y ayudar a producir la evidencia minima.
11. Si la materia es FyHyCyT, prioriza casos, validacion, metodos, evidencias, decisiones y relaciones ciencia-tecnologia-sociedad. No la conviertas en filosofia abstracta sin situacion.
12. Si la materia es Filosofía, prioriza problema, conceptos, posiciones, argumentos y objeciones. No la conviertas en metodologia científica.
13. Mantené trazabilidad explícita con la bibliografía confirmada y los nodos curriculares seleccionados.`;

        let readingHtml = "";
        let readingValid = false;
        let attempts = 0;
        const maxAttempts = 3;

        while (!readingValid && attempts < maxAttempts) {
          attempts++;
          const retryHint =
            attempts > 1
              ? `\n\nINTENTO ${attempts}: El texto anterior falló validación por: ${lastReasons.join(", ")}. Corregí esos problemas.`
              : "";

          const readingResult = await callAI(
            lovableApiKey,
            "google/gemini-2.5-pro",
            [
              { role: "system", content: readingSystemPrompt },
              {
                role: "user",
                content: `Escribí el texto de lectura sobre "${planLesson.theme}".${retryHint}`,
              },
            ]
          );

          readingHtml = cleanMarkdownArtifacts(readingResult.choices[0].message.content || "");

          const validation = validateReadingMaterial(readingHtml, bibliographyIds, course.subject);
          
          if (!validation.valid) {
            lastReasons = validation.reasons;
            readingValid = false;
            continue;
          }

          try {
            const { pdfBytes, pageCount } = await generatePdfFromHtml(readingHtml);
            pdfPageCount = pageCount;

            if (pageCount < 2 || pageCount > 4) {
              lastReasons = [`Conteo de páginas fuera de rango: ${pageCount} (debe ser 2-4)`];
              readingValid = false;
              continue;
            }

            let finalPdfBytes = pdfBytes;
            if (entitlements?.watermark_enabled) {
              const pdfDocForWatermark = await PDFDocument.load(pdfBytes);
              await applyWatermark(pdfDocForWatermark);
              finalPdfBytes = new Uint8Array(await pdfDocForWatermark.save());
              watermarkApplied = true;
            }

            if (entitlements?.persistent_storage_enabled === false) {
              const base64Str = btoa(String.fromCharCode(...finalPdfBytes));
              pdfBase64 = base64Str;
              pdfUrl = null;
            } else {
              const storagePath = `${lessonId}/reading-material.pdf`;
              await adminClient.storage
                .from("reading-materials-pdf")
                .upload(storagePath, finalPdfBytes, {
                  contentType: "application/pdf",
                  upsert: true,
                });

              const { data: publicUrlData } = adminClient.storage
                .from("reading-materials-pdf")
                .getPublicUrl(storagePath);

              pdfUrl = publicUrlData.publicUrl;
            }

            lastReasons = [];
            readingValid = true;
          } catch (pdfErr) {
            lastReasons = [`Error generando PDF: ${pdfErr instanceof Error ? pdfErr.message : "desconocido"}`];
            readingValid = false;
            continue;
          }
        }

        wordCount = countWords(stripHtml(readingHtml));
        readingStatus = readingValid ? "VALIDATED" : "INVALIDATED";

        await adminClient.from("reading_materials").upsert(
          {
            lesson_id: lessonId,
            word_count: wordCount,
            content_html: readingHtml,
            status: readingStatus,
            validation_reasons: readingValid ? [] : lastReasons,
            pdf_url: pdfUrl,
          },
          { onConflict: "lesson_id" }
        );
      }

      // ── 6. Finalize this lesson ──
      await adminClient.from("lessons").update({ is_generating: false }).eq("id", lessonId);

      if (regenerateOnly !== "reading") {
        await adminClient
          .from("lesson_briefs")
          .update({ status: "PRODUCED" })
          .eq("lesson_id", lessonId);
      }

      allResults.push({
        lesson_id: lessonId,
        teaching_status: regenerateOnly === "reading" ? "skipped" : teachingStatus,
        reading_status: regenerateOnly === "teaching" ? "skipped" : readingStatus,
        reading_word_count: wordCount,
        reading_pdf_pages: pdfPageCount,
        reading_pdf_url: pdfUrl,
        reading_pdf_base64: pdfBase64,
        reading_validation_issues: lastReasons,
        watermark_applied: watermarkApplied,
      });
    } // end for loop

    // G-3: Increment usage counter only ONCE per session (not per lesson)
    const anyValidated = allResults.some(
      (r) => r.reading_status === "VALIDATED" && regenerateOnly !== "teaching"
    );
    if (entitlements && usageCounter && anyValidated) {
      await adminClient
        .from("usage_counters")
        .update({ sessions_used_this_week: (usageCounter.sessions_used_this_week || 0) + 1 })
        .eq("user_id", userId);
    }

    // Return results — backward compatible for single lesson
    if (allResults.length === 1) {
      return new Response(
        JSON.stringify({ success: true, ...allResults[0] }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, mode, results: allResults }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    // Release locks for all lessons on error
    for (const lid of lessonIds) {
      await adminClient.from("lessons").update({ is_generating: false }).eq("id", lid);
    }

    console.error("generate-materials error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Error desconocido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
