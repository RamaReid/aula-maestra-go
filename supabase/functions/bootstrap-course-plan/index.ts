import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type LessonDraft = {
  lesson_number: number;
  theme: string;
  justification: string;
  learning_outcome: string;
  activities_summary: string;
};

type BootstrapPayload = {
  fundamentacion: string;
  estrategias_marco: string;
  estrategias_practicas: string[];
  evaluacion_marco: string;
  resources: string;
  objectives: string[];
  lessons: LessonDraft[];
};

async function callAI(apiKey: string, messages: Array<{ role: string; content: string }>) {
  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-pro",
      messages,
      response_format: { type: "json_object" },
    }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`AI gateway error ${resp.status}: ${text}`);
  }

  return await resp.json();
}

function fallbackObjectives(subject: string): string[] {
  return [
    `Comprenderan los ejes centrales de ${subject} y su relacion con problemas del curso.`,
    `Desarrollaran producciones breves con vocabulario disciplinar y criterios explicitos.`,
    `Relacionaran conceptos de la materia con situaciones y practicas del contexto escolar.`,
    `Mejoraran sus argumentos, registros y explicaciones a partir de evidencia y revision.`,
    `Usaran fuentes del curso de forma responsable, clara y trazable.`,
    `Participaran en instancias de analisis, intercambio y evaluacion formativa durante el ano.`,
  ];
}

function fallbackBootstrap(subject: string, nodeNames: string[], lessonCount: number): BootstrapPayload {
  const baseTopics = nodeNames.length > 0 ? nodeNames : [subject];

  return {
    fundamentacion:
      `La planificacion de ${subject} se organiza a partir del diseno curricular oficial y busca ofrecer una progresion clara, situada y editable para el trabajo docente. ` +
      `Su punto de partida es la seleccion de contenidos y problemas relevantes del programa, traducidos a una secuencia anual que permita sostener continuidad, gradualidad y evidencia de avance clase a clase. ` +
      `La propuesta no busca reemplazar la decision pedagogica del docente, sino ofrecer una base seria de trabajo para que la adaptacion posterior tenga ya un orden curricular explicito y una organizacion interna coherente.` +
      `\n\n` +
      `Desde esta perspectiva, el enfoque privilegia la articulacion entre comprension conceptual, producciones breves, lectura guiada, registro de evidencias y momentos de intercambio. ` +
      `La secuencia esta pensada para que el curso avance desde la presentacion de ejes centrales hacia instancias de profundizacion, integracion y recuperacion equivalente, evitando una acumulacion desordenada de temas. ` +
      `Cada clase deja una huella de trabajo verificable mediante actividades concretas, resultados de aprendizaje observables y una relacion visible entre el contenido curricular y la tarea propuesta.` +
      `\n\n` +
      `La evaluacion se concibe como parte del recorrido anual y no solo como cierre. ` +
      `Por eso el borrador inicial contempla estrategias de seguimiento continuo, devoluciones breves, ajustes sobre la produccion y criterios explicitos de mejora. ` +
      `La intencion es que el docente pueda conservar una base comun para todo el curso y, a la vez, ajustar ritmos, materiales, agrupamientos y apoyos segun las condiciones reales de la escuela y del grupo.` +
      `\n\n` +
      `Tambien se considera una logica de trabajo low-tech, con alternativas ejecutables sin depender de conectividad constante. ` +
      `Esto permite sostener la propuesta en distintos contextos institucionales y garantizar que la planificacion siga siendo util aun cuando los recursos disponibles cambien. ` +
      `El resultado es un borrador anual consistente, apoyado en el diseno curricular y listo para ser revisado, enriquecido y validado por el docente responsable del curso.` +
      `\n\n` +
      `En terminos de organizacion anual, el borrador supone una distribucion de clases que combina instalacion de contenidos, reapropiacion, momentos de integracion y recuperaciones equivalentes. ` +
      `No pretende fijar un unico modo de trabajo, pero si ofrecer un marco inicial donde cada tramo del ano tenga sentido en relacion con el anterior y el siguiente. ` +
      `Esto ayuda al docente a partir de una secuencia ya articulada, en lugar de comenzar con campos vacios o decisiones aisladas que luego resultan dificiles de coordinar en el tiempo.` +
      `\n\n` +
      `Finalmente, la propuesta asume que la planificacion anual es un instrumento vivo. ` +
      `Por eso este borrador inicial debe leerse como una primera version profesionalmente util: suficientemente estructurada para ordenar el curso y suficientemente abierta para admitir ajustes, cambios de ritmo, reformulaciones y decisiones propias del docente segun el grupo, la institucion, el calendario y los recursos disponibles.`,
    estrategias_marco:
      "Se propone una secuencia progresiva con presentacion de problemas, trabajo guiado con textos y consignas, producciones breves con criterios explicitos, revision entre pares y cierre por evidencias minimas.",
    estrategias_practicas: [
      "Lectura guiada con consignas de comprension y explicacion.",
      "Producciones breves con criterios claros de revision.",
      "Trabajo con casos o situaciones del contexto escolar.",
    ],
    evaluacion_marco:
      "La evaluacion sera continua, formativa y basada en criterios explicitos. Se observaran comprension conceptual, calidad de las producciones, uso de evidencias, comunicacion y transferencia. Se preve una instancia de recuperacion equivalente por cuatrimestre.",
    resources:
      "Pizarron, cuaderno o carpeta, materiales impresos, textos del curso, proyector o TV segun disponibilidad y alternativa low-tech para cada actividad.",
    objectives: fallbackObjectives(subject),
    lessons: Array.from({ length: lessonCount }, (_, index) => {
      const topic = baseTopics[index % baseTopics.length];
      return {
        lesson_number: index + 1,
        theme: `${topic}`,
        justification: `La clase ${index + 1} desarrolla un recorte del diseno curricular para sostener una progresion anual clara y contextualizada.`,
        learning_outcome: `Al finalizar la clase ${index + 1}, el estudiantado podra explicar y trabajar de manera situada el eje "${topic}".`,
        activities_summary: `Apertura con recuperacion breve, desarrollo guiado sobre "${topic}", produccion de evidencia minima y cierre con puesta en comun.`,
      };
    }),
  };
}

function normalizeBootstrapPayload(
  payload: Partial<BootstrapPayload> | null | undefined,
  subject: string,
  nodeNames: string[],
  lessonCount: number
): BootstrapPayload {
  const fallback = fallbackBootstrap(subject, nodeNames, lessonCount);
  const lessons = Array.isArray(payload?.lessons) ? payload!.lessons : fallback.lessons;

  return {
    fundamentacion:
      typeof payload?.fundamentacion === "string" && payload.fundamentacion.trim().length > 0
        ? payload.fundamentacion.trim()
        : fallback.fundamentacion,
    estrategias_marco:
      typeof payload?.estrategias_marco === "string" && payload.estrategias_marco.trim().length > 0
        ? payload.estrategias_marco.trim()
        : fallback.estrategias_marco,
    estrategias_practicas:
      Array.isArray(payload?.estrategias_practicas) && payload!.estrategias_practicas.length > 0
        ? payload!.estrategias_practicas
            .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
            .slice(0, 8)
        : fallback.estrategias_practicas,
    evaluacion_marco:
      typeof payload?.evaluacion_marco === "string" && payload.evaluacion_marco.trim().length > 0
        ? payload.evaluacion_marco.trim()
        : fallback.evaluacion_marco,
    resources:
      typeof payload?.resources === "string" && payload.resources.trim().length > 0
        ? payload.resources.trim()
        : fallback.resources,
    objectives:
      Array.isArray(payload?.objectives) && payload!.objectives.length > 0
        ? payload!.objectives
            .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
            .slice(0, 8)
        : fallback.objectives,
    lessons: Array.from({ length: lessonCount }, (_, index) => {
      const candidate = lessons.find((lesson) => lesson.lesson_number === index + 1) || fallback.lessons[index];
      return {
        lesson_number: index + 1,
        theme: candidate.theme?.trim() || fallback.lessons[index].theme,
        justification: candidate.justification?.trim() || fallback.lessons[index].justification,
        learning_outcome: candidate.learning_outcome?.trim() || fallback.lessons[index].learning_outcome,
        activities_summary: candidate.activities_summary?.trim() || fallback.lessons[index].activities_summary,
      };
    }),
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const lovableApiKey = Deno.env.get("LOVABLE_API_KEY")!;

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
  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(
    authHeader.replace("Bearer ", "")
  );
  if (claimsError || !claimsData?.claims) {
    return new Response(JSON.stringify({ error: "No autorizado" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: { course_id?: string; plan_id?: string; curriculum_document_id?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Body invalido" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!body.course_id || !body.plan_id || !body.curriculum_document_id) {
    return new Response(JSON.stringify({ error: "course_id, plan_id y curriculum_document_id son obligatorios" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { data: course, error: courseError } = await userClient
      .from("courses")
      .select("id, subject, year_level, orientation, speciality, schools(official_name, school_type)")
      .eq("id", body.course_id)
      .single();
    if (courseError || !course) throw new Error("Curso no encontrado");

    const { data: plan, error: planError } = await userClient
      .from("plans")
      .select("id, course_id")
      .eq("id", body.plan_id)
      .single();
    if (planError || !plan || plan.course_id !== body.course_id) {
      throw new Error("Plan no encontrado o inconsistente con el curso");
    }

    const { data: curriculumDocument, error: curriculumError } = await adminClient
      .from("curriculum_documents")
      .select("id, subject, cycle, year_level, official_title, official_url, raw_text")
      .eq("id", body.curriculum_document_id)
      .single();
    if (curriculumError || !curriculumDocument) {
      throw new Error("Documento curricular no encontrado");
    }

    const { data: nodes, error: nodesError } = await adminClient
      .from("curriculum_nodes")
      .select("id, name, node_type, order_index")
      .eq("curriculum_document_id", body.curriculum_document_id)
      .order("order_index");
    if (nodesError) throw nodesError;

    const { data: planLessons, error: planLessonsError } = await adminClient
      .from("plan_lessons")
      .select("id, lesson_number, term")
      .eq("plan_id", body.plan_id)
      .order("lesson_number");
    if (planLessonsError || !planLessons || planLessons.length === 0) {
      throw new Error("No existen plan_lessons para bootstrapear");
    }

    const nodeNames = (nodes || []).map((node: any) => `[${node.node_type}] ${node.name}`);
    const prompt = `Sos un asistente experto en planificacion docente de secundaria.

Tu tarea es generar un BORRADOR inicial de plan anual a partir de un diseno curricular oficial ya resuelto.

Debes devolver JSON VALIDO con esta estructura exacta:
{
  "fundamentacion": string,
  "estrategias_marco": string,
  "estrategias_practicas": string[],
  "evaluacion_marco": string,
  "resources": string,
  "objectives": string[],
  "lessons": [
    {
      "lesson_number": number,
      "theme": string,
      "justification": string,
      "learning_outcome": string,
      "activities_summary": string
    }
  ]
}

Reglas:
- fundamentacion: minimo 450 palabras, en prosa y sin metacomentarios.
- objectives: entre 4 y 8 objetivos observables.
- lessons: exactamente ${planLessons.length} elementos, uno por clase.
- Cada clase debe tener tema, justificacion, resultado de aprendizaje y resumen de actividades.
- No inventes la fuente curricular. Usa el documento y los nodos provistos.
- La forma del documento debe ser administrativa y util para que el docente la edite despues.
- No pongas markdown ni bloques de codigo, solo JSON.

Contexto del curso:
- Materia: ${course.subject}
- Ano: ${course.year_level}
- Escuela: ${(course as any).schools?.official_name || "Sin escuela"}
- Tipo de escuela: ${(course as any).schools?.school_type || "No especificado"}
- Orientacion: ${course.orientation || "No especificada"}
- Especialidad: ${course.speciality || "No especificada"}

Documento curricular:
- Titulo: ${curriculumDocument.official_title || curriculumDocument.subject}
- URL oficial: ${curriculumDocument.official_url || "No registrada"}

Texto fuente disponible:
${curriculumDocument.raw_text || "No hay texto crudo cargado; usar los nodos curriculares como base principal."}

Nodos curriculares:
${nodeNames.join("\n")}`;

    let aiPayload: Partial<BootstrapPayload> | null = null;
    try {
      const aiResponse = await callAI(lovableApiKey, [{ role: "user", content: prompt }]);
      aiPayload = JSON.parse(aiResponse.choices[0].message.content || "{}");
    } catch {
      aiPayload = null;
    }

    const normalized = normalizeBootstrapPayload(
      aiPayload,
      course.subject,
      (nodes || []).map((node: any) => node.name),
      planLessons.length
    );

    await adminClient
      .from("plans")
      .update({
        fundamentacion: normalized.fundamentacion,
        estrategias_marco: normalized.estrategias_marco,
        estrategias_practicas: normalized.estrategias_practicas,
        evaluacion_marco: normalized.evaluacion_marco,
        resources: normalized.resources,
      })
      .eq("id", body.plan_id);

    await adminClient.from("plan_objectives").delete().eq("plan_id", body.plan_id);
    await adminClient.from("plan_content_mappings").delete().eq("plan_id", body.plan_id);

    const objectiveRows = normalized.objectives.map((objective, index) => ({
      plan_id: body.plan_id!,
      description: objective,
      order_index: index,
    }));
    if (objectiveRows.length > 0) {
      await adminClient.from("plan_objectives").insert(objectiveRows);
    }

    const mappingRows = (nodes || []).map((node: any, index: number) => ({
      plan_id: body.plan_id!,
      curriculum_node_id: node.id,
      order_index: index,
    }));
    let mappingIdByNodeId = new Map<string, string>();
    if (mappingRows.length > 0) {
      const { data: insertedMappings } = await adminClient
        .from("plan_content_mappings")
        .insert(mappingRows)
        .select("id, curriculum_node_id");
      mappingIdByNodeId = new Map((insertedMappings || []).map((row: any) => [row.curriculum_node_id, row.id]));
    }

    for (const lesson of normalized.lessons) {
      const flags = {
        is_integrative_evaluation: lesson.lesson_number === 13 || lesson.lesson_number === 27,
        is_recovery: lesson.lesson_number === 14 || lesson.lesson_number === 28,
      };

      await adminClient
        .from("plan_lessons")
        .update({
          theme: lesson.theme,
          justification: lesson.justification,
          learning_outcome: lesson.learning_outcome,
          activities_summary: lesson.activities_summary,
          ...flags,
        })
        .eq("plan_id", body.plan_id)
        .eq("lesson_number", lesson.lesson_number);
    }

    await adminClient
      .from("plan_lesson_content_links")
      .delete()
      .in("plan_lesson_id", planLessons.map((lesson: any) => lesson.id));

    if (nodes && nodes.length > 0 && mappingIdByNodeId.size > 0) {
      const linkRows = planLessons.flatMap((lesson: any, index: number) => {
        const firstNode = nodes[index % nodes.length];
        const secondNode = nodes[(index + 1) % nodes.length];
        const mappingIds = [firstNode, secondNode]
          .map((node: any) => mappingIdByNodeId.get(node.id))
          .filter((value, valueIndex, array): value is string => !!value && array.indexOf(value) === valueIndex);

        return mappingIds.map((mappingId) => ({
          plan_lesson_id: lesson.id,
          plan_content_mapping_id: mappingId,
        }));
      });

      if (linkRows.length > 0) {
        await adminClient.from("plan_lesson_content_links").insert(linkRows);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        objectives_count: objectiveRows.length,
        content_mappings_count: mappingRows.length,
        lessons_count: normalized.lessons.length,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Error desconocido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
