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

const STORAGE_KEY = "aula-maestra.mock-course-curriculum.v1";

const MOCK_PROGRAMS: MockCurriculumProgram[] = [
  {
    id: "mock:pba:filosofia:upper:6",
    province: "PBA",
    subject: "Filosofía",
    cycle: "UPPER",
    year_level: 6,
    school_type: null,
    orientation: null,
    speciality: null,
    official_title: "Diseño Curricular para la Educación Secundaria. 6° año: Filosofía",
    official_url: null,
    source_provider: "LOCAL_FIXTURE",
    fetched_at: null,
  },
  {
    id: "mock:pba:fyhct:upper:6",
    province: "PBA",
    subject: "Filosofía e historia de la ciencia y la tecnología",
    cycle: "UPPER",
    year_level: 6,
    school_type: null,
    orientation: null,
    speciality: null,
    official_title: "Diseño Curricular para la Educación Secundaria. 6° año: Filosofía e historia de la ciencia y la tecnología",
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
    official_title: "Diseño Curricular para la Educación Secundaria. 5° año: Historia",
    official_url: null,
    source_provider: "LOCAL_FIXTURE",
    fetched_at: null,
  },
  {
    id: "mock:pba:matematica:upper:5",
    province: "PBA",
    subject: "Matemática",
    cycle: "UPPER",
    year_level: 5,
    school_type: null,
    orientation: null,
    speciality: null,
    official_title: "Diseño Curricular para la Educación Secundaria. 5° año: Matemática",
    official_url: null,
    source_provider: "LOCAL_FIXTURE",
    fetched_at: null,
  },
  {
    id: "mock:pba:matematica:upper:6",
    province: "PBA",
    subject: "Matemática",
    cycle: "UPPER",
    year_level: 6,
    school_type: null,
    orientation: null,
    speciality: null,
    official_title: "Diseño Curricular para la Educación Secundaria. 6° año: Matemática",
    official_url: null,
    source_provider: "LOCAL_FIXTURE",
    fetched_at: null,
  },
];

function getThemePool(subject: string): string[] {
  switch (subject) {
    case "Filosofía":
      return [
        "Introducción a la actividad filosófica",
        "Problemas clásicos de la filosofía",
        "Conocimiento, verdad y justificación",
        "Ética y vida social",
        "Filosofía política y ciudadanía",
        "Lenguaje, argumentación y crítica",
      ];
    case "Filosofía e historia de la ciencia y la tecnología":
      return [
        "Las teorías científicas",
        "Controversias científicas",
        "Métodos y validación",
        "Cambio y sucesión de teorías",
        "Tecnología y sociedad",
        "Ciencias formales, fácticas y sociales",
      ];
    case "Historia":
      return [
        "Procesos históricos y periodización",
        "Estado, sociedad y economía",
        "Conflictos y transformaciones",
        "Escalas de análisis histórico",
        "Fuentes y construcción del relato histórico",
        "Memoria, ciudadanía y debate público",
      ];
    default:
      return [
        "Números y relaciones",
        "Funciones y modelos",
        "Geometría y medida",
        "Probabilidad y estadística",
        "Resolución de problemas",
        "Modelización matemática",
      ];
  }
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
      program.subject === subject &&
      program.cycle === cycle &&
      program.year_level === yearLevel
  );
}

export function buildMockPlanDraft(subject: string): MockPlanDraft {
  const themePool = getThemePool(subject);

  return {
    fundamentacion:
      `Esta planificación de ${subject} se organiza como borrador de simulación local para validar el flujo completo de la aplicación sin depender del backend remoto. ` +
      `Toma como base el programa oficial seleccionado y lo traduce a una secuencia anual inicial, pensada para que el docente pueda revisar la progresión del curso, reconocer los ejes de trabajo y ajustar luego el plan según su escuela y su grupo. ` +
      `La propuesta privilegia continuidad, progresión y evidencia mínima por clase, evitando que el curso empiece vacío. ` +
      `La intención de este borrador es que el docente disponga desde el inicio de una estructura útil: fundamentación, objetivos, estrategias, evaluación y una distribución inicial de clases. ` +
      `No reemplaza la decisión profesional del docente, pero sí ordena el punto de partida para que la planificación resulte operativa y editable.`,
    estrategias_marco:
      "Se propone trabajo guiado con problemas, lectura orientada, producción escrita breve, discusión en clase y seguimiento continuo por evidencias.",
    estrategias_practicas: [
      "Lectura guiada con consignas de comprensión.",
      "Resolución de actividades con evidencia mínima.",
      "Puestas en común y revisión de producciones.",
    ],
    evaluacion_marco:
      "La evaluación se concibe como continua, formativa y basada en criterios explícitos. Se observarán comprensión conceptual, calidad de la producción, argumentación y transferencia.",
    resources:
      "Pizarrón, cuaderno o carpeta, materiales impresos, textos del curso y alternativas low-tech para cada actividad.",
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
        justification: `La clase ${index + 1} desarrolla un recorte del programa de ${subject} para sostener una progresión anual clara.`,
        learning_outcome: `Al finalizar la clase ${index + 1}, el estudiantado podrá explicar y trabajar el eje "${theme}".`,
        activities_summary: `Apertura breve, desarrollo guiado sobre "${theme}", producción de evidencia mínima y cierre con puesta en común.`,
      };
    }),
  };
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
