import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { repairCurriculumDocumentNodes } from "../_shared/curriculumImport.ts";

// deno-lint-ignore no-explicit-any
type SupabaseClientLike = any;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type LessonDraft = {
  lesson_number: number;
  content_block_title: string;
  theme: string;
  subtitle: string;
  justification: string;
  learning_outcome: string;
  activities_summary: string;
};

type ContentBlockDraft = {
  title: string;
  description: string;
  topics: string[];
  term: number | null;
};

type RubricRowDraft = {
  content_block_title: string;
  criterion_name: string;
  focus_note: string;
  advanced_level: string;
  expected_level: string;
  basic_level: string;
  initial_level: string;
};

type BootstrapPayload = {
  fundamentacion: string;
  estrategias_marco: string;
  estrategias_practicas: string[];
  evaluacion_marco: string;
  resources: string;
  objectives: string[];
  content_blocks: ContentBlockDraft[];
  rubrics: RubricRowDraft[];
  lessons: LessonDraft[];
};

type CurriculumNodeRow = {
  id: string;
  name: string;
  node_type: "EJE" | "UNIDAD" | "BLOQUE" | "CONTENIDO";
  order_index: number;
};

type CourseSummary = {
  id: string;
  subject: string;
  year_level: number;
  orientation: string | null;
  speciality: string | null;
  schools: {
    official_name: string | null;
    school_type: string | null;
  } | null;
};

type PlanLessonSummary = {
  id: string;
  lesson_number: number;
  term: number;
};

type InsertedPlanContentMapping = {
  id: string;
  curriculum_node_id: string;
};

type CanonLessonSeed = {
  theme: string;
  operation: string;
  evidence: string;
  learning_outcome: string;
  justification: string;
};

function normalizeKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function isFyHctSubject(subject: string): boolean {
  const normalized = normalizeKey(subject);
  return normalized.includes("filosofia e historia de la ciencia y la tecnologia");
}

function isFilosofiaSubject(subject: string): boolean {
  return normalizeKey(subject) === "filosofia";
}

function isCurriculumNoiseText(normalized: string): boolean {
  const compact = normalized.replace(/\s+/g, "");
  return (
    normalized.startsWith("diseno curricular para") ||
    normalized.startsWith("educacion secundaria") ||
    normalized.startsWith("isbn") ||
    normalized.startsWith("cdd") ||
    normalized.startsWith("indice") ||
    normalized.startsWith("presentacion") ||
    normalized.startsWith("equipo de especialistas") ||
    normalized.startsWith("direccion general") ||
    normalized.startsWith("dgcye") ||
    compact.includes("directorageneral") ||
    compact.includes("presidentadelconsejo") ||
    compact.includes("subsecretariadeeducacion") ||
    compact.includes("directoraprovincialdegestioneducativa") ||
    compact.includes("gobernador") ||
    compact.includes("ministro") ||
    compact.includes("autoridades")
  );
}

function isCurriculumNoiseNode(node: CurriculumNodeRow): boolean {
  const normalized = normalizeKey(node.name);
  if (!normalized) return true;
  if (isCurriculumNoiseText(normalized)) return true;
  if (/^\d+$/.test(normalized)) return true;
  return false;
}

function isLikelyBibliographyNodeName(name: string): boolean {
  const normalized = normalizeKey(name);
  if (!normalized || isCurriculumNoiseText(normalized)) return false;

  const trimmed = name.trim();
  const commaCount = (trimmed.match(/,/g) || []).length;
  const hasAuthorPrefix = /^[A-ZÁÉÍÓÚÑ][^,]{1,90},/.test(trimmed);
  const hasYear = /\b(1[89]\d{2}|20\d{2})\b/.test(trimmed);
  const hasEditionFallback = /\bvarias\s+ediciones\b/i.test(trimmed);

  if (!hasAuthorPrefix) return false;
  if (commaCount < 2) return false;
  if (!hasYear && !hasEditionFallback && commaCount < 3) return false;
  return true;
}

function formatReadableParagraphs(text: string, minParagraphs = 4): string {
  const raw = (text || "").replace(/\r/g, "").trim();
  if (!raw) return raw;

  const existingParagraphs = raw
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
  if (existingParagraphs.length >= minParagraphs) {
    return existingParagraphs.join("\n\n");
  }

  const normalized = raw.replace(/\n+/g, " ").replace(/\s+/g, " ").trim();
  const sentences = normalized.match(/[^.!?]+[.!?]+(?:\s|$)|[^.!?]+$/g) || [normalized];
  if (sentences.length < 4) return normalized;

  const targetParagraphs = Math.min(6, Math.max(minParagraphs, Math.ceil(sentences.length / 3)));
  const chunkSize = Math.ceil(sentences.length / targetParagraphs);
  const paragraphs: string[] = [];

  for (let index = 0; index < sentences.length; index += chunkSize) {
    const chunk = sentences
      .slice(index, index + chunkSize)
      .map((sentence) => sentence.trim())
      .filter(Boolean)
      .join(" ")
      .trim();
    if (chunk) paragraphs.push(chunk);
  }

  return paragraphs.join("\n\n");
}

function uniqueNodes(nodes: CurriculumNodeRow[]): CurriculumNodeRow[] {
  const byId = new Map<string, CurriculumNodeRow>();
  for (const node of nodes) {
    if (!byId.has(node.id)) byId.set(node.id, node);
  }
  return Array.from(byId.values());
}

function selectPlanningNodes(nodes: CurriculumNodeRow[]): CurriculumNodeRow[] {
  const preferred = nodes.filter(
    (node) =>
      ["CONTENIDO", "BLOQUE", "UNIDAD"].includes(node.node_type) &&
      !isCurriculumNoiseNode(node)
  );
  if (preferred.length > 0) return preferred;

  const fallback = nodes.filter((node) => !isCurriculumNoiseNode(node));
  if (fallback.length > 0) return fallback;

  return nodes;
}

function buildNodePools(nodes: CurriculumNodeRow[]): {
  nodesForPrompt: CurriculumNodeRow[];
  nodesForMappings: CurriculumNodeRow[];
  coreNodes: CurriculumNodeRow[];
  bibliographyNodes: CurriculumNodeRow[];
} {
  const planningNodes = selectPlanningNodes(nodes);
  const safeDocumentNodes = nodes.filter((node) => !isCurriculumNoiseNode(node));
  const bibliographyNodes = uniqueNodes(
    safeDocumentNodes.filter((node) => isLikelyBibliographyNodeName(node.name))
  );

  const coreNodes = uniqueNodes(
    planningNodes.filter((node) => !isLikelyBibliographyNodeName(node.name))
  );
  const nonBibliographyDocumentNodes = uniqueNodes(
    safeDocumentNodes.filter((node) => !isLikelyBibliographyNodeName(node.name))
  );
  const safeCoreNodes =
    coreNodes.length > 0
      ? coreNodes
      : nonBibliographyDocumentNodes.length > 0
        ? nonBibliographyDocumentNodes
        : planningNodes;
  const nodesForPrompt = uniqueNodes([...safeCoreNodes, ...bibliographyNodes]).slice(0, 60);
  const nodesForMappings = uniqueNodes(safeCoreNodes).slice(0, 260);

  return {
    nodesForPrompt,
    nodesForMappings,
    coreNodes: safeCoreNodes,
    bibliographyNodes,
  };
}

function buildActivitiesSummary(operation: string, evidence: string): string {
  return `Operacion: ${operation} Evidencia minima: ${evidence}`;
}

function extractOperation(summary: string | null | undefined): string {
  const raw = typeof summary === "string" ? summary.trim() : "";
  if (!raw) return "";
  const operationMatch = raw.match(/operacion\s*:\s*([\s\S]*?)(?=evidencia minima\s*:|$)/i);
  return (operationMatch?.[1] || raw).replace(/\s+/g, " ").trim();
}

function defaultLessonSubtitle(operation: string, theme: string): string {
  const cleaned = operation.replace(/\s+/g, " ").trim();
  if (cleaned) return cleaned;
  return `Trabajo guiado sobre ${theme}.`;
}

function createGenericContentBlocks(nodeNames: string[]): ContentBlockDraft[] {
  const cleanedTopics = nodeNames.filter((name) => name.trim().length > 0).slice(0, 16);
  const blocks = [
    {
      title: "Unidad 1",
      description: "Apertura del recorrido anual con conceptos, preguntas iniciales y primeras relaciones con el programa oficial.",
      topics: cleanedTopics.slice(0, 4),
      term: 1,
    },
    {
      title: "Unidad 2",
      description: "Profundizacion del primer cuatrimestre con problemas, casos y producciones que dejen evidencia visible.",
      topics: cleanedTopics.slice(4, 8),
      term: 1,
    },
    {
      title: "Unidad 3",
      description: "Inicio del segundo cuatrimestre con revision, ampliacion de contenidos y mejora de herramientas de trabajo.",
      topics: cleanedTopics.slice(8, 12),
      term: 2,
    },
    {
      title: "Unidad 4",
      description: "Cierre anual con integracion de contenidos, producciones finales y recuperacion equivalente.",
      topics: cleanedTopics.slice(12, 16),
      term: 2,
    },
  ];

  return blocks.map((block, index) => ({
    ...block,
    title: block.title,
    topics: block.topics.length > 0 ? block.topics : [`Tema central ${index + 1}`],
  }));
}

function buildFallbackRubrics(blocks: ContentBlockDraft[]): RubricRowDraft[] {
  return blocks.map((block, index) => ({
    content_block_title: block.title,
    criterion_name: `Criterio ${index + 1}: desarrollo del bloque`,
    focus_note: `Se observa la apropiacion de contenidos, la calidad del trabajo y la evidencia producida en ${block.title}.`,
    advanced_level: "Integra contenidos del bloque con precision, autonomia y una evidencia clara, completa y bien justificada.",
    expected_level: "Resuelve lo central del bloque con claridad suficiente y deja una evidencia pertinente y comprensible.",
    basic_level: "Avanza de forma parcial en el bloque y necesita apoyos para sostener conceptos, organizacion o evidencia.",
    initial_level: "No logra aun apropiarse del bloque ni producir una evidencia suficiente para acreditar el recorrido.",
  }));
}

function buildFyHctContentBlocks(): Array<ContentBlockDraft & { lesson_range: [number, number] }> {
  return [
    {
      title: "Unidad I: Filosofia, conocimiento y argumentacion",
      description:
        "Presenta la filosofia como practica de problematizar, conceptualizar y argumentar, y la situa en problemas reales del contexto escolar.",
      topics: [
        "Concepto de filosofia y toma de decisiones",
        "Asombro, duda y situaciones limite",
        "Del mito al logos",
        "Ramas y problemas actuales situados",
      ],
      term: 1,
      lesson_range: [1, 4],
    },
    {
      title: "Unidad II: Ciencia, tecnologia y vinculos",
      description:
        "Desarrolla relaciones entre ciencia, tecnologia, evidencia y decisiones tecnicas a partir de casos y proyectos del primer cuatrimestre.",
      topics: [
        "Rasgos del conocimiento cientifico",
        "Tecnologia, historia e impactos",
        "Ciencia y tecnologia en alimentos",
        "Casos del taller: problema, hipotesis, controles y evidencia",
        "Proyecto de protocolo digital",
        "Cierre y recuperacion del primer cuatrimestre",
      ],
      term: 1,
      lesson_range: [5, 14],
    },
    {
      title: "Unidad III: Lenguaje y logica de la explicacion",
      description:
        "Fortalece precision conceptual, argumentacion e informes como base para el segundo cuatrimestre.",
      topics: [
        "Lenguaje y explicacion tecnica",
        "Razonamientos y falacias",
        "Mejora de informes",
      ],
      term: 2,
      lesson_range: [15, 17],
    },
    {
      title: "Unidad IV: Teorias y cambio cientifico",
      description:
        "Trabaja teorias, modelos, cambio cientifico y controversias para leer la validacion del conocimiento.",
      topics: [
        "Teorias y modelos",
        "Kuhn y cambio cientifico",
        "Popper y prueba critica",
        "Casos historicos de Darwin y Pasteur-Pouchet",
      ],
      term: 2,
      lesson_range: [18, 22],
    },
    {
      title: "Unidad V: Metodos y etica de la investigacion",
      description:
        "Integra metodos, comunidad cientifica, etica y producciones finales con una salida verificable para el curso.",
      topics: [
        "Metodos: induccion e hipotetico-deductivo",
        "Comunidad cientifica y revision",
        "Etica de la investigacion y de la tecnologia",
        "Dossier integrador, presentacion y recuperacion",
      ],
      term: 2,
      lesson_range: [23, 28],
    },
  ];
}

function blockTitleForLesson(
  lessonNumber: number,
  blocks: Array<ContentBlockDraft & { lesson_range?: [number, number] }>
): string {
  const matched = blocks.find((block) => {
    if (!block.lesson_range) return false;
    return lessonNumber >= block.lesson_range[0] && lessonNumber <= block.lesson_range[1];
  });
  return matched?.title || blocks[Math.min(blocks.length - 1, Math.floor((lessonNumber - 1) / Math.max(1, Math.ceil(28 / blocks.length))))].title;
}

const GOLDEN_FYHCT_6_EESA_LESSONS: CanonLessonSeed[] = [
  {
    theme: "Concepto de Filosofia y toma de decisiones",
    operation: "Instalar que la filosofia funciona como practica de problematizar, conceptualizar y argumentar sobre decisiones tecnicas reales del curso.",
    evidence: "Definicion operativa de filosofia en 5 a 7 lineas con un ejemplo del entorno agro.",
    learning_outcome: "Explican para que sirve el trabajo filosofico en decisiones tecnicas del curso y formulan una definicion operativa inicial.",
    justification: "Abre el ano con el criterio central de la materia y deja una base comun para leer ciencia, tecnologia y decisiones del taller.",
  },
  {
    theme: "Asombro, duda y situaciones limite",
    operation: "Reconstruir experiencias del grupo donde algo habitual del taller se vuelve pregunta rigurosa.",
    evidence: "Listado breve de tres situaciones del curso con la pregunta filosofica que abren.",
    learning_outcome: "Reconocen asombro, duda y situaciones limite en su experiencia y las convierten en preguntas pertinentes.",
    justification: "Profundiza el origen del preguntar filosofico y conecta la materia con situaciones efectivas de la escuela.",
  },
  {
    theme: "Del mito al logos",
    operation: "Comparar mito y logos con lectura guiada sobre Socrates, Platon y Aristoteles para distinguir modos de explicar.",
    evidence: "Cuadro comparativo mito versus logos con seis rasgos claros.",
    learning_outcome: "Distinguen el pasaje del mito al logos y lo usan para comparar formas de saber.",
    justification: "Da espesor historico al origen de la filosofia y prepara el trabajo posterior sobre conocimiento y justificacion.",
  },
  {
    theme: "Ramas y problemas actuales situados",
    operation: "Vincular ontologia, epistemologia, logica y etica con IA, bienestar animal, trazabilidad y privacidad.",
    evidence: "Mapa conceptual que una una rama filosofica con un problema actual y una pregunta del grupo.",
    learning_outcome: "Relacionan ramas de la filosofia con problemas contemporaneos situados del contexto agro.",
    justification: "Amplia el marco disciplinar sin perder situacion y deja visibles las preguntas que reapareceran en el resto del ano.",
  },
  {
    theme: "Rasgos del conocimiento cientifico",
    operation: "Precisar sistematicidad, contrastacion y falibilidad comparando ciencias naturales, sociales y formales.",
    evidence: "Ficha con rasgos del conocimiento cientifico y un ejemplo por tipo de ciencia.",
    learning_outcome: "Caracterizan que vuelve cientifico a un conocimiento y comparan tipos de ciencias con ejemplos del curso.",
    justification: "Hace de puente entre filosofia y epistemologia de la ciencia para poder leer despues teorias, metodos y validacion.",
  },
  {
    theme: "Tecnologia, historia e impactos",
    operation: "Analizar decisiones tecnicas atendiendo impactos sanitarios, ambientales y economicos.",
    evidence: "Parrafo de fundamentacion de una decision tecnica con criterios explicitos.",
    learning_outcome: "Justifican una decision tecnica considerando criterios y consecuencias relevantes.",
    justification: "Introduce la dimension axiologica de la tecnologia y prepara la lectura situada de casos del taller.",
  },
  {
    theme: "Ciencia y tecnologia en alimentos",
    operation: "Relacionar ciencia, tecnologia, normativas basicas y trazabilidad en procesos agroalimentarios escolares.",
    evidence: "Esquema de relaciones entre ciencia y tecnologia aplicado a un proceso del taller.",
    learning_outcome: "Explican como se coproducen ciencia y tecnologia en un proceso concreto del curso.",
    justification: "Organiza el pasaje hacia el trabajo por casos y vuelve visible la trama de criterios que sostiene una decision tecnica.",
  },
  {
    theme: "Caso 1: problema e hipotesis",
    operation: "Seleccionar un proceso del taller y formular problema, hipotesis operativa, variables y controles.",
    evidence: "Enunciado de problema e hipotesis operativa en 3 o 4 lineas con variables y controles.",
    learning_outcome: "Formulan un problema investigable y una hipotesis operativa con controles pertinentes.",
    justification: "Inicia el primer caso situado y convierte la teoria previa en una operacion concreta de indagacion.",
  },
  {
    theme: "Caso 1: controles y evidencia",
    operation: "Trabajar indicadores, registros y analisis Tesis-Evidencia-Razon sobre el caso elegido.",
    evidence: "Planilla de registro completada y una relacion explicita entre datos y conclusion.",
    learning_outcome: "Relacionan datos, registros y conclusiones usando una estructura argumentativa explicitada.",
    justification: "Profundiza el caso con una lectura estricta de evidencias y fortalece el nexo entre registro y argumento.",
  },
  {
    theme: "Caso 1: decision tecnica y etica",
    operation: "Ponderar impactos, comunicar una decision y justificarla con criterios sanitarios, ambientales y de responsabilidad.",
    evidence: "Matriz de impactos completa y texto breve de 6 a 8 lineas con la decision tomada.",
    learning_outcome: "Defienden una decision tecnica responsable a partir de evidencias y criterios explicitados.",
    justification: "Cierra el primer caso mostrando que la materia desemboca en decisiones tecnicas justificadas, no en opinion suelta.",
  },
  {
    theme: "Proyecto de protocolo digital: diseno",
    operation: "Disenar un protocolo de uso responsable de aplicaciones y datos para registro y trazabilidad.",
    evidence: "Borrador de protocolo con responsables, resguardos y criterios de exito.",
    learning_outcome: "Proponen un protocolo inicial de uso de datos y trazabilidad con criterios claros.",
    justification: "Abre un proyecto aplicable a la escuela y conecta filosofia de la tecnologia con una produccion institucional concreta.",
  },
  {
    theme: "Proyecto de protocolo digital: validacion",
    operation: "Simular el protocolo, revisar riesgos y ajustar responsables, pasos y criterios de resguardo.",
    evidence: "Version revisada del protocolo con observaciones incorporadas.",
    learning_outcome: "Revisan un procedimiento y justifican mejoras sobre privacidad, seguridad y trazabilidad.",
    justification: "Consolida el proyecto del cuatrimestre y da una salida productiva a lo trabajado en clases anteriores.",
  },
  {
    theme: "Cierre del primer cuatrimestre",
    operation: "Realizar autoevaluacion y coevaluacion con rubrica para identificar avances y puntos a reforzar.",
    evidence: "Autoevaluacion escrita y plan de estudio focalizado.",
    learning_outcome: "Reconocen sus avances y definen prioridades de mejora con base en criterios compartidos.",
    justification: "Funciona como integradora del primer tramo y organiza una recuperacion equivalente basada en evidencia.",
  },
  {
    theme: "Recuperacion del primer cuatrimestre",
    operation: "Resolver actividades focalizadas por criterio no alcanzado y reconstruir evidencias faltantes.",
    evidence: "Resolucion de la guia de recuperacion correspondiente.",
    learning_outcome: "Recuperan aprendizajes del primer cuatrimestre mediante tareas equivalentes y focalizadas.",
    justification: "Garantiza continuidad evaluativa y evita que el cierre del primer tramo sea un bloqueo sin salida pedagogica.",
  },
  {
    theme: "Lenguaje y explicacion tecnica",
    operation: "Trabajar ambiguedad, vaguedad y precision mediante reescritura de enunciados tecnicos y explicaciones breves.",
    evidence: "Reescritura de un enunciado ambiguo y elaboracion de una explicacion clara en 6 a 8 lineas.",
    learning_outcome: "Mejoran la precision conceptual y redactan explicaciones tecnicas mas claras.",
    justification: "Abre el segundo cuatrimestre con herramientas de lenguaje necesarias para mejorar informes, argumentos y comunicaciones.",
  },
  {
    theme: "Razonamientos y falacias",
    operation: "Distinguir razonamientos inductivos y deductivos e identificar errores argumentativos frecuentes en comunicacion tecnica.",
    evidence: "Identificacion y correccion de dos falacias en ejemplos provistos.",
    learning_outcome: "Reconocen estructuras de razonamiento y corrigen falacias en producciones tecnicas breves.",
    justification: "Sostiene la alfabetizacion argumentativa y prepara el trabajo de mejora de informes y evaluacion de teorias.",
  },
  {
    theme: "Mejora de informes",
    operation: "Reescribir un informe breve fortaleciendo cohesion, coherencia, citas y referencias completas.",
    evidence: "Version mejorada de un informe breve con referencias completas.",
    learning_outcome: "Revisan informes con criterios de claridad, coherencia y uso responsable de fuentes.",
    justification: "Convierte lenguaje y argumentacion en una produccion profesionalizable, util para el dossier integrador.",
  },
  {
    theme: "Teorias y modelos",
    operation: "Distinguir hipotesis, leyes, teorias y modelos aplicando esas diferencias a ejemplos del entorno agro.",
    evidence: "Esquema de modelo sencillo aplicado a un proceso conocido.",
    learning_outcome: "Explican diferencias entre hipotesis, ley, teoria y modelo mediante un caso cercano.",
    justification: "Abre el bloque de filosofia de la ciencia con una base conceptual necesaria para leer cambio teorico y metodos.",
  },
  {
    theme: "Kuhn y cambio cientifico",
    operation: "Leer ciencia normal, anomalias, crisis y revolucion cientifica y aplicar esos conceptos a un caso breve.",
    evidence: "Sintesis de 8 a 10 lineas que aplique los conceptos a un caso acotado.",
    learning_outcome: "Usan categorias de Kuhn para interpretar cambios en la ciencia a partir de un ejemplo.",
    justification: "Introduce una teoria fuerte sobre cambio cientifico y prepara el contraste con Popper.",
  },
  {
    theme: "Popper y prueba critica",
    operation: "Trabajar falsacion y conjeturas-refutaciones mediante el diseno en papel de una prueba critica.",
    evidence: "Propuesta de prueba critica y prediccion esperada.",
    learning_outcome: "Disenan una prueba critica posible y explican que refutaria o tensionaria una hipotesis.",
    justification: "Profundiza el problema de validacion y conecta epistemologia con decisiones metodologicas observables.",
  },
  {
    theme: "Caso 2: Darwin",
    operation: "Analizar teoria de seleccion natural, evidencias historicas y transferencia metodologica al entorno escolar.",
    evidence: "Tabla teoria-evidencia-conclusion con una transferencia al entorno del curso.",
    learning_outcome: "Relacionan teoria, evidencias y conclusion en un caso historico relevante para la materia.",
    justification: "Ofrece un caso historico fuerte para pensar evidencia, teoria y cambio cientifico sin salir del enfoque curricular.",
  },
  {
    theme: "Caso 3: Pasteur y Pouchet",
    operation: "Reconstruir argumentos a favor y en contra en torno a biogenesis y generacion espontanea.",
    evidence: "Reconstruccion del argumento a favor y en contra en dos columnas.",
    learning_outcome: "Comparan argumentos contrapuestos y explicitan que cuenta como evidencia en una controversia cientifica.",
    justification: "Completa el bloque de casos historicos y refuerza la lectura critica de controversias y validacion.",
  },
  {
    theme: "Metodos: induccion e hipotetico-deductivo",
    operation: "Representar esquemas, alcances y limites de ambos metodos y reconocerlos en ejemplos del curso.",
    evidence: "Diagrama del metodo aplicado a un ejemplo del curso.",
    learning_outcome: "Distinguen metodos de trabajo cientifico y los aplican a situaciones concretas del entorno escolar.",
    justification: "Integra teoria metodologica con ejemplos cercanos para que el curso no quede en formulaciones abstractas.",
  },
  {
    theme: "Comunidad cientifica y revision",
    operation: "Trabajar revision por pares, replicacion, correccion de errores y autoria con un miniinforme.",
    evidence: "Lista de criterios de revision aplicada a un miniinforme.",
    learning_outcome: "Explican como la comunidad cientifica valida, corrige y distribuye responsabilidades.",
    justification: "Introduce la dimension social e institucional de la ciencia y fortalece el uso de criterios publicos de evaluacion.",
  },
  {
    theme: "Etica de la investigacion y de la tecnologia",
    operation: "Valorar riesgos, consentimiento, bienestar animal y ambiente mediante una matriz de impactos.",
    evidence: "Matriz de impactos con una recomendacion justificada.",
    learning_outcome: "Argumentan recomendaciones responsables frente a riesgos e impactos de investigacion y tecnologia.",
    justification: "Recupera la dimension etica de la materia y la conecta con decisiones de intervencion concretas.",
  },
  {
    theme: "Taller de dossier integrador",
    operation: "Definir estructura, fuentes, evidencias y reparto de trabajo para el dossier integrador del curso.",
    evidence: "Esquema del dossier y plan de trabajo del equipo.",
    learning_outcome: "Organizan un producto integrador con criterios de coherencia, fuentes y responsabilidades.",
    justification: "Prepara la salida integradora del ano y articula bibliografia, casos y evidencias previas en una produccion mayor.",
  },
  {
    theme: "Presentacion y retroalimentacion",
    operation: "Exponer el dossier, defender decisiones y realizar coevaluacion con rubrica.",
    evidence: "Presentacion breve de 3 a 5 minutos y devolucion escrita a otro equipo.",
    learning_outcome: "Comunican su trabajo, justifican decisiones y elaboran devoluciones utiles para otros equipos.",
    justification: "Funciona como instancia integradora final donde se vuelve visible la coherencia del recorrido anual.",
  },
  {
    theme: "Recuperacion del segundo cuatrimestre",
    operation: "Resolver actividades focalizadas por criterio no alcanzado y cerrar el banco de evidencias del curso.",
    evidence: "Resolucion de la guia de recuperacion y cierre de evidencias.",
    learning_outcome: "Recuperan aprendizajes del segundo cuatrimestre con actividades equivalentes y bien focalizadas.",
    justification: "Cierra el ano con recuperacion equivalente y garantiza que el recorrido final siga siendo verificable y editable.",
  },
];

async function callAI(apiKey: string, messages: Array<{ role: string; content: string }>) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 50000); // 50s max
  try {
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages,
        response_format: { type: "json_object" },
      }),
      signal: controller.signal,
    });

    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`AI gateway error ${resp.status}: ${text}`);
    }

    return await resp.json();
  } finally {
    clearTimeout(timeout);
  }
}

function fallbackObjectives(subject: string): string[] {
  if (isFyHctSubject(subject)) {
    return [
      "Diferenciaran saber cotidiano, tecnico y cientifico en situaciones del entorno agro con criterios explicitos.",
      "Formularan problemas, hipotesis operativas, controles y evidencias en casos del curso.",
      "Argumentaran decisiones tecnicas mediante Tesis-Evidencia-Razon y matrices de impactos.",
      "Analizaran teoria, metodos y cambio cientifico a partir de casos historicos y del entorno escolar.",
      "Mejoraran informes, explicaciones y registros con vocabulario disciplinar y referencias claras.",
      "Construiran un dossier integrador que deje trazabilidad entre bibliografia, casos y evidencias del ano.",
    ];
  }

  return [
    `Comprenderan los ejes centrales de ${subject} y su relacion con problemas del curso.`,
    `Desarrollaran producciones breves con vocabulario disciplinar y criterios explicitos.`,
    `Relacionaran conceptos de la materia con situaciones y practicas del contexto escolar.`,
    `Mejoraran sus argumentos, registros y explicaciones a partir de evidencia y revision.`,
    `Usaran fuentes del curso de forma responsable, clara y trazable.`,
    `Participaran en instancias de analisis, intercambio y evaluacion formativa durante el ano.`,
  ];
}

function buildFyHctFallbackBootstrap(lessonCount: number): BootstrapPayload {
  const contentBlocks = buildFyHctContentBlocks();
  const lessons = Array.from({ length: lessonCount }, (_, index) => {
    const seed = GOLDEN_FYHCT_6_EESA_LESSONS[index] || GOLDEN_FYHCT_6_EESA_LESSONS[GOLDEN_FYHCT_6_EESA_LESSONS.length - 1];
    const contentBlockTitle = blockTitleForLesson(index + 1, contentBlocks);
    return {
      lesson_number: index + 1,
      content_block_title: contentBlockTitle,
      theme: seed.theme,
      subtitle: defaultLessonSubtitle(seed.operation, seed.theme),
      justification: seed.justification,
      learning_outcome: seed.learning_outcome,
      activities_summary: buildActivitiesSummary(seed.operation, seed.evidence),
    };
  });

  return {
    fundamentacion:
      "La planificacion anual de Filosofia e Historia de la Ciencia y la Tecnologia para 6 ano de una EESA se organiza desde una idea simple: en contextos donde el estudiantado participa de practicas tecnicas con impacto sanitario, ambiental, productivo y social, no alcanza con ejecutar procedimientos. Hace falta comprender que se hace, justificar elecciones y responder por sus consecuencias. En ese marco, la materia aporta lenguaje, criterio y estructuras de analisis para leer la relacion entre filosofia, ciencia y tecnologia dentro de situaciones reales del curso. El ano no se organiza como una suma de temas aislados, sino como una progresion de decisiones, casos, problemas y producciones que vuelven visible la racionalidad implicada en el trabajo tecnico." +
      "\n\n" +
      "La propuesta parte de la filosofia entendida como practica de problematizar, conceptualizar y argumentar. Problematizar permite convertir lo habitual en pregunta; conceptualizar exige precisar terminos y construir definiciones operativas; argumentar demanda sostener conclusiones con razones, datos y consideracion de objeciones. Sobre esa base se trabaja que cuenta como conocimiento, como se justifican afirmaciones y decisiones, como se construyen y cambian las teorias cientificas y con que criterios se evaluan las intervenciones tecnologicas. La historia de la ciencia y la tecnologia aparece entonces no como adorno cultural, sino como forma de leer controversias, validaciones, errores y correcciones que siguen siendo relevantes para la escuela agrotecnica." +
      "\n\n" +
      "La secuencia anual se apoya en casos y situaciones del entorno agro. Procesos como elaboracion de alimentos, trazabilidad, agua de proceso, bienestar animal, uso de aplicaciones y resguardo de datos permiten pasar de conceptos generales a problemas concretos. Cada clase deja una evidencia minima verificable para evitar que la planificacion quede solo en declaracion. Esa evidencia puede tomar forma de definicion operativa, cuadro comparativo, planilla, matriz de impactos, informe mejorado, prueba critica, esquema o fragmento del dossier integrador. De este modo, la agenda anual no solo enumera temas: organiza una cadena de trabajo visible que sirve despues para secuencias, clases y materiales." +
      "\n\n" +
      "La evaluacion es continua, formativa y basada en criterios explicitados. Se observan comprension conceptual, calidad de registros, relacion entre evidencia y conclusion, claridad argumentativa, uso responsable de fuentes y capacidad de transferencia al contexto del curso. Se preve una instancia de recuperacion equivalente por cuatrimestre para que el error funcione como insumo de aprendizaje y no como cierre definitivo. Esto sostiene una logica de mejora y hace que la planificacion anual siga siendo un instrumento vivo, editable y util para el docente." +
      "\n\n" +
      "La propuesta tambien contempla viabilidad low-tech. Cada tramo puede sostenerse con carpeta, pizarron, impresos, registros y materiales del curso, con apoyos de lectura y estructuras de trabajo claras. La intencion de este borrador no es reemplazar el criterio docente, sino dejar una base fuerte y trazable para adaptar ritmos, profundidades y decisiones segun calendario, grupo y recursos de la institucion. Por eso el plan anual se presenta como un sistema coherente: programa oficial, agenda de 28 clases, producciones minimas por clase y salida hacia secuencias, clases desarrolladas y materiales de lectura alineados.",
    estrategias_marco:
      "Se propone una alfabetizacion argumentativa situada, articulada con casos del entorno agro, lectura guiada, producciones breves, registros de evidencias, revision entre pares y cierres con justificacion tecnica y etica.",
    estrategias_practicas: [
      "Lectura guiada con glosario, preguntas de comprension y aplicacion a situaciones del curso.",
      "Trabajo con casos del taller mediante problema, hipotesis, controles, evidencia y decision.",
      "Producciones breves con estructuras explicitas como Tesis-Evidencia-Razon, matrices de impactos e informes revisados.",
      "Alternativas low-tech con carpeta, registros impresos y materiales no perecederos para sostener continuidad.",
    ],
    evaluacion_marco:
      "La evaluacion sera continua, global y formativa. Se observaran comprension conceptual, evidencias y registros, argumentacion y comunicacion, relacion teoria-practica y calidad del trabajo sostenido. Habra autoevaluacion, coevaluacion, devoluciones breves y una recuperacion equivalente por cuatrimestre.",
    resources:
      "Pizarron, carpeta o cuaderno, impresos con glosario y lecturas breves, planillas de registro, fotografias o descripciones de casos del taller, proyector o TV segun disponibilidad y alternativa low-tech para cada actividad.",
    objectives: fallbackObjectives("Filosofia e Historia de la Ciencia y la Tecnologia"),
    content_blocks: contentBlocks.map(({ lesson_range: _lessonRange, ...block }) => block),
    rubrics: buildFallbackRubrics(contentBlocks),
    lessons,
  };
}

function fallbackBootstrap(subject: string, nodeNames: string[], lessonCount: number): BootstrapPayload {
  if (isFyHctSubject(subject) && lessonCount === 28) {
    return buildFyHctFallbackBootstrap(lessonCount);
  }

  const baseTopics = nodeNames.length > 0 ? nodeNames : [subject];
  const contentBlocks = createGenericContentBlocks(baseTopics);

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
    content_blocks: contentBlocks,
    rubrics: buildFallbackRubrics(contentBlocks),
    lessons: Array.from({ length: lessonCount }, (_, index) => {
      const topic = baseTopics[index % baseTopics.length];
      const contentBlockTitle = blockTitleForLesson(
        index + 1,
        contentBlocks.map((block, blockIndex) => ({
          ...block,
          lesson_range:
            blockIndex === 0
              ? [1, 7]
              : blockIndex === 1
                ? [8, 14]
                : blockIndex === 2
                  ? [15, 21]
                  : [22, 28],
        }))
      );
      const operation = `Apertura con recuperacion breve y desarrollo guiado sobre "${topic}".`;
      return {
        lesson_number: index + 1,
        content_block_title: contentBlockTitle,
        theme: `${topic}`,
        subtitle: defaultLessonSubtitle(operation, topic),
        justification: `La clase ${index + 1} desarrolla un recorte del diseno curricular para sostener una progresion anual clara y contextualizada.`,
        learning_outcome: `Al finalizar la clase ${index + 1}, el estudiantado podra explicar y trabajar de manera situada el eje "${topic}".`,
        activities_summary: buildActivitiesSummary(operation, `Produccion breve verificable vinculada al eje "${topic}" y puesta en comun final.`),
      };
    }),
  };
}

function normalizeActivitiesSummary(summary: string | null | undefined, fallbackTheme: string): string {
  const raw = typeof summary === "string" ? summary.trim() : "";
  if (!raw) {
    return buildActivitiesSummary(
      `Desarrollo guiado sobre "${fallbackTheme}" con una progresion clara durante la clase.`,
      `Produccion breve verificable que muestre avance sobre "${fallbackTheme}".`
    );
  }

  if (/operacion\s*:/i.test(raw) && /evidencia minima\s*:/i.test(raw)) {
    return raw;
  }

  const compact = raw.replace(/\s+/g, " ").trim();
  return buildActivitiesSummary(
    compact,
    `Produccion breve verificable alineada con "${fallbackTheme}".`
  );
}

function normalizeBootstrapPayload(
  payload: Partial<BootstrapPayload> | null | undefined,
  subject: string,
  nodeNames: string[],
  lessonCount: number
): BootstrapPayload {
  const fallback = fallbackBootstrap(subject, nodeNames, lessonCount);
  const lessons = Array.isArray(payload?.lessons) ? payload!.lessons : fallback.lessons;
  const contentBlocks =
    Array.isArray(payload?.content_blocks) && payload.content_blocks.length > 0
      ? payload.content_blocks
          .filter((block): block is ContentBlockDraft => typeof block?.title === "string" && block.title.trim().length > 0)
          .slice(0, 8)
          .map((block, index) => ({
            title: block.title.trim(),
            description:
              typeof block.description === "string" && block.description.trim().length > 0
                ? block.description.trim()
                : `Bloque ${index + 1} del recorrido anual.`,
            topics:
              Array.isArray(block.topics) && block.topics.length > 0
                ? block.topics
                    .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
                    .slice(0, 8)
                : [`Tema central del bloque ${index + 1}`],
            term: block.term === 1 || block.term === 2 ? block.term : null,
          }))
      : fallback.content_blocks;
  const blockKeys = new Set(contentBlocks.map((block) => normalizeKey(block.title)));
  const rubrics =
    Array.isArray(payload?.rubrics) && payload.rubrics.length > 0
      ? payload.rubrics
          .filter(
            (row): row is RubricRowDraft =>
              typeof row?.content_block_title === "string" &&
              typeof row?.criterion_name === "string" &&
              row.content_block_title.trim().length > 0 &&
              row.criterion_name.trim().length > 0 &&
              blockKeys.has(normalizeKey(row.content_block_title))
          )
          .slice(0, 24)
          .map((row) => ({
            content_block_title: row.content_block_title.trim(),
            criterion_name: row.criterion_name.trim(),
            focus_note: row.focus_note?.trim() || "Se observa el trabajo del bloque con criterios compartidos.",
            advanced_level: row.advanced_level?.trim() || "Desempeno destacado y evidencia consistente.",
            expected_level: row.expected_level?.trim() || "Desempeno esperado y evidencia pertinente.",
            basic_level: row.basic_level?.trim() || "Desempeno parcial con apoyos y evidencia incompleta.",
            initial_level: row.initial_level?.trim() || "Desempeno inicial sin evidencia suficiente todavia.",
          }))
      : fallback.rubrics;

  return {
    fundamentacion:
      typeof payload?.fundamentacion === "string" && payload.fundamentacion.trim().length > 0
        ? formatReadableParagraphs(payload.fundamentacion.trim())
        : formatReadableParagraphs(fallback.fundamentacion),
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
    content_blocks: contentBlocks,
    rubrics: rubrics.length > 0 ? rubrics : fallback.rubrics,
    lessons: Array.from({ length: lessonCount }, (_, index) => {
      const candidate = lessons.find((lesson) => lesson.lesson_number === index + 1) || fallback.lessons[index];
      const fallbackLesson = fallback.lessons[index];
      const requestedBlockTitle = candidate.content_block_title?.trim();
      const contentBlockTitle =
        requestedBlockTitle && blockKeys.has(normalizeKey(requestedBlockTitle))
          ? requestedBlockTitle
          : fallbackLesson.content_block_title;
      const operation = normalizeActivitiesSummary(
        candidate.activities_summary,
        candidate.theme?.trim() || fallbackLesson.theme
      );
      return {
        lesson_number: index + 1,
        content_block_title: contentBlockTitle,
        theme: candidate.theme?.trim() || fallbackLesson.theme,
        subtitle: candidate.subtitle?.trim() || fallbackLesson.subtitle || defaultLessonSubtitle(extractOperation(operation), candidate.theme?.trim() || fallbackLesson.theme),
        justification: candidate.justification?.trim() || fallbackLesson.justification,
        learning_outcome: candidate.learning_outcome?.trim() || fallbackLesson.learning_outcome,
        activities_summary: operation,
      };
    }),
  };
}

async function ensureCurriculumNodes(
  adminClient: SupabaseClientLike,
  curriculumDocumentId: string,
  subject: string,
  officialTitle: string | null
): Promise<{ nodes: CurriculumNodeRow[]; synthetic: boolean }> {
  const { data: existingNodes, error: existingNodesError } = await adminClient
    .from("curriculum_nodes")
    .select("id, name, node_type, order_index")
    .eq("curriculum_document_id", curriculumDocumentId)
    .order("order_index");

  if (existingNodesError) throw existingNodesError;
  if (existingNodes && existingNodes.length > 0) {
    return { nodes: existingNodes as CurriculumNodeRow[], synthetic: false };
  }

  const { data: syntheticAxis, error: syntheticAxisError } = await adminClient
    .from("curriculum_nodes")
    .insert({
      curriculum_document_id: curriculumDocumentId,
      node_type: "EJE",
      name: `Eje general de ${subject}`,
      order_index: 0,
    })
    .select("id, name, node_type, order_index")
    .single();

  if (syntheticAxisError || !syntheticAxis) {
    throw syntheticAxisError || new Error("No se pudo crear un eje curricular minimo");
  }

  const { data: syntheticContent, error: syntheticContentError } = await adminClient
    .from("curriculum_nodes")
    .insert({
      curriculum_document_id: curriculumDocumentId,
      parent_id: syntheticAxis.id,
      node_type: "CONTENIDO",
      name: officialTitle || `Contenido base de ${subject}`,
      order_index: 1,
    })
    .select("id, name, node_type, order_index")
    .single();

  if (syntheticContentError || !syntheticContent) {
    throw syntheticContentError || new Error("No se pudo crear un contenido curricular minimo");
  }

  return {
    nodes: [syntheticAxis, syntheticContent] as CurriculumNodeRow[],
    synthetic: true,
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

  const { data: userData, error: userError } = await userClient.auth.getUser(
    authHeader.replace("Bearer ", "")
  );
  if (userError || !userData?.user?.id) {
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
    console.log("[bootstrap] START", { course_id: body.course_id, plan_id: body.plan_id, curriculum_document_id: body.curriculum_document_id });
    const { data: course, error: courseError } = await userClient
      .from("courses")
      .select("id, subject, year_level, orientation, speciality, schools(official_name, school_type)")
      .eq("id", body.course_id)
      .single();
    if (courseError || !course) throw new Error("Curso no encontrado");
    const courseRecord = course as unknown as CourseSummary;

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

    // Repair curriculum nodes if the document has raw_text but few/no nodes
    const { data: preCheckNodes } = await adminClient
      .from("curriculum_nodes")
      .select("id", { count: "exact", head: true })
      .eq("curriculum_document_id", body.curriculum_document_id);
    const preCheckCount = (preCheckNodes as unknown as number) || 0;
    const hasRawText = (curriculumDocument.raw_text || "").trim().length >= 500;
    if (hasRawText && preCheckCount < 5) {
      try {
        await repairCurriculumDocumentNodes(adminClient, body.curriculum_document_id!);
      } catch {
        // Non-fatal: continue with whatever nodes exist
      }
    }

    const { nodes, synthetic: syntheticNodesCreated } = await ensureCurriculumNodes(
      adminClient,
      body.curriculum_document_id,
      courseRecord.subject,
      curriculumDocument.official_title || null
    );
    const nodePools = buildNodePools(nodes);

    const { data: planLessons, error: planLessonsError } = await adminClient
      .from("plan_lessons")
      .select("id, lesson_number, term")
      .eq("plan_id", body.plan_id)
      .order("lesson_number");
    if (planLessonsError || !planLessons || planLessons.length === 0) {
      throw new Error("No existen plan_lessons para bootstrapear");
    }

    const { count: lessonCount, error: lessonCountError } = await adminClient
      .from("lessons")
      .select("id", { count: "exact", head: true })
      .eq("course_id", body.course_id);
    if (lessonCountError) throw lessonCountError;

    const targetPlanStatus = (lessonCount || 0) > 0 ? "EDITED" : "INCOMPLETE";

    const nodeNames = nodePools.nodesForPrompt.map((node) => `[${node.node_type}] ${node.name}`);
    const bibliographyNodeNames = nodePools.bibliographyNodes.map((node) => node.name);
    const truncatedRawText = (curriculumDocument.raw_text || "").slice(0, 8000);
    const subjectCanonNote = isFyHctSubject(courseRecord.subject)
      ? [
          "Canon disciplinar obligatorio para FyHyCyT:",
          "- No la conviertas en Filosofia pura ni en tecnica descontextualizada.",
          "- Trabaja unidades y casos situados; enlaza filosofia de la ciencia, historia de la ciencia y tecnologia.",
          "- Cada clase debe dejar una evidencia minima concreta y verificable.",
          "- Prioriza casos del entorno escolar o productivo antes que enumeraciones abstractas.",
        ].join("\n")
      : isFilosofiaSubject(courseRecord.subject)
        ? [
            "Canon disciplinar obligatorio para Filosofia:",
            "- Organiza la anual por problemas, conceptos, posiciones, argumentos y objeciones.",
            "- No la conviertas en diseno experimental ni en metodologia cientifica general.",
            "- Cada clase debe dejar una evidencia breve que muestre problematizacion, conceptualizacion o argumentacion.",
          ].join("\n")
        : [
            "Canon operativo obligatorio:",
            "- Cada clase debe ser una unidad pedagogica pequena y util.",
            "- No devuelvas solo titulos de temas; debe quedar visible que hace la clase y que evidencia deja.",
          ].join("\n");
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
  "content_blocks": [
    {
      "title": string,
      "description": string,
      "topics": string[],
      "term": number
    }
  ],
  "rubrics": [
    {
      "content_block_title": string,
      "criterion_name": string,
      "focus_note": string,
      "advanced_level": string,
      "expected_level": string,
      "basic_level": string,
      "initial_level": string
    }
  ],
  "lessons": [
    {
      "lesson_number": number,
      "content_block_title": string,
      "theme": string,
      "subtitle": string,
      "justification": string,
      "learning_outcome": string,
      "activities_summary": string
    }
  ]
}

Reglas:
- fundamentacion: minimo 450 palabras, en prosa y sin metacomentarios.
- objectives: entre 6 y 8 objetivos observables.
- content_blocks: entre 4 y 6 bloques o unidades; cada uno con descripcion breve y 3 a 6 temas en "topics".
- rubrics: al menos 1 fila por bloque; deben articular evaluacion con el bloque correspondiente.
- lessons: exactamente ${planLessons.length} elementos, uno por clase.
- Cada clase debe tener bloque de contenido, tema/foco, subtitulo operativo, justificacion, resultado de aprendizaje y resumen canonico.
- El campo "theme" debe nombrar solo el foco o recorte de la clase, no una lista larga.
- El campo "subtitle" debe indicar en una linea como se trabajara el tema en esa clase.
- El campo "justification" debe explicar por que esa clase importa dentro de la progresion anual.
- El campo "learning_outcome" debe ser observable y realista para una sola clase.
- El campo "activities_summary" debe usar exactamente este formato: "Operacion: ... Evidencia minima: ..."
- La "Operacion" debe describir el movimiento didactico principal de la clase.
- La "Evidencia minima" debe nombrar el producto o huella verificable que deja esa clase.
- El bloque de evaluacion debe separar criterios generales de las filas de rubrica por bloque.
- La bibliografia curricular puede orientar contenidos y evaluacion, pero NO debe mezclarse como si fuera un bloque tematico ni aparecer dentro de content_blocks.
- La anual debe quedar lista para derivar clases y materiales, no solo para archivarse.
- No inventes la fuente curricular. Usa el documento y los nodos provistos.
- La forma del documento debe ser administrativa y util para que el docente la edite despues.
- No pongas markdown ni bloques de codigo, solo JSON.
- Si la materia es FyHyCyT y el curso es de 28 clases, manten 14 clases por cuatrimestre.
- Los content_blocks deben representar unidades/ejes/modulos del recorrido anual, NO secciones del diseno curricular (no poner "Presentacion" ni "Orientaciones didacticas" como bloque).
- Cada content_block debe tener un titulo pedagogico claro, una descripcion de 2-3 lineas y entre 3 y 6 topics concretos.
- Las rubrics deben articularse con los content_blocks: cada fila debe referir un criterio observable del bloque correspondiente.
- Los objectives deben ser del CURSO, no copia literal de encabezados del diseno; deben ser observables y formulados como logros del estudiantado.
- estrategias_marco debe ser un parrafo que explique el enfoque metodologico general.
- estrategias_practicas debe listar entre 3 y 6 estrategias concretas y diferenciadas.
- evaluacion_marco debe explicar criterios generales de evaluacion separados de las filas de rubrica.
- resources debe incluir soportes, herramientas, uso pedagogico y alternativas low-tech.

${subjectCanonNote}

Contexto del curso:
- Materia: ${courseRecord.subject}
- Ano: ${courseRecord.year_level}
- Escuela: ${courseRecord.schools?.official_name || "Sin escuela"}
- Tipo de escuela: ${courseRecord.schools?.school_type || "No especificado"}
- Orientacion: ${courseRecord.orientation || "No especificada"}
- Especialidad: ${courseRecord.speciality || "No especificada"}

Documento curricular:
- Titulo: ${curriculumDocument.official_title || curriculumDocument.subject}
- URL oficial: ${curriculumDocument.official_url || "No registrada"}

Texto fuente disponible (fragmento inicial):
${truncatedRawText || "No hay texto crudo cargado; usar los nodos curriculares como base principal."}

Nodos curriculares (contenido):
${nodeNames.join("\n")}

Bibliografia curricular detectada (${bibliographyNodeNames.length} referencias):
${bibliographyNodeNames.length > 0 ? bibliographyNodeNames.join("\n") : "No se detecto bibliografia curricular en el documento."}`;

    let aiPayload: Partial<BootstrapPayload> | null = null;
    try {
      const aiResponse = await callAI(lovableApiKey, [{ role: "user", content: prompt }]);
      aiPayload = JSON.parse(aiResponse.choices[0].message.content || "{}");
    } catch {
      aiPayload = null;
    }

    const normalized = normalizeBootstrapPayload(
      aiPayload,
      courseRecord.subject,
      nodePools.nodesForPrompt.map((node) => node.name),
      planLessons.length
    );

    await adminClient
      .from("plans")
      .update({
        status: targetPlanStatus as "EDITED" | "INCOMPLETE",
        fundamentacion: normalized.fundamentacion,
        estrategias_marco: normalized.estrategias_marco,
        estrategias_practicas: normalized.estrategias_practicas,
        evaluacion_marco: normalized.evaluacion_marco,
        resources: normalized.resources,
      })
      .eq("id", body.plan_id);

    await adminClient.from("plan_objectives").delete().eq("plan_id", body.plan_id);
    await adminClient.from("plan_content_mappings").delete().eq("plan_id", body.plan_id);
    await adminClient.from("plan_rubrics").delete().eq("plan_id", body.plan_id);
    await adminClient.from("plan_content_blocks").delete().eq("plan_id", body.plan_id);

    const objectiveRows = normalized.objectives.map((objective, index) => ({
      plan_id: body.plan_id!,
      description: objective,
      order_index: index,
    }));
    if (objectiveRows.length > 0) {
      await adminClient.from("plan_objectives").insert(objectiveRows);
    }

    const contentBlockRows = normalized.content_blocks.map((block, index) => ({
      plan_id: body.plan_id!,
      title: block.title,
      description: block.description,
      topics: block.topics,
      term: block.term,
      order_index: index,
    }));
    let contentBlockIdByTitle = new Map<string, string>();
    if (contentBlockRows.length > 0) {
      const { data: insertedBlocks, error: insertedBlocksError } = await adminClient
        .from("plan_content_blocks")
        .insert(contentBlockRows)
        .select("id, title");
      if (insertedBlocksError) throw insertedBlocksError;
      contentBlockIdByTitle = new Map(
        (insertedBlocks || []).map((row: { id: string; title: string }) => [normalizeKey(row.title), row.id])
      );
    }

    const rubricRows = normalized.rubrics
      .map((rubric, index) => {
        const contentBlockId = contentBlockIdByTitle.get(normalizeKey(rubric.content_block_title));
        if (!contentBlockId) return null;
        return {
          plan_id: body.plan_id!,
          content_block_id: contentBlockId,
          criterion_name: rubric.criterion_name,
          focus_note: rubric.focus_note,
          advanced_level: rubric.advanced_level,
          expected_level: rubric.expected_level,
          basic_level: rubric.basic_level,
          initial_level: rubric.initial_level,
          order_index: index,
        };
      })
      .filter(Boolean);
    if (rubricRows.length > 0) {
      const { error: rubricInsertError } = await adminClient.from("plan_rubrics").insert(rubricRows);
      if (rubricInsertError) throw rubricInsertError;
    }

    const mappingRows = nodePools.nodesForMappings.map((node, index: number) => ({
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
      mappingIdByNodeId = new Map(
        ((insertedMappings || []) as InsertedPlanContentMapping[]).map((row) => [row.curriculum_node_id, row.id])
      );
    }

    for (const lesson of normalized.lessons) {
      const flags = {
        is_integrative_evaluation: lesson.lesson_number === 13 || lesson.lesson_number === 27,
        is_recovery: lesson.lesson_number === 14 || lesson.lesson_number === 28,
      };

      await adminClient
        .from("plan_lessons")
        .update({
          content_block_id: contentBlockIdByTitle.get(normalizeKey(lesson.content_block_title)) || null,
          theme: lesson.theme,
          subtitle: lesson.subtitle,
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
      .in("plan_lesson_id", (planLessons as PlanLessonSummary[]).map((lesson) => lesson.id));

    if (nodePools.nodesForMappings.length > 0 && mappingIdByNodeId.size > 0) {
      const coreNodesForLinking = nodePools.coreNodes.filter((node) => mappingIdByNodeId.has(node.id));

      const linkRows = (planLessons as PlanLessonSummary[]).flatMap((lesson, index: number) => {
        const mappingIds = new Set<string>();

        if (coreNodesForLinking.length > 0) {
          const firstNode = coreNodesForLinking[index % coreNodesForLinking.length];
          const secondNode = coreNodesForLinking[(index + 1) % coreNodesForLinking.length];
          const firstMappingId = mappingIdByNodeId.get(firstNode.id);
          const secondMappingId = mappingIdByNodeId.get(secondNode.id);
          if (firstMappingId) mappingIds.add(firstMappingId);
          if (secondMappingId) mappingIds.add(secondMappingId);
        }

        if (mappingIds.size === 0) {
          const fallbackNode = nodePools.nodesForMappings[index % nodePools.nodesForMappings.length];
          const fallbackMappingId = mappingIdByNodeId.get(fallbackNode.id);
          if (fallbackMappingId) mappingIds.add(fallbackMappingId);
        }

        return Array.from(mappingIds).map((mappingId) => ({
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
        plan_status: targetPlanStatus,
        synthetic_nodes_created: syntheticNodesCreated,
        prompt_nodes_count: nodePools.nodesForPrompt.length,
        bibliography_nodes_count: nodePools.bibliographyNodes.length,
        objectives_count: objectiveRows.length,
        content_blocks_count: contentBlockRows.length,
        content_mappings_count: mappingRows.length,
        rubrics_count: rubricRows.length,
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
