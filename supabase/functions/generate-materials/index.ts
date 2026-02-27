import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

function validateReadingMaterial(
  html: string,
  bibliographyIds: string[],
  subject: string
): { valid: boolean; reasons: string[] } {
  const reasons: string[] = [];

  // Lists forbidden
  if (/<ul[\s>]/i.test(html) || /<ol[\s>]/i.test(html) || /<li[\s>]/i.test(html)) {
    reasons.push("Contiene listas HTML prohibidas");
  }
  if (/^\d+\./m.test(stripHtml(html))) {
    reasons.push("Contiene listas numeradas en texto");
  }

  // Math resolution forbidden
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

  // Social sciences closure forbidden
  const subjectLower = subject.toLowerCase();
  if (
    subjectLower.includes("social") ||
    subjectLower.includes("historia") ||
    subjectLower.includes("geografía") ||
    subjectLower.includes("ciudadan")
  ) {
    const paragraphs = html.split(/<\/p>/i).filter((p) => p.trim().length > 0);
    if (paragraphs.length > 0) {
      const lastParagraph = stripHtml(paragraphs[paragraphs.length - 1]).toLowerCase();
      const closurePhrases = ["en conclusión", "por lo tanto", "en definitiva"];
      for (const phrase of closurePhrases) {
        if (lastParagraph.includes(phrase)) {
          reasons.push(`Cierre prohibido en Sociales: "${phrase}"`);
        }
      }
    }
  }

  // Word count 1000-1300
  const words = countWords(stripHtml(html));
  if (words < 1000 || words > 1300) {
    reasons.push(`Conteo de palabras fuera de rango: ${words} (debe ser 1000-1300)`);
  }

  // data-ref tags
  for (const nodeId of bibliographyIds) {
    const regex = new RegExp(`data-ref=["']${nodeId}["']`, "i");
    if (!regex.test(html)) {
      reasons.push(`Falta tag data-ref para nodo ${nodeId}`);
    }
  }

  return { valid: reasons.length === 0, reasons };
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

  const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(
    authHeader.replace("Bearer ", "")
  );
  if (claimsError || !claimsData?.claims) {
    return new Response(JSON.stringify({ error: "No autorizado" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const userId = claimsData.claims.sub as string;

  // Admin client for updates
  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  let lessonId: string;
  try {
    const body = await req.json();
    lessonId = body.lesson_id;
    if (!lessonId) throw new Error("lesson_id requerido");
  } catch {
    return new Response(JSON.stringify({ error: "Body inválido, se requiere lesson_id" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // ── 1. Validate preconditions ──

    // Get lesson
    const { data: lesson, error: lessonErr } = await userClient
      .from("lessons")
      .select("*, course_id, plan_lesson_id, status, is_generating, lesson_number")
      .eq("id", lessonId)
      .single();
    if (lessonErr || !lesson) {
      return new Response(JSON.stringify({ error: "Lección no encontrada" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (lesson.is_generating) {
      return new Response(JSON.stringify({ error: "Ya se está generando material para esta lección" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (lesson.status === "LOCKED") {
      return new Response(JSON.stringify({ error: "La lección está bloqueada" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get course
    const { data: course } = await userClient
      .from("courses")
      .select("status, subject")
      .eq("id", lesson.course_id)
      .single();
    if (!course || course.status !== "ACTIVE") {
      return new Response(JSON.stringify({ error: "El curso no está activo" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get plan
    const { data: plan } = await userClient
      .from("plans")
      .select("status")
      .eq("course_id", lesson.course_id)
      .single();
    if (!plan || plan.status !== "VALIDATED") {
      return new Response(JSON.stringify({ error: "El plan no está validado" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get plan_lesson
    const { data: planLesson } = await userClient
      .from("plan_lessons")
      .select("theme, justification, learning_outcome")
      .eq("id", lesson.plan_lesson_id)
      .single();
    if (!planLesson) {
      return new Response(JSON.stringify({ error: "Plan lesson no encontrado" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!planLesson.theme || !planLesson.justification || !planLesson.learning_outcome) {
      return new Response(
        JSON.stringify({ error: "El plan lesson debe tener tema, justificación y resultado de aprendizaje" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get brief
    const { data: brief } = await userClient
      .from("lesson_briefs")
      .select("*")
      .eq("lesson_id", lessonId)
      .single();
    if (!brief || brief.status !== "READY_FOR_PRODUCTION") {
      return new Response(
        JSON.stringify({ error: "El relevamiento debe estar confirmado (READY_FOR_PRODUCTION)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (!brief.bibliografia_confirmada || brief.bibliografia_confirmada.length === 0) {
      return new Response(JSON.stringify({ error: "Debe confirmar al menos una fuente bibliográfica" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── 2. Set concurrency lock ──
    await adminClient.from("lessons").update({ is_generating: true }).eq("id", lessonId);

    // ── 3. Get curriculum context ──
    const { data: nodes } = await adminClient
      .from("curriculum_nodes")
      .select("id, name, node_type")
      .in("id", brief.bibliografia_confirmada);

    const curriculumContext = (nodes || [])
      .map((n: any) => `[${n.node_type}] ${n.name}`)
      .join("\n");

    const bibliographyIds = (nodes || []).map((n: any) => n.id);

    // ── 4. Generate TeachingMaterial ──
    const teachingSystemPrompt = `Sos un experto en diseño de secuencias didácticas para nivel secundario en Argentina.
Generá un material didáctico completo para una clase.

CONTEXTO:
- Materia: ${course.subject}
- Tema: ${planLesson.theme}
- Justificación: ${planLesson.justification}
- Resultado de aprendizaje esperado: ${planLesson.learning_outcome}
- Enfoque deseado: ${brief.enfoque_deseado || "No especificado"}
- Dinámica sugerida: ${brief.tipo_dinamica_sugerida || "No especificada"}
- Nivel de profundidad: ${brief.nivel_profundidad}
- Observaciones del docente: ${brief.observaciones_docente || "Ninguna"}

CONTENIDOS CURRICULARES:
${curriculumContext}

CANON OBLIGATORIO - Debe incluir todas estas secciones:
1. Propósito: alineado con el learning_outcome
2. Actividad inicial: para activar conocimientos previos
3. Desarrollo secuenciado: con tiempos reales (45 o 90 minutos)
4. Producto esperado: lo que el alumno debe producir
5. 1-3 criterios de logro: observables y medibles
6. Diferenciación: al menos un apoyo y un desafío
7. Cierre: reflexión o metacognición (en Sociales, NO usar "En conclusión", "Por lo tanto", "En definitiva")`;

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

    // Upsert teaching material
    await adminClient.from("teaching_materials").upsert(
      {
        lesson_id: lessonId,
        purpose: teachingArgs.purpose,
        activities: teachingArgs.activities,
        expected_product: teachingArgs.expected_product,
        achievement_criteria: teachingArgs.achievement_criteria,
        differentiation: teachingArgs.differentiation,
        closure: teachingArgs.closure,
        status: "GENERATED",
      },
      { onConflict: "lesson_id" }
    );

    // ── 5. Generate ReadingMaterial (with retries) ──
    const readingSystemPrompt = `Sos un redactor académico experto para nivel secundario en Argentina.
Escribí un texto de lectura para alumnos sobre el tema indicado.

CONTEXTO:
- Materia: ${course.subject}
- Tema: ${planLesson.theme}
- Nivel de profundidad: ${brief.nivel_profundidad}

CONTENIDOS CURRICULARES A REFERENCIAR:
${(nodes || []).map((n: any) => `- ${n.name} (ID: ${n.id})`).join("\n")}

REGLAS OBLIGATORIAS:
1. Exactamente entre 1000 y 1300 palabras (contando solo texto visible).
2. Texto corrido en párrafos. NO usar subtítulos. NO usar listas. NO usar viñetas.
3. NO incluir consignas ni preguntas al alumno.
4. NO incluir meta-explicaciones ("en este texto vamos a...").
5. Para cada contenido curricular referenciado, incluir al menos un tag invisible: <span data-ref="ID_DEL_NODO"></span> en algún punto relevante del texto.
6. ${course.subject.toLowerCase().includes("social") || course.subject.toLowerCase().includes("historia") ? "En el último párrafo NO usar 'En conclusión', 'Por lo tanto', 'En definitiva'." : ""}
7. ${course.subject.toLowerCase().includes("matemática") ? "NO resolver ejercicios. NO mostrar soluciones numéricas." : ""}
8. Devolver el texto como HTML válido con tags <p> para cada párrafo.
9. Los tags <span data-ref="..."></span> deben estar DENTRO de los párrafos, como elementos inline invisibles.`;

    let readingHtml = "";
    let readingValid = false;
    let attempts = 0;
    const maxAttempts = 3;
    let lastReasons: string[] = [];

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
      readingValid = validation.valid;
      lastReasons = validation.reasons;
    }

    const wordCount = countWords(stripHtml(readingHtml));
    const readingStatus = readingValid ? "GENERATED" : "INVALIDATED";

    await adminClient.from("reading_materials").upsert(
      {
        lesson_id: lessonId,
        word_count: wordCount,
        content_html: readingHtml,
        status: readingStatus,
      },
      { onConflict: "lesson_id" }
    );

    // ── 6. PDF generation (store HTML, PDF can be generated client-side) ──
    // For now we skip server-side PDF and store the HTML. PDF URL left null.

    // ── 7. Finalize ──
    await adminClient.from("lessons").update({ is_generating: false }).eq("id", lessonId);
    await adminClient
      .from("lesson_briefs")
      .update({ status: "PRODUCED" })
      .eq("lesson_id", lessonId);

    return new Response(
      JSON.stringify({
        success: true,
        teaching_status: "GENERATED",
        reading_status: readingStatus,
        reading_word_count: wordCount,
        reading_validation_issues: readingValid ? [] : lastReasons,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    // Always reset is_generating on error
    await adminClient.from("lessons").update({ is_generating: false }).eq("id", lessonId);

    console.error("generate-materials error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Error desconocido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
