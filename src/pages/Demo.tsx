import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { StatusBadge, briefLabel, briefTone, materialLabel, materialTone } from "@/components/ui/StatusBadge";
import { toast } from "@/hooks/use-toast";
import { AlertTriangle } from "lucide-react";

// ─── CANONICAL MOCK DATA ────────────────────────────────────────────────────

const DEMO_PLAN = {
  fundamentacion: `El espacio curricular Filosofía e Historia de la Ciencia y la Tecnología en 6.º año de una EESA se fundamenta en una necesidad formativa concreta: en contextos donde se toman decisiones técnicas con impacto sanitario, ambiental, productivo y social, no alcanza con ejecutar procedimientos; es necesario comprender lo que se hace, justificar elecciones y responder por sus consecuencias. En este marco, la propuesta aporta un andamiaje para pensar críticamente las prácticas del taller, sostener criterios de calidad y discutir con razones en situaciones donde hay incertidumbre, tensiones entre objetivos y dilemas éticos.

Desde esta perspectiva, la Filosofía se entiende como una práctica de pensamiento orientada a problematizar, conceptualizar y argumentar. Problematizar implica convertir lo obvio en pregunta y detectar supuestos; conceptualizar supone precisar términos y construir definiciones operativas; argumentar exige sostener conclusiones con razones, evidencia y consideración de objeciones.

La organización anual se estructura alrededor de ejes problematizadores: (1) cómo surge y para qué sirve el preguntar filosófico; (2) qué cuenta como conocimiento válido y cómo se justifica una afirmación; (3) cómo se construye, valida y cambia el conocimiento científico; y (4) cómo se evalúan decisiones tecnológicas considerando valores, riesgos e impactos.

La propuesta didáctica prioriza una alfabetización argumentativa con apoyos y una articulación estable entre teoría y práctica. La evaluación se concibe como parte del enfoque: continua, formativa y basada en criterios explícitos, atendiendo procesos y productos. El propósito final es que el estudiantado disponga de lenguaje, criterios y responsabilidad para justificar elecciones técnicas, reconocer límites de la evidencia disponible y sostener decisiones profesionales en contextos reales.`,

  estrategias_marco: `Exposición dialogada y andamiaje con preguntas (problematizar, conceptualizar, argumentar). Lectura guiada con glosario, párrafos numerados y preguntas literal, inferencial y crítica. Trabajo con situaciones del taller como estudios de caso. Organización de la información: cuadros comparativos, redes y mapas conceptuales. Técnicas grupales (panel, mesa redonda, debate), resolución de problemas y revisión por pares.`,

  estrategias_practicas: [
    "Exposición dialogada con preguntas",
    "Lectura guiada con glosario y consignas",
    "Trabajo con situaciones del taller como estudios de caso",
    "Organización de la información: cuadros, redes, mapas conceptuales",
    "Técnicas grupales, resolución de problemas y revisión por pares",
  ],

  evaluacion_marco: `Evaluación continua, global y formativa, entendida como parte del proceso de aprendizaje y de la mejora de la argumentación y la toma de decisiones técnicas. Se evalúan procesos y productos con criterios explícitos, y se prevé una instancia de recuperación por cuatrimestre.

Instrumentos: producciones escritas y orales pautadas; análisis de casos; cuestionarios semiestructurados; trabajos de búsqueda con referencias completas; controles de carpeta; exposiciones orales; bitácoras y planillas de registro; dossier integrador y proyecto (C1); coevaluación y autoevaluación.

Rúbrica (criterios y niveles):
C1. Comprensión conceptual — Excelente (4): define con precisión, distingue con criterios, aplica conceptos a casos sin contradicciones. Satisfactorio (3): define y distingue en general; pequeñas imprecisiones. Básico (2): definiciones parciales; confunde categorías. Insuficiente (1): errores conceptuales persistentes.
C2. Evidencias y registro — Excelente (4): registra completo y ordenado; evidencia pertinente; fuentes claras. Satisfactorio (3): registro suficiente con vacíos menores. Básico (2): registro incompleto o desordenado. Insuficiente (1): sin registros o inválidos.
C3. Argumentación y comunicación — Excelente (4): tesis clara; razones sólidas; integra evidencia; considera objeciones. Satisfactorio (3): tesis y razones claras; objeción parcial. Básico (2): tesis débil; razones poco conectadas. Insuficiente (1): no hay argumento.
C4. Relación teoría–práctica — Excelente (4): transfiere con criterio; pondera impactos; propone mejoras. Satisfactorio (3): transfiere a casos con criterio explícito. Básico (2): transferencia limitada. Insuficiente (1): no vincula teoría con práctica.
C5. Trabajo y actitud — Excelente (4): participación sostenida; trabajo autónomo; cumple normas. Satisfactorio (3): participación regular. Básico (2): participación intermitente. Insuficiente (1): incumplimientos reiterados.

Ponderación sugerida: C1 20% · C2 20% · C3 25% · C4 25% · C5 10%.`,

  resources: `Infraestructura y equipamiento escolar: Pizarrón y marcadores/tizas. Aula con proyector o TV y sistema básico de audio. Conectividad: acceso a Wi-Fi institucional y alternativa sin conexión. Dispositivos disponibles: PC/notebook docente; disponibilidad eventual de dispositivos del alumnado. Impresiones y fotocopias para textos, consignas y planillas de registro.

Materiales didácticos y soportes: Textos y fragmentos de lectura (impresos y/o digitales) con glosario. Guías de actividades, plantillas (Tesis–Evidencia–Razón; matrices de impacto; cuadros comparativos). Carpeta/bitácora de clase y archivador de producciones. Recursos de representación: afiches, hojas A3/A4, fibrones, notas adhesivas.

Recursos para el trabajo con casos: Planillas de registro (tiempo/temperatura, pH, Brix, trazabilidad, checklists). Registro audiovisual (fotos breves) para documentar procesos. Material del taller y normativa/protocolos internos de seguridad e inocuidad.

Aportes posibles de docentes y alumnado: Dispositivos móviles para lectura/consulta puntual y registro. Insumos simples para dinámicas (cartulinas, marcadores, cinta, impresiones). Selección de noticias, notas o materiales de divulgación vinculados a ciencia, tecnología y ética.`,
};

const DEMO_OBJECTIVES = [
  "Diferenciarán saber cotidiano, técnico y científico en situaciones del entorno agro y explicarán sus criterios distintivos.",
  "Identificarán ejemplos de asombro, duda y situaciones límite en su experiencia y formularán preguntas filosóficas pertinentes.",
  "Formularán problemas e hipótesis operativas; identificarán controles y evidencias pertinentes; registrarán datos con claridad.",
  "Argumentarán por escrito y de forma oral en formatos breves usando la guía Tesis–Evidencia–Razón, incluyendo al menos una objeción y respuesta.",
  "Leerán Bunge, Klimovsky, Díaz, Sztajnszrajber y vincularán sus ideas con prácticas del taller.",
  "Aplicarán métodos (inducción e hipotético-deductivo) y reconocerán el papel de la comunidad científica y la revisión de teorías.",
  "Utilizarán matrices de impactos para valorar decisiones tecnológicas y propondrán mejoras factibles.",
  "Elaborarán bitácoras quincenales y un dossier integrador con coherencia, precisión y referencias.",
];

const DEMO_LESSONS: {
  id: string; num: number; theme: string; activities: string; term: number;
  brief: "IN_PROGRESS" | "READY_FOR_PRODUCTION" | "PRODUCED" | null;
  material: "GENERATED" | "VALIDATED" | "INVALIDATED" | null;
}[] = [
  { id: "1", num: 1, theme: "Concepto de Filosofía: qué es, para qué y cómo se practica", activities: "definición operativa (5-7 líneas) con ejemplo", term: 1, brief: "READY_FOR_PRODUCTION", material: "GENERATED" },
  { id: "2", num: 2, theme: "Origen: asombro, duda y situaciones límite", activities: "tres situaciones del curso + pregunta que abren", term: 1, brief: "PRODUCED", material: "VALIDATED" },
  { id: "3", num: 3, theme: "Del mito al logos: Sócrates, Platón, Aristóteles", activities: "cuadro comparativo mito/logos (6 ítems)", term: 1, brief: "IN_PROGRESS", material: null },
  { id: "4", num: 4, theme: "Ramas y problemas actuales situados (IA, bienestar animal, trazabilidad, privacidad)", activities: "mapa conceptual (rama ↔ problema ↔ pregunta)", term: 1, brief: null, material: null },
  { id: "5", num: 5, theme: "Ciencia: rasgos y contrastación; clasificación de ciencias", activities: "ficha con rasgos + ejemplo por tipo", term: 1, brief: null, material: null },
  { id: "6", num: 6, theme: "Tecnología: idea e historia; impactos; criterios de decisión", activities: "párrafo de fundamentación de decisión técnica", term: 1, brief: null, material: null },
  { id: "7", num: 7, theme: "Ciencia y tecnología en alimentos; normativas básicas y trazabilidad", activities: "esquema aplicado a proceso del taller", term: 1, brief: null, material: null },
  { id: "8", num: 8, theme: "Caso 1 (problema e hipótesis): variables y controles", activities: "problema + hipótesis (3-4 líneas) con variables/controles", term: 1, brief: null, material: null },
  { id: "9", num: 9, theme: "Caso 1 (controles y evidencia): indicadores y registros; Tesis–Evidencia–Razón", activities: "planilla completa + relación datos→conclusión", term: 1, brief: null, material: null },
  { id: "10", num: 10, theme: "Caso 1 (decisión técnica y ética): matriz de impactos; comunicación breve", activities: "matriz + texto 6-8 líneas", term: 1, brief: null, material: null },
  { id: "11", num: 11, theme: "Proyecto protocolo digital: diseño (riesgos, estructura)", activities: "borrador con responsables y criterios de éxito", term: 1, brief: null, material: null },
  { id: "12", num: 12, theme: "Proyecto: validación (simulación, ajustes)", activities: "versión revisada con observaciones", term: 1, brief: null, material: null },
  { id: "13", num: 13, theme: "Cierre C1 + preparación de recuperación: auto/co-evaluación con rúbrica", activities: "autoevaluación + plan de estudio", term: 1, brief: null, material: null },
  { id: "14", num: 14, theme: "Recuperación C1: actividades focalizadas", activities: "resolución de guía", term: 1, brief: null, material: null },
  { id: "15", num: 15, theme: "Lenguaje y explicación: ambigüedad/precisión + explicación técnica", activities: "reescritura + explicación clara (6-8 líneas)", term: 2, brief: "READY_FOR_PRODUCTION", material: "INVALIDATED" },
  { id: "16", num: 16, theme: "Razonamientos y falacias: inductivo/deductivo; corrección", activities: "identificar y corregir 2 falacias", term: 2, brief: null, material: null },
  { id: "17", num: 17, theme: "Mejora de informes: cohesión/coherencia; citas y referencias", activities: "versión mejorada con referencias completas", term: 2, brief: null, material: null },
  { id: "18", num: 18, theme: "Teorías y modelos: distinciones + ejemplo agro", activities: "esquema de modelo sencillo", term: 2, brief: null, material: null },
  { id: "19", num: 19, theme: "Kuhn: paradigmas y cambio", activities: "síntesis 8-10 líneas aplicada a caso breve", term: 2, brief: null, material: null },
  { id: "20", num: 20, theme: "Popper: falsación; prueba crítica en papel", activities: "propuesta de prueba + predicción", term: 2, brief: null, material: null },
  { id: "21", num: 21, theme: "Caso 2 (Darwin): teoría, evidencias y análisis", activities: "tabla teoría-evidencia-conclusión + transferencia", term: 2, brief: null, material: null },
  { id: "22", num: 22, theme: "Caso 3 (Pasteur-Pouchet): argumentos pro/contra", activities: "reconstrucción en dos columnas", term: 2, brief: null, material: null },
  { id: "23", num: 23, theme: "Métodos: inducción vs hipotético-deductivo", activities: "diagrama aplicado a ejemplo del curso", term: 2, brief: null, material: null },
  { id: "24", num: 24, theme: "Comunidad científica y revisión: pares/replicación/errores", activities: "criterios de revisión aplicados a miniinforme", term: 2, brief: null, material: null },
  { id: "25", num: 25, theme: "Ética investigación/tecnología: riesgos, bienestar animal, ambiente", activities: "matriz de impactos + recomendación", term: 2, brief: null, material: null },
  { id: "26", num: 26, theme: "Taller dossier integrador: estructura, fuentes, evidencias", activities: "esquema + plan de trabajo", term: 2, brief: null, material: null },
  { id: "27", num: 27, theme: "Presentación y retroalimentación: defensa breve + coevaluación", activities: "exposición 3-5 min + devolución escrita", term: 2, brief: null, material: null },
  { id: "28", num: 28, theme: "Recuperación C2: actividades focalizadas", activities: "guía de recuperación + cierre", term: 2, brief: null, material: null },
];

const DEMO_MATERIAL_HTML = `
<h2>Clase 1 — Concepto de Filosofía: qué es, para qué y cómo se practica</h2>
<p>La Filosofía es una práctica de pensamiento orientada a <strong>problematizar</strong>, <strong>conceptualizar</strong> y <strong>argumentar</strong>. No se trata de memorizar autores o fechas, sino de desarrollar herramientas para pensar mejor lo que hacemos.</p>
<h3>Problematizar</h3>
<p>Convertir lo obvio en pregunta. Detectar supuestos que damos por sentados. Ejemplo: "¿Por qué seguimos este protocolo y no otro? ¿Qué pasaría si cambiáramos una variable?"</p>
<h3>Conceptualizar</h3>
<p>Precisar términos y construir definiciones operativas. En el taller, esto significa poder decir con exactitud qué entendemos por "calidad", "inocuidad" o "trazabilidad".</p>
<h3>Argumentar</h3>
<p>Sostener conclusiones con razones, evidencia y consideración de objeciones. Usar la guía <strong>Tesis–Evidencia–Razón</strong> como herramienta básica.</p>
<h3>Actividad</h3>
<p>Escribir una definición operativa de Filosofía (5-7 líneas) que incluya un ejemplo concreto de su utilidad en el ámbito técnico-profesional.</p>
`;

// ─── COMPONENT ──────────────────────────────────────────────────────────────

export default function Demo() {
  const [planValidated, setPlanValidated] = useState(false);

  const handleValidateDemo = () => {
    setPlanValidated(true);
    toast({ title: "Plan validado (demo)", description: "En la app real, esto crearía las lecciones." });
  };

  const handleExportDemo = () => {
    toast({ title: "Exportación (demo)", description: "En la app real, se descargaría el PDF." });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Banner */}
      <div className="sticky top-0 z-50 flex items-center justify-between bg-warning/15 border-b border-warning/30 px-4 py-2">
        <div className="flex items-center gap-2 text-sm font-medium text-warning">
          <AlertTriangle className="h-4 w-4" />
          Modo demo — no se guarda nada
        </div>
        <Button size="sm" variant="outline" asChild>
          <Link to="/register">Crear cuenta para guardar</Link>
        </Button>
      </div>

      {/* Header */}
      <header className="border-b bg-card">
        <div className="mx-auto max-w-5xl px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-semibold text-foreground">Filosofía e Hist. de la Ciencia y la Tecnología · 6° año</h1>
              <p className="text-sm text-muted-foreground">EESA · 2026</p>
            </div>
            <StatusBadge tone={planValidated ? "success" : "warning"} label={planValidated ? "Validado" : "Incompleto"} />
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-5xl px-4 py-8">
        <Tabs defaultValue="fundamentacion">
          <TabsList className="grid w-full grid-cols-4 md:grid-cols-8">
            <TabsTrigger value="fundamentacion">Fundamentación</TabsTrigger>
            <TabsTrigger value="estrategias">Estrategias</TabsTrigger>
            <TabsTrigger value="evaluacion">Evaluación</TabsTrigger>
            <TabsTrigger value="objetivos">Objetivos (4-8)</TabsTrigger>
            <TabsTrigger value="recursos">Recursos</TabsTrigger>
            <TabsTrigger value="cronograma">Cronograma</TabsTrigger>
            <TabsTrigger value="materiales">Materiales</TabsTrigger>
            <TabsTrigger value="agenda">Agenda</TabsTrigger>
          </TabsList>

          {/* Tab: Fundamentación */}
          <TabsContent value="fundamentacion" className="space-y-4 pt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Fundamentación</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea value={DEMO_PLAN.fundamentacion} readOnly rows={12} />
                <p className="text-xs text-muted-foreground mt-1">{DEMO_PLAN.fundamentacion.length} caracteres</p>
              </CardContent>
            </Card>
            <Button onClick={handleValidateDemo} disabled={planValidated} className="w-full">
              {planValidated ? "✓ Plan validado (demo)" : "Validar plan (demo)"}
            </Button>
          </TabsContent>

          {/* Tab: Estrategias */}
          <TabsContent value="estrategias" className="space-y-4 pt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Estrategias Marco</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea value={DEMO_PLAN.estrategias_marco} readOnly rows={4} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Estrategias Prácticas</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {DEMO_PLAN.estrategias_practicas.map((s) => (
                    <Badge key={s} variant="secondary">{s}</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab: Evaluación */}
          <TabsContent value="evaluacion" className="space-y-4 pt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Evaluación Marco</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea value={DEMO_PLAN.evaluacion_marco} readOnly rows={18} />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab: Objetivos */}
          <TabsContent value="objetivos" className="pt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Objetivos de aprendizaje (8)</CardTitle>
              </CardHeader>
              <CardContent>
                <ol className="list-decimal list-inside space-y-2 text-sm text-foreground">
                  {DEMO_OBJECTIVES.map((obj, i) => (
                    <li key={i}>{obj}</li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab: Recursos */}
          <TabsContent value="recursos" className="pt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Recursos</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea value={DEMO_PLAN.resources} readOnly rows={12} />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab: Cronograma */}
          <TabsContent value="cronograma" className="pt-4">
            <Card>
              <CardContent className="pt-6">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-3 font-medium text-muted-foreground w-12">#</th>
                        <th className="text-left py-2 px-3 font-medium text-muted-foreground">Tema</th>
                        <th className="text-left py-2 px-3 font-medium text-muted-foreground">Actividades</th>
                        <th className="text-left py-2 px-3 font-medium text-muted-foreground w-16">C.</th>
                        <th className="text-left py-2 px-3 font-medium text-muted-foreground w-28">Brief</th>
                        <th className="text-left py-2 px-3 font-medium text-muted-foreground w-28">Material</th>
                      </tr>
                    </thead>
                    <tbody>
                      {DEMO_LESSONS.map((l) => (
                        <tr key={l.id} className="border-b last:border-0">
                          <td className="py-2 px-3 font-medium">{l.num}</td>
                          <td className="py-2 px-3">{l.theme}</td>
                          <td className="py-2 px-3 text-muted-foreground">{l.activities}</td>
                          <td className="py-2 px-3">C{l.term}</td>
                          <td className="py-2 px-3">
                            <StatusBadge tone={briefTone(l.brief)} label={briefLabel(l.brief)} />
                          </td>
                          <td className="py-2 px-3">
                            <StatusBadge tone={materialTone(l.material)} label={materialLabel(l.material)} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab: Materiales */}
          <TabsContent value="materiales" className="pt-4 space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Material de lectura — Clase 1</CardTitle>
                  <StatusBadge tone="success" label="Generado" />
                </div>
              </CardHeader>
              <CardContent>
                <div
                  className="prose prose-sm max-w-none text-foreground"
                  dangerouslySetInnerHTML={{ __html: DEMO_MATERIAL_HTML }}
                />
              </CardContent>
            </Card>
            <Button variant="outline" className="w-full" onClick={handleExportDemo}>
              Exportar PDF (demo)
            </Button>
          </TabsContent>

          {/* Tab: Agenda */}
          <TabsContent value="agenda" className="pt-4">
            <Card>
              <CardContent className="pt-6">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-3 font-medium text-muted-foreground w-12">#</th>
                        <th className="text-left py-2 px-3 font-medium text-muted-foreground">Tema</th>
                        <th className="text-left py-2 px-3 font-medium text-muted-foreground">Actividades</th>
                        <th className="text-left py-2 px-3 font-medium text-muted-foreground w-16">C.</th>
                        <th className="text-left py-2 px-3 font-medium text-muted-foreground w-28">Brief</th>
                      </tr>
                    </thead>
                    <tbody>
                      {DEMO_LESSONS.map((l) => (
                        <tr key={l.id} className="border-b last:border-0">
                          <td className="py-2 px-3 font-medium">{l.num}</td>
                          <td className="py-2 px-3">{l.theme}</td>
                          <td className="py-2 px-3 text-muted-foreground">{l.activities}</td>
                          <td className="py-2 px-3">C{l.term}</td>
                          <td className="py-2 px-3">
                            <StatusBadge tone={briefTone(l.brief)} label={briefLabel(l.brief)} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
