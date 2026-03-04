type SchoolType = "COMUN" | "TECNICA";
type Cycle = "BASIC" | "UPPER";

export interface MockCurriculumProgram {
  id: string;
  province: string;
  subject: string;
  cycle: Cycle;
  year_level: number;
  school_type: SchoolType | null;
  orientation: string | null;
  speciality: string | null;
  official_title: string;
  official_url: string | null;
  source_provider: "LOCAL_FIXTURE";
  fetched_at: string | null;
}

export interface MockPlanDraft {
  fundamentacion: string;
  estrategias_marco: string;
  estrategias_practicas: string[];
  evaluacion_marco: string;
  resources: string;
  objectives: string[];
  lessons: Array<{
    lesson_number: number;
    theme: string;
    justification: string;
    learning_outcome: string;
    activities_summary: string;
  }>;
}

type CanonLessonSeed = {
  theme: string;
  operation: string;
  evidence: string;
  justification: string;
  learning_outcome: string;
};

const STORAGE_KEY = "aula-maestra.mock-course-curriculum.v1";

const MOCK_PROGRAMS: MockCurriculumProgram[] = [
  {
    id: "mock:pba:filosofia:upper:6",
    province: "PBA",
    subject: "Filosofia",
    cycle: "UPPER",
    year_level: 6,
    school_type: null,
    orientation: null,
    speciality: null,
    official_title: "Diseno Curricular para la Educacion Secundaria. 6 ano: Filosofia",
    official_url: null,
    source_provider: "LOCAL_FIXTURE",
    fetched_at: null,
  },
  {
    id: "mock:pba:fyhct:upper:6",
    province: "PBA",
    subject: "Filosofia e historia de la ciencia y la tecnologia",
    cycle: "UPPER",
    year_level: 6,
    school_type: null,
    orientation: null,
    speciality: null,
    official_title:
      "Diseno Curricular para la Educacion Secundaria. 6 ano: Filosofia e historia de la ciencia y la tecnologia",
    official_url: null,
    source_provider: "LOCAL_FIXTURE",
    fetched_at: null,
  },
  {
    id: "mock:pba:historia:upper:5",
    province: "PBA",
    subject: "Historia",
    cycle: "UPPER",
    year_level: 5,
    school_type: null,
    orientation: null,
    speciality: null,
    official_title: "Diseno Curricular para la Educacion Secundaria. 5 ano: Historia",
    official_url: null,
    source_provider: "LOCAL_FIXTURE",
    fetched_at: null,
  },
  {
    id: "mock:pba:matematica:upper:5",
    province: "PBA",
    subject: "Matematica",
    cycle: "UPPER",
    year_level: 5,
    school_type: null,
    orientation: null,
    speciality: null,
    official_title: "Diseno Curricular para la Educacion Secundaria. 5 ano: Matematica",
    official_url: null,
    source_provider: "LOCAL_FIXTURE",
    fetched_at: null,
  },
  {
    id: "mock:pba:matematica:upper:6",
    province: "PBA",
    subject: "Matematica",
    cycle: "UPPER",
    year_level: 6,
    school_type: null,
    orientation: null,
    speciality: null,
    official_title: "Diseno Curricular para la Educacion Secundaria. 6 ano: Matematica",
    official_url: null,
    source_provider: "LOCAL_FIXTURE",
    fetched_at: null,
  },
];

const GOLDEN_FYHCT_6_EESA_LESSONS: CanonLessonSeed[] = [
  {
    theme: "Concepto de Filosofia y toma de decisiones",
    operation: "Instalar que la filosofia funciona como practica de problematizar, conceptualizar y argumentar sobre decisiones tecnicas reales del curso.",
    evidence: "Definicion operativa de filosofia en 5 a 7 lineas con un ejemplo del entorno agro.",
    justification: "Abre el ano con el criterio central de la materia y deja una base comun para leer ciencia, tecnologia y decisiones del taller.",
    learning_outcome: "Explican para que sirve el trabajo filosofico en decisiones tecnicas del curso y formulan una definicion operativa inicial.",
  },
  {
    theme: "Asombro, duda y situaciones limite",
    operation: "Reconstruir experiencias del grupo donde algo habitual del taller se vuelve pregunta rigurosa.",
    evidence: "Listado breve de tres situaciones del curso con la pregunta filosofica que abren.",
    justification: "Profundiza el origen del preguntar filosofico y conecta la materia con situaciones efectivas de la escuela.",
    learning_outcome: "Reconocen asombro, duda y situaciones limite en su experiencia y las convierten en preguntas pertinentes.",
  },
  {
    theme: "Del mito al logos",
    operation: "Comparar mito y logos con lectura guiada sobre Socrates, Platon y Aristoteles para distinguir modos de explicar.",
    evidence: "Cuadro comparativo mito versus logos con seis rasgos claros.",
    justification: "Da espesor historico al origen de la filosofia y prepara el trabajo posterior sobre conocimiento y justificacion.",
    learning_outcome: "Distinguen el pasaje del mito al logos y lo usan para comparar formas de saber.",
  },
  {
    theme: "Ramas y problemas actuales situados",
    operation: "Vincular ontologia, epistemologia, logica y etica con IA, bienestar animal, trazabilidad y privacidad.",
    evidence: "Mapa conceptual que una una rama filosofica con un problema actual y una pregunta del grupo.",
    justification: "Amplia el marco disciplinar sin perder situacion y deja visibles las preguntas que reapareceran en el resto del ano.",
    learning_outcome: "Relacionan ramas de la filosofia con problemas contemporaneos situados del contexto agro.",
  },
  {
    theme: "Rasgos del conocimiento cientifico",
    operation: "Precisar sistematicidad, contrastacion y falibilidad comparando ciencias naturales, sociales y formales.",
    evidence: "Ficha con rasgos del conocimiento cientifico y un ejemplo por tipo de ciencia.",
    justification: "Hace de puente entre filosofia y epistemologia de la ciencia para poder leer despues teorias, metodos y validacion.",
    learning_outcome: "Caracterizan que vuelve cientifico a un conocimiento y comparan tipos de ciencias con ejemplos del curso.",
  },
  {
    theme: "Tecnologia, historia e impactos",
    operation: "Analizar decisiones tecnicas atendiendo impactos sanitarios, ambientales y economicos.",
    evidence: "Parrafo de fundamentacion de una decision tecnica con criterios explicitos.",
    justification: "Introduce la dimension axiologica de la tecnologia y prepara la lectura situada de casos del taller.",
    learning_outcome: "Justifican una decision tecnica considerando criterios y consecuencias relevantes.",
  },
  {
    theme: "Ciencia y tecnologia en alimentos",
    operation: "Relacionar ciencia, tecnologia, normativas basicas y trazabilidad en procesos agroalimentarios escolares.",
    evidence: "Esquema de relaciones entre ciencia y tecnologia aplicado a un proceso del taller.",
    justification: "Organiza el pasaje hacia el trabajo por casos y vuelve visible la trama de criterios que sostiene una decision tecnica.",
    learning_outcome: "Explican como se coproducen ciencia y tecnologia en un proceso concreto del curso.",
  },
  {
    theme: "Caso 1: problema e hipotesis",
    operation: "Seleccionar un proceso del taller y formular problema, hipotesis operativa, variables y controles.",
    evidence: "Enunciado de problema e hipotesis operativa en 3 o 4 lineas con variables y controles.",
    justification: "Inicia el primer caso situado y convierte la teoria previa en una operacion concreta de indagacion.",
    learning_outcome: "Formulan un problema investigable y una hipotesis operativa con controles pertinentes.",
  },
  {
    theme: "Caso 1: controles y evidencia",
    operation: "Trabajar indicadores, registros y analisis Tesis-Evidencia-Razon sobre el caso elegido.",
    evidence: "Planilla de registro completada y una relacion explicita entre datos y conclusion.",
    justification: "Profundiza el caso con una lectura estricta de evidencias y fortalece el nexo entre registro y argumento.",
    learning_outcome: "Relacionan datos, registros y conclusiones usando una estructura argumentativa explicitada.",
  },
  {
    theme: "Caso 1: decision tecnica y etica",
    operation: "Ponderar impactos, comunicar una decision y justificarla con criterios sanitarios, ambientales y de responsabilidad.",
    evidence: "Matriz de impactos completa y texto breve de 6 a 8 lineas con la decision tomada.",
    justification: "Cierra el primer caso mostrando que la materia desemboca en decisiones tecnicas justificadas, no en opinion suelta.",
    learning_outcome: "Defienden una decision tecnica responsable a partir de evidencias y criterios explicitados.",
  },
  {
    theme: "Proyecto de protocolo digital: diseno",
    operation: "Disenar un protocolo de uso responsable de aplicaciones y datos para registro y trazabilidad.",
    evidence: "Borrador de protocolo con responsables, resguardos y criterios de exito.",
    justification: "Abre un proyecto aplicable a la escuela y conecta filosofia de la tecnologia con una produccion institucional concreta.",
    learning_outcome: "Proponen un protocolo inicial de uso de datos y trazabilidad con criterios claros.",
  },
  {
    theme: "Proyecto de protocolo digital: validacion",
    operation: "Simular el protocolo, revisar riesgos y ajustar responsables, pasos y criterios de resguardo.",
    evidence: "Version revisada del protocolo con observaciones incorporadas.",
    justification: "Consolida el proyecto del cuatrimestre y da una salida productiva a lo trabajado en clases anteriores.",
    learning_outcome: "Revisan un procedimiento y justifican mejoras sobre privacidad, seguridad y trazabilidad.",
  },
  {
    theme: "Cierre del primer cuatrimestre",
    operation: "Realizar autoevaluacion y coevaluacion con rubrica para identificar avances y puntos a reforzar.",
    evidence: "Autoevaluacion escrita y plan de estudio focalizado.",
    justification: "Funciona como integradora del primer tramo y organiza una recuperacion equivalente basada en evidencia.",
    learning_outcome: "Reconocen sus avances y definen prioridades de mejora con base en criterios compartidos.",
  },
  {
    theme: "Recuperacion del primer cuatrimestre",
    operation: "Resolver actividades focalizadas por criterio no alcanzado y reconstruir evidencias faltantes.",
    evidence: "Resolucion de la guia de recuperacion correspondiente.",
    justification: "Garantiza continuidad evaluativa y evita que el cierre del primer tramo sea un bloqueo sin salida pedagogica.",
    learning_outcome: "Recuperan aprendizajes del primer cuatrimestre mediante tareas equivalentes y focalizadas.",
  },
  {
    theme: "Lenguaje y explicacion tecnica",
    operation: "Trabajar ambiguedad, vaguedad y precision mediante reescritura de enunciados tecnicos y explicaciones breves.",
    evidence: "Reescritura de un enunciado ambiguo y elaboracion de una explicacion clara en 6 a 8 lineas.",
    justification: "Abre el segundo cuatrimestre con herramientas de lenguaje necesarias para mejorar informes, argumentos y comunicaciones.",
    learning_outcome: "Mejoran la precision conceptual y redactan explicaciones tecnicas mas claras.",
  },
  {
    theme: "Razonamientos y falacias",
    operation: "Distinguir razonamientos inductivos y deductivos e identificar errores argumentativos frecuentes en comunicacion tecnica.",
    evidence: "Identificacion y correccion de dos falacias en ejemplos provistos.",
    justification: "Sostiene la alfabetizacion argumentativa y prepara el trabajo de mejora de informes y evaluacion de teorias.",
    learning_outcome: "Reconocen estructuras de razonamiento y corrigen falacias en producciones tecnicas breves.",
  },
  {
    theme: "Mejora de informes",
    operation: "Reescribir un informe breve fortaleciendo cohesion, coherencia, citas y referencias completas.",
    evidence: "Version mejorada de un informe breve con referencias completas.",
    justification: "Convierte lenguaje y argumentacion en una produccion profesionalizable, util para el dossier integrador.",
    learning_outcome: "Revisan informes con criterios de claridad, coherencia y uso responsable de fuentes.",
  },
  {
    theme: "Teorias y modelos",
    operation: "Distinguir hipotesis, leyes, teorias y modelos aplicando esas diferencias a ejemplos del entorno agro.",
    evidence: "Esquema de modelo sencillo aplicado a un proceso conocido.",
    justification: "Abre el bloque de filosofia de la ciencia con una base conceptual necesaria para leer cambio teorico y metodos.",
    learning_outcome: "Explican diferencias entre hipotesis, ley, teoria y modelo mediante un caso cercano.",
  },
  {
    theme: "Kuhn y cambio cientifico",
    operation: "Leer ciencia normal, anomalias, crisis y revolucion cientifica y aplicar esos conceptos a un caso breve.",
    evidence: "Sintesis de 8 a 10 lineas que aplique los conceptos a un caso acotado.",
    justification: "Introduce una teoria fuerte sobre cambio cientifico y prepara el contraste con Popper.",
    learning_outcome: "Usan categorias de Kuhn para interpretar cambios en la ciencia a partir de un ejemplo.",
  },
  {
    theme: "Popper y prueba critica",
    operation: "Trabajar falsacion y conjeturas-refutaciones mediante el diseno en papel de una prueba critica.",
    evidence: "Propuesta de prueba critica y prediccion esperada.",
    justification: "Profundiza el problema de validacion y conecta epistemologia con decisiones metodologicas observables.",
    learning_outcome: "Disenan una prueba critica posible y explican que refutaria o tensionaria una hipotesis.",
  },
  {
    theme: "Caso 2: Darwin",
    operation: "Analizar teoria de seleccion natural, evidencias historicas y transferencia metodologica al entorno escolar.",
    evidence: "Tabla teoria-evidencia-conclusion con una transferencia al entorno del curso.",
    justification: "Ofrece un caso historico fuerte para pensar evidencia, teoria y cambio cientifico sin salir del enfoque curricular.",
    learning_outcome: "Relacionan teoria, evidencias y conclusion en un caso historico relevante para la materia.",
  },
  {
    theme: "Caso 3: Pasteur y Pouchet",
    operation: "Reconstruir argumentos a favor y en contra en torno a biogenesis y generacion espontanea.",
    evidence: "Reconstruccion del argumento a favor y en contra en dos columnas.",
    justification: "Completa el bloque de casos historicos y refuerza la lectura critica de controversias y validacion.",
    learning_outcome: "Comparan argumentos contrapuestos y explicitan que cuenta como evidencia en una controversia cientifica.",
  },
  {
    theme: "Metodos: induccion e hipotetico-deductivo",
    operation: "Representar esquemas, alcances y limites de ambos metodos y reconocerlos en ejemplos del curso.",
    evidence: "Diagrama del metodo aplicado a un ejemplo del curso.",
    justification: "Integra teoria metodologica con ejemplos cercanos para que el curso no quede en formulaciones abstractas.",
    learning_outcome: "Distinguen metodos de trabajo cientifico y los aplican a situaciones concretas del entorno escolar.",
  },
  {
    theme: "Comunidad cientifica y revision",
    operation: "Trabajar revision por pares, replicacion, correccion de errores y autoria con un miniinforme.",
    evidence: "Lista de criterios de revision aplicada a un miniinforme.",
    justification: "Introduce la dimension social e institucional de la ciencia y fortalece el uso de criterios publicos de evaluacion.",
    learning_outcome: "Explican como la comunidad cientifica valida, corrige y distribuye responsabilidades.",
  },
  {
    theme: "Etica de la investigacion y de la tecnologia",
    operation: "Valorar riesgos, consentimiento, bienestar animal y ambiente mediante una matriz de impactos.",
    evidence: "Matriz de impactos con una recomendacion justificada.",
    justification: "Recupera la dimension etica de la materia y la conecta con decisiones de intervencion concretas.",
    learning_outcome: "Argumentan recomendaciones responsables frente a riesgos e impactos de investigacion y tecnologia.",
  },
  {
    theme: "Taller de dossier integrador",
    operation: "Definir estructura, fuentes, evidencias y reparto de trabajo para el dossier integrador del curso.",
    evidence: "Esquema del dossier y plan de trabajo del equipo.",
    justification: "Prepara la salida integradora del ano y articula bibliografia, casos y evidencias previas en una produccion mayor.",
    learning_outcome: "Organizan un producto integrador con criterios de coherencia, fuentes y responsabilidades.",
  },
  {
    theme: "Presentacion y retroalimentacion",
    operation: "Exponer el dossier, defender decisiones y realizar coevaluacion con rubrica.",
    evidence: "Presentacion breve de 3 a 5 minutos y devolucion escrita a otro equipo.",
    justification: "Funciona como instancia integradora final donde se vuelve visible la coherencia del recorrido anual.",
    learning_outcome: "Comunican su trabajo, justifican decisiones y elaboran devoluciones utiles para otros equipos.",
  },
  {
    theme: "Recuperacion del segundo cuatrimestre",
    operation: "Resolver actividades focalizadas por criterio no alcanzado y cerrar el banco de evidencias del curso.",
    evidence: "Resolucion de la guia de recuperacion y cierre de evidencias.",
    justification: "Cierra el ano con recuperacion equivalente y garantiza que el recorrido final siga siendo verificable y editable.",
    learning_outcome: "Recuperan aprendizajes del segundo cuatrimestre con actividades equivalentes y bien focalizadas.",
  },
];

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

function buildActivitiesSummary(operation: string, evidence: string): string {
  return `Operacion: ${operation} Evidencia minima: ${evidence}`;
}

function getThemePool(subject: string): string[] {
  switch (normalizeKey(subject)) {
    case "filosofia":
      return [
        "Introduccion a la actividad filosofica",
        "Problemas clasicos de la filosofia",
        "Conocimiento, verdad y justificacion",
        "Etica y vida social",
        "Filosofia politica y ciudadania",
        "Lenguaje, argumentacion y critica",
      ];
    case "historia":
      return [
        "Procesos historicos y periodizacion",
        "Estado, sociedad y economia",
        "Conflictos y transformaciones",
        "Escalas de analisis historico",
        "Fuentes y construccion del relato historico",
        "Memoria, ciudadania y debate publico",
      ];
    default:
      return [
        "Numeros y relaciones",
        "Funciones y modelos",
        "Geometria y medida",
        "Probabilidad y estadistica",
        "Resolucion de problemas",
        "Modelizacion matematica",
      ];
  }
}

function buildGoldenFyHctDraft(): MockPlanDraft {
  return {
    fundamentacion:
      "Esta version local toma como referencia dorada la planificacion anual de Filosofia e historia de la ciencia y la tecnologia para 6 ano de una EESA. No intenta reemplazar el criterio docente ni inventar una materia generica: traduce un canon ya aceptado en la maqueta para que el flujo completo pueda probarse aun sin backend remoto. La anual se entiende como un instrumento de trabajo vivo, con progresion clara, casos situados, producciones verificables y salida directa hacia secuencias, clases y materiales de lectura." +
      " La propuesta se organiza alrededor de una idea fuerte: en contextos agrotecnicos no alcanza con ejecutar procedimientos, tambien hace falta justificar decisiones, leer evidencias, reconocer limites de metodos y responder por impactos sanitarios, ambientales y sociales. Por eso cada clase combina foco, operacion didactica y evidencia minima visible." +
      " El borrador local conserva esa estructura para que la app no caiga en una lista de temas sueltos. El curso avanza desde la instalacion del problema filosofico y epistemologico hacia casos concretos del taller, discusiones sobre teoria, validacion y cambio cientifico, y un cierre integrador mediante dossier, presentacion y recuperacion equivalente. La intencion es que el docente vea una agenda anual util, con continuidad y trazabilidad, incluso en modo demo o en pruebas sin persistencia real.",
    estrategias_marco:
      "Se propone una alfabetizacion argumentativa situada, articulada con casos del entorno agro, lectura guiada, producciones breves, registros de evidencias, revision entre pares y cierres con justificacion tecnica y etica.",
    estrategias_practicas: [
      "Lectura guiada con glosario, preguntas de comprension y aplicacion a situaciones del curso.",
      "Trabajo con casos del taller mediante problema, hipotesis, controles, evidencia y decision.",
      "Producciones breves con estructuras explicitas como Tesis-Evidencia-Razon, matrices de impactos e informes revisados.",
      "Alternativas low-tech con carpeta, registros impresos y materiales no perecederos para sostener continuidad.",
    ],
    evaluacion_marco:
      "La evaluacion se concibe como continua, global y formativa. Se observan comprension conceptual, evidencias y registros, argumentacion y comunicacion, relacion teoria-practica y calidad del trabajo sostenido. Se incluyen autoevaluacion, coevaluacion y recuperacion equivalente por cuatrimestre.",
    resources:
      "Pizarron, carpeta o cuaderno, impresos con glosario y lecturas breves, planillas de registro, fotografias o descripciones de casos del taller, proyector o TV segun disponibilidad y alternativa low-tech para cada actividad.",
    objectives: [
      "Diferenciar saber cotidiano, tecnico y cientifico en situaciones del entorno agro con criterios explicitos.",
      "Formular problemas, hipotesis operativas, controles y evidencias en casos del curso.",
      "Argumentar decisiones tecnicas mediante Tesis-Evidencia-Razon y matrices de impactos.",
      "Analizar teoria, metodos y cambio cientifico a partir de casos historicos y del entorno escolar.",
      "Mejorar informes, explicaciones y registros con vocabulario disciplinar y referencias claras.",
      "Construir un dossier integrador que deje trazabilidad entre bibliografia, casos y evidencias del ano.",
    ],
    lessons: GOLDEN_FYHCT_6_EESA_LESSONS.map((lesson, index) => ({
      lesson_number: index + 1,
      theme: lesson.theme,
      justification: lesson.justification,
      learning_outcome: lesson.learning_outcome,
      activities_summary: buildActivitiesSummary(lesson.operation, lesson.evidence),
    })),
  };
}

function buildGenericDraft(subject: string): MockPlanDraft {
  const themePool = getThemePool(subject);

  return {
    fundamentacion:
      `Esta planificacion de ${subject} se organiza como borrador de simulacion local para validar el flujo completo de la aplicacion sin depender del backend remoto. ` +
      `Toma como base el programa oficial seleccionado y lo traduce a una secuencia anual inicial, pensada para que el docente pueda revisar la progresion del curso, reconocer los ejes de trabajo y ajustar luego el plan segun su escuela y su grupo. ` +
      `La propuesta privilegia continuidad, progresion y evidencia minima por clase, evitando que el curso empiece vacio. ` +
      `La intencion de este borrador es que el docente disponga desde el inicio de una estructura util: fundamentacion, objetivos, estrategias, evaluacion y una distribucion inicial de clases. ` +
      `No reemplaza la decision profesional del docente, pero si ordena el punto de partida para que la planificacion resulte operativa y editable.`,
    estrategias_marco:
      "Se propone trabajo guiado con problemas, lectura orientada, produccion escrita breve, discusion en clase y seguimiento continuo por evidencias.",
    estrategias_practicas: [
      "Lectura guiada con consignas de comprension.",
      "Resolucion de actividades con evidencia minima.",
      "Puestas en comun y revision de producciones.",
    ],
    evaluacion_marco:
      "La evaluacion se concibe como continua, formativa y basada en criterios explicitos. Se observaran comprension conceptual, calidad de la produccion, argumentacion y transferencia.",
    resources:
      "Pizarron, cuaderno o carpeta, materiales impresos, textos del curso y alternativas low-tech para cada actividad.",
    objectives: [
      `Reconocer los ejes centrales de ${subject} en el programa anual.`,
      "Desarrollar producciones breves con criterios de claridad y pertinencia.",
      "Relacionar contenidos del curso con situaciones de aula y del entorno.",
      "Construir argumentos y explicaciones con vocabulario disciplinar.",
      "Sostener un recorrido progresivo con registro de evidencias.",
    ],
    lessons: Array.from({ length: 28 }, (_, index) => {
      const theme = themePool[index % themePool.length];
      return {
        lesson_number: index + 1,
        theme,
        justification: `La clase ${index + 1} desarrolla un recorte del programa de ${subject} para sostener una progresion anual clara.`,
        learning_outcome: `Al finalizar la clase ${index + 1}, el estudiantado podra explicar y trabajar el eje "${theme}".`,
        activities_summary: buildActivitiesSummary(
          `Apertura breve y desarrollo guiado sobre "${theme}".`,
          `Produccion breve verificable y puesta en comun final sobre "${theme}".`
        ),
      };
    }),
  };
}

export function getMockProgramsForProvince(province: string): MockCurriculumProgram[] {
  return MOCK_PROGRAMS.filter((program) => program.province === province);
}

export function resolveMockProgram(
  province: string,
  subject: string,
  cycle: Cycle,
  yearLevel: number
): MockCurriculumProgram[] {
  return MOCK_PROGRAMS.filter(
    (program) =>
      program.province === province &&
      normalizeKey(program.subject) === normalizeKey(subject) &&
      program.cycle === cycle &&
      program.year_level === yearLevel
  );
}

export function buildMockPlanDraft(subject: string): MockPlanDraft {
  if (isFyHctSubject(subject)) {
    return buildGoldenFyHctDraft();
  }

  return buildGenericDraft(subject);
}

function readStorage(): Record<string, MockCurriculumProgram> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeStorage(value: Record<string, MockCurriculumProgram>) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
}

export function saveMockCurriculumForCourse(courseId: string, program: MockCurriculumProgram) {
  const current = readStorage();
  current[courseId] = program;
  writeStorage(current);
}

export function getMockCurriculumForCourse(courseId: string): MockCurriculumProgram | null {
  return readStorage()[courseId] || null;
}

export function clearMockCurriculumForCourse(courseId: string) {
  const current = readStorage();
  if (current[courseId]) {
    delete current[courseId];
    writeStorage(current);
  }
}
