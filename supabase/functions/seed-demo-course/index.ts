import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "No autorizado" }), { status: 401, headers: corsHeaders });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Get caller user_id
    const anonClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authErr } = await anonClient.auth.getUser();
    if (authErr || !user) return new Response(JSON.stringify({ error: "No autenticado" }), { status: 401, headers: corsHeaders });
    const userId = user.id;

    const db = createClient(supabaseUrl, serviceKey);

    // 1. School (upsert by name)
    const schoolName = "EESA Demo (Canon)";
    let { data: school } = await db.from("schools").select("id").eq("official_name", schoolName).maybeSingle();
    if (!school) {
      const { data: newSchool, error: sErr } = await db.from("schools").insert({
        official_name: schoolName,
        school_type: "COMUN",
        district: "Demo",
        locality: "Demo",
        user_created: true,
        created_by: userId,
      }).select("id").single();
      if (sErr) throw sErr;
      school = newSchool;
    }

    // 2. Course (find or create)
    const subject = "Filosofía e Historia de la Ciencia y la Tecnología";
    let { data: course } = await db.from("courses").select("id").eq("user_id", userId).eq("subject", subject).eq("year_level", 6).eq("school_id", school!.id).maybeSingle();
    if (!course) {
      const { data: newCourse, error: cErr } = await db.from("courses").insert({
        user_id: userId,
        school_id: school!.id,
        subject,
        year_level: 6,
        academic_year: 2026,
        status: "ACTIVE",
      }).select("id").single();
      if (cErr) throw cErr;
      course = newCourse;
    }

    // 3. Plan (find or update/create)
    const fundamentacion = `El espacio curricular Filosofía e Historia de la Ciencia y la Tecnología en 6.º año de una EESA se fundamenta en una necesidad formativa concreta: en contextos donde se toman decisiones técnicas con impacto sanitario, ambiental, productivo y social, no alcanza con ejecutar procedimientos; es necesario comprender lo que se hace, justificar elecciones y responder por sus consecuencias. En este marco, la propuesta aporta un andamiaje para pensar críticamente las prácticas del taller, sostener criterios de calidad y discutir con razones en situaciones donde hay incertidumbre, tensiones entre objetivos y dilemas éticos.

Desde esta perspectiva, la Filosofía se entiende como una práctica de pensamiento orientada a problematizar, conceptualizar y argumentar. Problematizar implica convertir lo obvio en pregunta y detectar supuestos; conceptualizar supone precisar términos y construir definiciones operativas; argumentar exige sostener conclusiones con razones, evidencia y consideración de objeciones.

La organización anual se estructura alrededor de ejes problematizadores: (1) cómo surge y para qué sirve el preguntar filosófico; (2) qué cuenta como conocimiento válido y cómo se justifica una afirmación; (3) cómo se construye, valida y cambia el conocimiento científico; y (4) cómo se evalúan decisiones tecnológicas considerando valores, riesgos e impactos.

La propuesta didáctica prioriza una alfabetización argumentativa con apoyos y una articulación estable entre teoría y práctica. La evaluación se concibe como parte del enfoque: continua, formativa y basada en criterios explícitos, atendiendo procesos y productos. El propósito final es que el estudiantado disponga de lenguaje, criterios y responsabilidad para justificar elecciones técnicas, reconocer límites de la evidencia disponible y sostener decisiones profesionales en contextos reales.`;

    const estrategias_marco = `Exposición dialogada y andamiaje con preguntas (problematizar, conceptualizar, argumentar). Lectura guiada con glosario, párrafos numerados y preguntas literal, inferencial y crítica. Trabajo con situaciones del taller como estudios de caso. Organización de la información: cuadros comparativos, redes y mapas conceptuales. Técnicas grupales (panel, mesa redonda, debate), resolución de problemas y revisión por pares.`;

    const estrategias_practicas = [
      "Exposición dialogada con preguntas",
      "Lectura guiada con glosario y consignas",
      "Trabajo con situaciones del taller como estudios de caso",
      "Organización de la información: cuadros, redes, mapas conceptuales",
      "Técnicas grupales, resolución de problemas y revisión por pares",
    ];

    const evaluacion_marco = `Evaluación continua, global y formativa, entendida como parte del proceso de aprendizaje y de la mejora de la argumentación y la toma de decisiones técnicas. Se evalúan procesos y productos con criterios explícitos, y se prevé una instancia de recuperación por cuatrimestre.

Instrumentos: producciones escritas y orales pautadas; análisis de casos; cuestionarios semiestructurados; trabajos de búsqueda con referencias completas; controles de carpeta; exposiciones orales; bitácoras y planillas de registro; dossier integrador y proyecto (C1); coevaluación y autoevaluación.

Rúbrica (criterios y niveles):
C1. Comprensión conceptual — Excelente (4): define con precisión, distingue con criterios, aplica conceptos a casos sin contradicciones. Satisfactorio (3): define y distingue en general; pequeñas imprecisiones. Básico (2): definiciones parciales; confunde categorías. Insuficiente (1): errores conceptuales persistentes.
C2. Evidencias y registro — Excelente (4): registra completo y ordenado; evidencia pertinente; fuentes claras. Satisfactorio (3): registro suficiente con vacíos menores. Básico (2): registro incompleto o desordenado. Insuficiente (1): sin registros o inválidos.
C3. Argumentación y comunicación — Excelente (4): tesis clara; razones sólidas; integra evidencia; considera objeciones. Satisfactorio (3): tesis y razones claras; objeción parcial. Básico (2): tesis débil; razones poco conectadas. Insuficiente (1): no hay argumento.
C4. Relación teoría–práctica — Excelente (4): transfiere con criterio; pondera impactos; propone mejoras. Satisfactorio (3): transfiere a casos con criterio explícito. Básico (2): transferencia limitada. Insuficiente (1): no vincula teoría con práctica.
C5. Trabajo y actitud — Excelente (4): participación sostenida; trabajo autónomo; cumple normas. Satisfactorio (3): participación regular. Básico (2): participación intermitente. Insuficiente (1): incumplimientos reiterados.

Ponderación sugerida: C1 20% · C2 20% · C3 25% · C4 25% · C5 10%.`;

    const resources = `Infraestructura y equipamiento escolar: Pizarrón y marcadores/tizas. Aula con proyector o TV y sistema básico de audio. Conectividad: acceso a Wi-Fi institucional y alternativa sin conexión. Dispositivos disponibles: PC/notebook docente; disponibilidad eventual de dispositivos del alumnado. Impresiones y fotocopias para textos, consignas y planillas de registro.

Materiales didácticos y soportes: Textos y fragmentos de lectura (impresos y/o digitales) con glosario. Guías de actividades, plantillas (Tesis–Evidencia–Razón; matrices de impacto; cuadros comparativos). Carpeta/bitácora de clase y archivador de producciones. Recursos de representación: afiches, hojas A3/A4, fibrones, notas adhesivas.

Recursos para el trabajo con casos: Planillas de registro (tiempo/temperatura, pH, Brix, trazabilidad, checklists). Registro audiovisual (fotos breves) para documentar procesos. Material del taller y normativa/protocolos internos de seguridad e inocuidad.

Aportes posibles de docentes y alumnado: Dispositivos móviles para lectura/consulta puntual y registro. Insumos simples para dinámicas (cartulinas, marcadores, cinta, impresiones). Selección de noticias, notas o materiales de divulgación vinculados a ciencia, tecnología y ética.`;

    const planFields = {
      course_id: course!.id,
      fundamentacion,
      estrategias_marco,
      estrategias_practicas,
      evaluacion_marco,
      resources,
      status: "INCOMPLETE" as const,
    };

    let { data: plan } = await db.from("plans").select("id").eq("course_id", course!.id).maybeSingle();
    if (plan) {
      await db.from("plans").update(planFields).eq("id", plan.id);
    } else {
      const { data: newPlan, error: pErr } = await db.from("plans").insert(planFields).select("id").single();
      if (pErr) throw pErr;
      plan = newPlan;
    }

    // 4. Plan objectives (delete + insert)
    await db.from("plan_objectives").delete().eq("plan_id", plan!.id);
    const objectives = [
      "Diferenciarán saber cotidiano, técnico y científico en situaciones del entorno agro y explicarán sus criterios distintivos.",
      "Identificarán ejemplos de asombro, duda y situaciones límite en su experiencia y formularán preguntas filosóficas pertinentes.",
      "Formularán problemas e hipótesis operativas; identificarán controles y evidencias pertinentes; registrarán datos con claridad.",
      "Argumentarán por escrito y de forma oral en formatos breves usando la guía Tesis–Evidencia–Razón, incluyendo al menos una objeción y respuesta.",
      "Leerán Bunge, Klimovsky, Díaz, Sztajnszrajber y vincularán sus ideas con prácticas del taller.",
      "Aplicarán métodos (inducción e hipotético-deductivo) y reconocerán el papel de la comunidad científica y la revisión de teorías.",
      "Utilizarán matrices de impactos para valorar decisiones tecnológicas y propondrán mejoras factibles.",
      "Elaborarán bitácoras quincenales y un dossier integrador con coherencia, precisión y referencias.",
    ];
    const objRows = objectives.map((d, i) => ({ plan_id: plan!.id, description: d, order_index: i }));
    const { error: objErr } = await db.from("plan_objectives").insert(objRows);
    if (objErr) throw objErr;

    // 5. Plan lessons (delete + insert 28)
    await db.from("plan_lessons").delete().eq("plan_id", plan!.id);
    const lessonsData: { theme: string; activities: string; outcome: string }[] = [
      { theme: "Concepto de Filosofía: qué es, para qué y cómo se practica", activities: "definición operativa (5-7 líneas) con ejemplo", outcome: "Comprende la Filosofía como práctica de pensamiento" },
      { theme: "Origen: asombro, duda y situaciones límite", activities: "tres situaciones del curso + pregunta que abren", outcome: "Identifica orígenes del preguntar filosófico" },
      { theme: "Del mito al logos: Sócrates, Platón, Aristóteles", activities: "cuadro comparativo mito/logos (6 ítems)", outcome: "Diferencia pensamiento mítico y racional" },
      { theme: "Ramas y problemas actuales situados (IA, bienestar animal, trazabilidad, privacidad)", activities: "mapa conceptual (rama ↔ problema ↔ pregunta)", outcome: "Relaciona ramas filosóficas con problemas actuales" },
      { theme: "Ciencia: rasgos y contrastación; clasificación de ciencias", activities: "ficha con rasgos + ejemplo por tipo", outcome: "Reconoce rasgos del conocimiento científico" },
      { theme: "Tecnología: idea e historia; impactos; criterios de decisión", activities: "párrafo de fundamentación de decisión técnica", outcome: "Fundamenta decisiones tecnológicas con criterios" },
      { theme: "Ciencia y tecnología en alimentos; normativas básicas y trazabilidad", activities: "esquema aplicado a proceso del taller", outcome: "Aplica relación ciencia-tecnología a casos alimentarios" },
      { theme: "Caso 1 (problema e hipótesis): variables y controles", activities: "problema + hipótesis (3-4 líneas) con variables/controles", outcome: "Formula problemas e hipótesis operativas" },
      { theme: "Caso 1 (controles y evidencia): indicadores y registros; Tesis–Evidencia–Razón", activities: "planilla completa + relación datos→conclusión", outcome: "Registra evidencias y construye conclusiones" },
      { theme: "Caso 1 (decisión técnica y ética): matriz de impactos; comunicación breve", activities: "matriz + texto 6-8 líneas", outcome: "Evalúa impactos y justifica decisiones técnicas" },
      { theme: "Proyecto protocolo digital: diseño (riesgos, estructura)", activities: "borrador con responsables y criterios de éxito", outcome: "Diseña protocolo con criterios explícitos" },
      { theme: "Proyecto: validación (simulación, ajustes)", activities: "versión revisada con observaciones", outcome: "Valida y mejora protocolo con retroalimentación" },
      { theme: "Cierre C1 + preparación de recuperación: auto/co-evaluación con rúbrica", activities: "autoevaluación + plan de estudio", outcome: "Se autoevalúa con criterios explícitos" },
      { theme: "Recuperación C1: actividades focalizadas", activities: "resolución de guía", outcome: "Demuestra mejora en áreas deficitarias" },
      { theme: "Lenguaje y explicación: ambigüedad/precisión + explicación técnica", activities: "reescritura + explicación clara (6-8 líneas)", outcome: "Produce textos técnicos con precisión" },
      { theme: "Razonamientos y falacias: inductivo/deductivo; corrección", activities: "identificar y corregir 2 falacias", outcome: "Identifica y corrige errores argumentativos" },
      { theme: "Mejora de informes: cohesión/coherencia; citas y referencias", activities: "versión mejorada con referencias completas", outcome: "Mejora calidad de escritura académica" },
      { theme: "Teorías y modelos: distinciones + ejemplo agro", activities: "esquema de modelo sencillo", outcome: "Distingue hipótesis, leyes, teorías y modelos" },
      { theme: "Kuhn: paradigmas y cambio", activities: "síntesis 8-10 líneas aplicada a caso breve", outcome: "Comprende cambio de paradigmas científicos" },
      { theme: "Popper: falsación; prueba crítica en papel", activities: "propuesta de prueba + predicción", outcome: "Diseña pruebas críticas para hipótesis" },
      { theme: "Caso 2 (Darwin): teoría, evidencias y análisis", activities: "tabla teoría-evidencia-conclusión + transferencia", outcome: "Analiza estructura de teoría científica" },
      { theme: "Caso 3 (Pasteur-Pouchet): argumentos pro/contra", activities: "reconstrucción en dos columnas", outcome: "Reconstruye debates científicos históricos" },
      { theme: "Métodos: inducción vs hipotético-deductivo", activities: "diagrama aplicado a ejemplo del curso", outcome: "Aplica y compara métodos científicos" },
      { theme: "Comunidad científica y revisión: pares/replicación/errores", activities: "criterios de revisión aplicados a miniinforme", outcome: "Comprende rol de la comunidad científica" },
      { theme: "Ética investigación/tecnología: riesgos, bienestar animal, ambiente", activities: "matriz de impactos + recomendación", outcome: "Evalúa dimensiones éticas de la investigación" },
      { theme: "Taller dossier integrador: estructura, fuentes, evidencias", activities: "esquema + plan de trabajo", outcome: "Planifica producción integradora con criterios" },
      { theme: "Presentación y retroalimentación: defensa breve + coevaluación", activities: "exposición 3-5 min + devolución escrita", outcome: "Defiende y evalúa producciones con criterios" },
      { theme: "Recuperación C2: actividades focalizadas", activities: "guía de recuperación + cierre", outcome: "Demuestra mejora y cierra proceso formativo" },
    ];

    const plRows = lessonsData.map((l, i) => ({
      plan_id: plan!.id,
      lesson_number: i + 1,
      term: i < 14 ? 1 : 2,
      theme: l.theme,
      activities_summary: l.activities,
      learning_outcome: l.outcome,
      justification: `Clase ${i + 1}: ${l.theme}`,
    }));
    const { error: plErr } = await db.from("plan_lessons").insert(plRows);
    if (plErr) throw plErr;

    return new Response(
      JSON.stringify({ success: true, course_id: course!.id, plan_id: plan!.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
