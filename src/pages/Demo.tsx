import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { AlertTriangle, Eye } from "lucide-react";

// ─── AGENDA DATA (28 clases del cronograma canon) ──────────────────────────

const AGENDA: { num: number; theme: string }[] = [
  { num: 1, theme: "Concepto de Filosofía: qué es, para qué y cómo se practica; vínculo con toma de decisiones." },
  { num: 2, theme: "Origen: asombro, duda y situaciones límite." },
  { num: 3, theme: "Del mito al logos: Sócrates, Platón, Aristóteles." },
  { num: 4, theme: "Ramas y problemas actuales situados: IA, bienestar animal, trazabilidad, privacidad." },
  { num: 5, theme: "Ciencia: rasgos y contrastación; clasificación de ciencias." },
  { num: 6, theme: "Tecnología: idea e historia; impactos; criterios de decisión." },
  { num: 7, theme: "Ciencia y tecnología en alimentos: normativas básicas y trazabilidad." },
  { num: 8, theme: "Caso 1 (problema e hipótesis): variables y controles." },
  { num: 9, theme: "Caso 1 (controles y evidencia): indicadores y registros; Tesis–Evidencia–Razón." },
  { num: 10, theme: "Caso 1 (decisión técnica y ética): matriz de impactos; comunicación breve." },
  { num: 11, theme: "Proyecto protocolo digital: diseño (riesgos, estructura)." },
  { num: 12, theme: "Proyecto: validación (simulación, ajustes)." },
  { num: 13, theme: "Cierre C1 + preparación de recuperación: auto/co-evaluación con rúbrica." },
  { num: 14, theme: "Recuperación C1: actividades focalizadas." },
  { num: 15, theme: "Lenguaje y explicación: ambigüedad/precisión + explicación técnica." },
  { num: 16, theme: "Razonamientos y falacias: inductivo/deductivo; corrección." },
  { num: 17, theme: "Mejora de informes: cohesión/coherencia; citas y referencias." },
  { num: 18, theme: "Teorías y modelos: distinciones + ejemplo agro." },
  { num: 19, theme: "Kuhn: paradigmas y cambio." },
  { num: 20, theme: "Popper: falsación; prueba crítica en papel." },
  { num: 21, theme: "Caso 2 (Darwin): teoría, evidencias y análisis." },
  { num: 22, theme: "Caso 3 (Pasteur–Pouchet): argumentos pro/contra." },
  { num: 23, theme: "Métodos: inducción vs hipotético-deductivo." },
  { num: 24, theme: "Comunidad científica y revisión: pares/replicación/errores." },
  { num: 25, theme: "Ética investigación/tecnología: riesgos, bienestar animal, ambiente." },
  { num: 26, theme: "Taller dossier integrador: estructura, fuentes, evidencias." },
  { num: 27, theme: "Presentación y retroalimentación: defensa breve + coevaluación." },
  { num: 28, theme: "Recuperación C2: actividades focalizadas." },
];

const DEVELOPED = new Set([15, 16, 17, 20]);

// ─── COMPONENT ──────────────────────────────────────────────────────────────

export default function Demo() {
  const [activeTab, setActiveTab] = useState("planificacion");
  const [undevelopedNotice, setUndevelopedNotice] = useState<number | null>(null);

  const handleVerClase = (num: number) => {
    if ([15, 16, 17].includes(num)) {
      setActiveTab("secuencia");
      setUndevelopedNotice(null);
      setTimeout(() => {
        document.getElementById(`clase-${num}`)?.scrollIntoView({ behavior: "smooth" });
      }, 150);
    } else if (num === 20) {
      setActiveTab("clase");
      setUndevelopedNotice(null);
    } else {
      setActiveTab("clase");
      setUndevelopedNotice(num);
    }
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
        <div className="mx-auto max-w-4xl px-4 py-4">
          <h1 className="text-lg font-semibold text-foreground">Filosofía e Historia de la Ciencia y la Tecnología — 6.º año EESA</h1>
          <p className="text-sm text-muted-foreground">Provincia de Buenos Aires · 2 módulos semanales</p>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-4xl px-4 py-8">
        <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); if (v !== "clase") setUndevelopedNotice(null); }}>
          <TabsList className="grid w-full grid-cols-2 md:grid-cols-4">
            <TabsTrigger value="planificacion">Planificación</TabsTrigger>
            <TabsTrigger value="secuencia">Secuencia</TabsTrigger>
            <TabsTrigger value="clase">Preparar clase</TabsTrigger>
            <TabsTrigger value="agenda">Agenda</TabsTrigger>
          </TabsList>

          {/* ═══ TAB A: PLANIFICACIÓN ═══ */}
          <TabsContent value="planificacion" className="space-y-4 pt-4">
            <TabPlanificacion />
          </TabsContent>

          {/* ═══ TAB B: SECUENCIA ═══ */}
          <TabsContent value="secuencia" className="space-y-4 pt-4">
            <TabSecuencia />
          </TabsContent>

          {/* ═══ TAB C: PREPARAR CLASE ═══ */}
          <TabsContent value="clase" className="space-y-4 pt-4">
            {undevelopedNotice !== null && (
              <Card className="border-warning/50 bg-warning/10">
                <CardContent className="pt-6">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-warning">Clase {undevelopedNotice} no está desarrollada en este demo.</p>
                      <p className="text-sm text-muted-foreground mt-1">Solo se incluyen las clases 15, 16, 17 y 20.</p>
                    </div>
                    <Button size="sm" variant="ghost" className="ml-auto shrink-0" onClick={() => setUndevelopedNotice(null)}>✕</Button>
                  </div>
                </CardContent>
              </Card>
            )}
            <TabClase20 />
          </TabsContent>

          {/* ═══ TAB D: AGENDA ═══ */}
          <TabsContent value="agenda" className="pt-4">
            <Card>
              <CardContent className="pt-6">
                {/* Header row */}
                <div className="grid grid-cols-[2rem_1fr_auto_auto] gap-3 items-center pb-2 border-b mb-1">
                  <span className="text-xs font-medium text-muted-foreground">N°</span>
                  <span className="text-xs font-medium text-muted-foreground">Tema</span>
                  <span className="text-xs font-medium text-muted-foreground">Estado</span>
                  <span className="text-xs font-medium text-muted-foreground">Acción</span>
                </div>
                {AGENDA.map((l) => (
                  <div key={l.num} className="grid grid-cols-[2rem_1fr_auto_auto] gap-3 items-center py-2 border-b last:border-0">
                    <span className="text-sm font-medium">{l.num}</span>
                    <span className="text-sm">{l.theme}</span>
                    <StatusBadge
                      tone={DEVELOPED.has(l.num) ? "success" : "neutral"}
                      label={DEVELOPED.has(l.num) ? "Desarrollada" : "No desarrollada"}
                    />
                    <Button size="sm" variant="ghost" onClick={() => handleVerClase(l.num)} className="gap-1">
                      <Eye className="h-3.5 w-3.5" />
                      Ver clase
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// TAB A — PLANIFICACIÓN (contenido literal del canon)
// ════════════════════════════════════════════════════════════════════════════

function TabPlanificacion() {
  return (
    <>
      {/* Fundamentación */}
      <Card>
        <CardHeader><CardTitle className="text-base">Fundamentación</CardTitle></CardHeader>
        <CardContent className="prose prose-sm max-w-none text-foreground space-y-3">
          <p>El espacio curricular Filosofía e Historia de la Ciencia y la Tecnología en 6.º año de una EESA se fundamenta en una necesidad formativa concreta: en contextos donde se toman decisiones técnicas con impacto sanitario, ambiental, productivo y social, no alcanza con ejecutar procedimientos; es necesario comprender lo que se hace, justificar elecciones y responder por sus consecuencias. En este marco, la propuesta aporta un andamiaje para pensar críticamente las prácticas del taller, sostener criterios de calidad y discutir con razones en situaciones donde hay incertidumbre, tensiones entre objetivos y dilemas éticos.</p>
          <p>Desde esta perspectiva, la Filosofía se entiende como una práctica de pensamiento orientada a problematizar, conceptualizar y argumentar. Problematizar implica convertir lo obvio en pregunta y detectar supuestos; conceptualizar supone precisar términos y construir definiciones operativas; argumentar exige sostener conclusiones con razones, evidencia y consideración de objeciones. Este enfoque no presenta la Filosofía como "teoría externa" al hacer técnico, sino como un modo de clarificar criterios y fortalecer decisiones en procesos reales.</p>
          <p>La organización anual se estructura alrededor de ejes problematizadores que atraviesan contenidos y actividades:</p>
          <ol className="list-decimal list-inside space-y-1">
            <li>cómo surge y para qué sirve el preguntar filosófico (asombro, duda y situaciones límite; del mito al logos);</li>
            <li>qué cuenta como conocimiento válido y cómo se justifica una afirmación (epistemología, evidencias, criterios de verdad y de justificación);</li>
            <li>cómo se construye, valida y cambia el conocimiento científico (métodos, teorías, comunidades científicas, cambio de paradigmas);</li>
            <li>cómo se evalúan decisiones tecnológicas considerando valores, riesgos e impactos (ética, responsabilidad, bienestar animal, ambiente, privacidad y trazabilidad).</li>
          </ol>
          <p>En una escuela agrotécnica, estos ejes se vuelven significativos al trabajar con situaciones situadas del taller y del entorno productivo. Procesos como la elaboración de dulces y chacinados, el manejo ovino, el control de agua de proceso, la inocuidad, la trazabilidad y los registros de calidad permiten construir estudios de caso donde se explicitan problemas, hipótesis, controles, evidencias y decisiones. A la vez, estas situaciones hacen visibles "situaciones límite" de la práctica: condiciones de riesgo, límites de los protocolos, tensiones entre costo y calidad, exigencias normativas y responsabilidades sobre personas, animales y territorios.</p>
          <p>La propuesta didáctica prioriza una alfabetización argumentativa con apoyos y una articulación estable entre teoría y práctica. Se trabaja con lecturas guiadas (glosario y consignas), producción oral y escrita en formatos breves y controlados, análisis de casos con registros (planillas, descripciones, fotografías), y revisión por pares. Se presenta la ciencia como empresa humana e histórica, falible y autocorrectiva, y la tecnología como intervención social con efectos materiales y normativos, de modo que el estudiantado pueda reconocer alcances y límites de métodos, modelos y decisiones.</p>
          <p>La evaluación se concibe como parte del enfoque: continua, formativa y basada en criterios explícitos, atendiendo procesos y productos. Se valora la comprensión conceptual, el uso de evidencias y registros claros, la calidad de la argumentación y la relación teoría–práctica en decisiones técnicas. Se prevén instancias de mejora y recuperación por cuatrimestre para que el error funcione como insumo de aprendizaje. El propósito final es que el estudiantado disponga de lenguaje, criterios y responsabilidad para justificar elecciones técnicas, reconocer límites de la evidencia disponible y sostener decisiones profesionales en contextos reales.</p>
        </CardContent>
      </Card>

      {/* Objetivos generales */}
      <Card>
        <CardHeader><CardTitle className="text-base">Objetivos generales</CardTitle></CardHeader>
        <CardContent>
          <ul className="list-disc list-inside space-y-1 text-sm">
            <li>Comprenderán la Filosofía como práctica de problematizar, conceptualizar y argumentar, diferenciándola de la ciencia y la técnica.</li>
            <li>Comprenderán el origen de la Filosofía en el asombro, la duda y las situaciones límite, y su proyección en la lectura de la realidad.</li>
            <li>Reconocerán qué cuenta como conocimiento y cómo se justifican decisiones en contextos reales del entorno agro.</li>
            <li>Analizarán la relación teoría–práctica, vinculando conceptos con procedimientos y criterios de control de procesos.</li>
            <li>Fortalecerán la lectura y la escritura académica breve (resumen, explicación, fundamentación) con vocabulario preciso.</li>
            <li>Compararán saberes (cotidiano, técnico y científico) y enfoques (filosófico, científico y técnico) en situaciones concretas.</li>
            <li>Desarrollarán desempeño individual: autonomía para planificar, producir y revisar trabajos con base en criterios explícitos.</li>
            <li>Aplicarán conceptos, ideas y razones para construir y evaluar argumentos, atendiendo objeciones y contraejemplos.</li>
            <li>Asumirán actitudes de responsabilidad y rigor: uso honesto de fuentes, registro claro de datos y respeto por normas sanitarias y ambientales.</li>
            <li>Valorarán la comunidad de discusión como ámbito de aprendizaje colaborativo, escuchando y mejorando a partir de la retroalimentación.</li>
            <li>Integrarán decisiones ético‑técnicas ponderando impactos en personas, animales y territorios.</li>
          </ul>
        </CardContent>
      </Card>

      {/* Objetivos de aprendizaje */}
      <Card>
        <CardHeader><CardTitle className="text-base">Objetivos de aprendizaje</CardTitle></CardHeader>
        <CardContent>
          <ul className="list-disc list-inside space-y-1 text-sm">
            <li>Diferenciarán saber cotidiano, técnico y científico en situaciones del entorno agro y explicarán sus criterios distintivos.</li>
            <li>Identificarán ejemplos de asombro, duda y situaciones límite en su experiencia y formularán preguntas filosóficas pertinentes.</li>
            <li>Formularán problemas e hipótesis operativas; identificarán controles y evidencias pertinentes; registrarán datos con claridad.</li>
            <li>Argumentarán por escrito y de forma oral en formatos breves usando la guía Tesis–Evidencia–Razón, incluyendo al menos una objeción y respuesta.</li>
            <li>Leerán Bunge, Klimovsky, Díaz, Sztajnszrajber y vincularán sus ideas con prácticas del taller.</li>
            <li>Aplicarán métodos (inducción e hipotético‑deductivo) y reconocerán el papel de la comunidad científica y la revisión de teorías.</li>
            <li>Utilizarán matrices de impactos para valorar decisiones tecnológicas y propondrán mejoras factibles.</li>
            <li>Elaborarán bitácoras quincenales y un dossier integrador con coherencia, precisión y referencias.</li>
          </ul>
        </CardContent>
      </Card>

      {/* Contenidos */}
      <Card>
        <CardHeader><CardTitle className="text-base">Contenidos</CardTitle></CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div>
            <h3 className="font-semibold text-foreground mb-2">Primer cuatrimestre</h3>
            <h4 className="font-medium text-foreground mt-3 mb-1">Unidad I: Filosofía, conocimiento y argumentación</h4>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Concepto de Filosofía: practicar problematizar, conceptualizar y argumentar; diferencias con ciencia y técnica (objeto, método, criterio).</li>
              <li>Origen: el asombro, la duda y las situaciones límite como punto de partida del pensar filosófico.</li>
              <li>Comienzo histórico: del mito al logos (Sócrates, Platón, Aristóteles).</li>
              <li>Ramas: ontología/metafísica (realidad), epistemología (conocimiento), lógica (argumentación), ética/axiología (valores y fines), estética y política (aplicadas al entorno agro).</li>
              <li>Problemas filosóficos actuales: inteligencia artificial en procesos agroalimentarios, bienestar animal, trazabilidad y privacidad de datos.</li>
              <li>Tipos de conocimiento: cotidiano, técnico y científico; verdad, justificación, evidencia; ejemplos del entorno agro.</li>
              <li>Lenguaje filosófico aplicado: tesis, razones, objeción, contraejemplo; distinción opinión/argumento.</li>
            </ul>
            <h4 className="font-medium text-foreground mt-3 mb-1">Unidad II: Ciencia, tecnología y vínculos</h4>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Rasgos del conocimiento científico: sistematicidad, contrastación, falibilidad.</li>
              <li>Idea de tecnología y su historia.</li>
              <li>Clasificación de las ciencias: naturales, sociales y formales; ejemplos y límites vinculados a prácticas escolares.</li>
              <li>Relaciones ciencia–tecnología en producción de alimentos: criterios sanitarios, de calidad, ambientales y de trazabilidad.</li>
              <li>Situaciones del taller como casos: problema → hipótesis → controles → evidencia → decisión técnica.</li>
              <li>Proyecto: protocolo de uso responsable de aplicaciones y datos para registro y trazabilidad (privacidad y seguridad).</li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold text-foreground mb-2">Segundo cuatrimestre</h3>
            <h4 className="font-medium text-foreground mt-3 mb-1">Unidad III: Lenguaje y lógica de la explicación</h4>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Términos y enunciados: ambigüedad, vaguedad y precisión en textos técnicos.</li>
              <li>Estructura de la explicación técnica: qué se explica, cómo, por qué vale.</li>
              <li>Razonamientos y falacias: inductivo/deductivo; errores frecuentes en comunicación técnica y corrección.</li>
              <li>Mejora de informes: cohesión y coherencia; citas y referencias; reescritura con retroalimentación.</li>
            </ul>
            <h4 className="font-medium text-foreground mt-3 mb-1">Unidad IV: Teorías y cambio científico</h4>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Hipótesis, leyes, teorías y modelos; ejemplos en entorno agro.</li>
              <li>Kuhn: paradigmas, ciencia normal, anomalías, crisis y revolución científica.</li>
              <li>Popper: conjeturas y refutaciones; diseño de pruebas críticas.</li>
              <li>Casos históricos: Darwin (selección natural) y Pasteur–Pouchet (biogénesis) y transferencia a prácticas escolares.</li>
            </ul>
            <h4 className="font-medium text-foreground mt-3 mb-1">Unidad V: Métodos y ética de la investigación</h4>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Inducción e hipotético‑deductivo: esquemas, alcances y límites.</li>
              <li>Comunidad científica: revisión por pares, replicación, corrección de errores; autoría y responsabilidad.</li>
              <li>Ética de la investigación y de la tecnología: riesgos, consentimiento, bienestar animal y ambiente.</li>
              <li>Adopción de tecnologías en el medio agro: trazabilidad, privacidad de datos y comunicación responsable.</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Organización espacio-temporal */}
      <Card>
        <CardHeader><CardTitle className="text-base">Organización espacio–temporal</CardTitle></CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div>
            <h3 className="font-semibold text-foreground mb-2">Cuatrimestre 1 (14 clases)</h3>
            <ol className="list-decimal list-inside space-y-2">
              <li><span className="font-medium">Concepto de Filosofía: qué es, para qué y cómo se practica; vínculo con toma de decisiones.</span><br/><span className="text-muted-foreground ml-5">Actividades: definición operativa (5–7 líneas) con ejemplo.</span></li>
              <li><span className="font-medium">Origen: asombro, duda y situaciones límite.</span><br/><span className="text-muted-foreground ml-5">Actividades: tres situaciones del curso + pregunta que abren.</span></li>
              <li><span className="font-medium">Del mito al logos: Sócrates, Platón, Aristóteles.</span><br/><span className="text-muted-foreground ml-5">Actividades: cuadro comparativo mito/logos (6 ítems).</span></li>
              <li><span className="font-medium">Ramas y problemas actuales situados: (IA, bienestar animal, trazabilidad, privacidad).</span><br/><span className="text-muted-foreground ml-5">Actividades: mapa conceptual (rama ↔ problema ↔ pregunta).</span></li>
              <li><span className="font-medium">Ciencia: rasgos y contrastación; clasificación de ciencias.</span><br/><span className="text-muted-foreground ml-5">Actividades: ficha con rasgos + ejemplo por tipo.</span></li>
              <li><span className="font-medium">Tecnología: idea e historia; impactos; criterios de decisión.</span><br/><span className="text-muted-foreground ml-5">Actividades: párrafo de fundamentación de decisión técnica.</span></li>
              <li><span className="font-medium">Ciencia y tecnología en alimentos: normativas básicas y trazabilidad.</span><br/><span className="text-muted-foreground ml-5">Actividades: esquema aplicado a proceso del taller.</span></li>
              <li><span className="font-medium">Caso 1 (problema e hipótesis): variables y controles.</span><br/><span className="text-muted-foreground ml-5">Actividades: problema + hipótesis (3–4 líneas) con variables/controles.</span></li>
              <li><span className="font-medium">Caso 1 (controles y evidencia): indicadores y registros; Tesis–Evidencia–Razón.</span><br/><span className="text-muted-foreground ml-5">Actividades: planilla completa + relación datos→conclusión.</span></li>
              <li><span className="font-medium">Caso 1 (decisión técnica y ética): matriz de impactos; comunicación breve.</span><br/><span className="text-muted-foreground ml-5">Actividades: matriz + texto 6–8 líneas.</span></li>
              <li><span className="font-medium">Proyecto protocolo digital: diseño (riesgos, estructura).</span><br/><span className="text-muted-foreground ml-5">Actividades: borrador con responsables y criterios de éxito.</span></li>
              <li><span className="font-medium">Proyecto: validación (simulación, ajustes).</span><br/><span className="text-muted-foreground ml-5">Actividades: versión revisada con observaciones.</span></li>
              <li><span className="font-medium">Cierre C1 + preparación de recuperación: auto/co-evaluación con rúbrica.</span><br/><span className="text-muted-foreground ml-5">Actividades: autoevaluación + plan de estudio.</span></li>
              <li><span className="font-medium">Recuperación C1: actividades focalizadas.</span><br/><span className="text-muted-foreground ml-5">Actividades: resolución de guía.</span></li>
            </ol>
          </div>
          <div>
            <h3 className="font-semibold text-foreground mb-2">Cuatrimestre 2 (14 clases)</h3>
            <ol className="list-decimal list-inside space-y-2" start={15}>
              <li><span className="font-medium">Lenguaje y explicación: ambigüedad/precisión + explicación técnica.</span><br/><span className="text-muted-foreground ml-5">Actividades: reescritura + explicación clara (6–8 líneas).</span></li>
              <li><span className="font-medium">Razonamientos y falacias: inductivo/deductivo; corrección.</span><br/><span className="text-muted-foreground ml-5">Actividades: identificar y corregir 2 falacias.</span></li>
              <li><span className="font-medium">Mejora de informes: cohesión/coherencia; citas y referencias.</span><br/><span className="text-muted-foreground ml-5">Actividades: versión mejorada con referencias completas.</span></li>
              <li><span className="font-medium">Teorías y modelos: distinciones + ejemplo agro.</span><br/><span className="text-muted-foreground ml-5">Actividades: esquema de modelo sencillo.</span></li>
              <li><span className="font-medium">Kuhn: paradigmas y cambio.</span><br/><span className="text-muted-foreground ml-5">Actividades: síntesis 8–10 líneas aplicada a caso breve.</span></li>
              <li><span className="font-medium">Popper: falsación; prueba crítica en papel.</span><br/><span className="text-muted-foreground ml-5">Actividades: propuesta de prueba + predicción.</span></li>
              <li><span className="font-medium">Caso 2 (Darwin): teoría, evidencias y análisis.</span><br/><span className="text-muted-foreground ml-5">Actividades: tabla teoría–evidencia–conclusión + transferencia.</span></li>
              <li><span className="font-medium">Caso 3 (Pasteur–Pouchet): argumentos pro/contra.</span><br/><span className="text-muted-foreground ml-5">Actividades: reconstrucción en dos columnas.</span></li>
              <li><span className="font-medium">Métodos: inducción vs hipotético‑deductivo.</span><br/><span className="text-muted-foreground ml-5">Actividades: diagrama aplicado a ejemplo del curso.</span></li>
              <li><span className="font-medium">Comunidad científica y revisión: pares/replicación/errores.</span><br/><span className="text-muted-foreground ml-5">Actividades: criterios de revisión aplicados a miniinforme.</span></li>
              <li><span className="font-medium">Ética investigación/tecnología: riesgos, bienestar animal, ambiente.</span><br/><span className="text-muted-foreground ml-5">Actividades: matriz de impactos + recomendación.</span></li>
              <li><span className="font-medium">Taller dossier integrador: estructura, fuentes, evidencias.</span><br/><span className="text-muted-foreground ml-5">Actividades: esquema + plan de trabajo.</span></li>
              <li><span className="font-medium">Presentación y retroalimentación: defensa breve + coevaluación.</span><br/><span className="text-muted-foreground ml-5">Actividades: exposición 3–5 min + devolución escrita.</span></li>
              <li><span className="font-medium">Recuperación C2: actividades focalizadas.</span><br/><span className="text-muted-foreground ml-5">Actividades: guía de recuperación + cierre.</span></li>
            </ol>
          </div>
        </CardContent>
      </Card>

      {/* Estrategias didácticas */}
      <Card>
        <CardHeader><CardTitle className="text-base">Estrategias didácticas</CardTitle></CardHeader>
        <CardContent>
          <ul className="list-disc list-inside space-y-1 text-sm">
            <li>Exposición dialogada y andamiaje con preguntas (problematizar, conceptualizar, argumentar).</li>
            <li>Lectura guiada con glosario, párrafos numerados y preguntas literal, inferencial y crítica.</li>
            <li>Trabajo con situaciones del taller como estudios de caso.</li>
            <li>Organización de la información: cuadros comparativos, redes y mapas conceptuales.</li>
            <li>Técnicas grupales (panel, mesa redonda, debate), resolución de problemas y revisión por pares.</li>
          </ul>
        </CardContent>
      </Card>

      {/* Recursos */}
      <Card>
        <CardHeader><CardTitle className="text-base">Recursos</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div>
            <h4 className="font-medium text-foreground mb-1">Infraestructura y equipamiento escolar</h4>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Pizarrón y marcadores / tizas.</li>
              <li>Aula con proyector o TV (según disponibilidad) y sistema básico de audio.</li>
              <li>Conectividad: acceso a Wi‑Fi institucional (cuando exista) y alternativa sin conexión.</li>
              <li>Dispositivos disponibles: PC/notebook docente; disponibilidad eventual de dispositivos del alumnado.</li>
              <li>Impresiones y fotocopias: acceso a copias para textos, consignas y planillas de registro.</li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium text-foreground mb-1">Materiales didácticos y soportes</h4>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Textos y fragmentos de lectura (impresos y/o digitales) con glosario.</li>
              <li>Guías de actividades, plantillas (Tesis–Evidencia–Razón; matrices de impacto; cuadros comparativos).</li>
              <li>Carpeta/bitácora de clase (individual o grupal) y archivador de producciones.</li>
              <li>Recursos de representación: afiches, hojas A3/A4, fibrones, notas adhesivas.</li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium text-foreground mb-1">Recursos para el trabajo con casos (según actividades)</h4>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Planillas de registro (tiempo/temperatura, pH, Brix, trazabilidad, checklists).</li>
              <li>Registro audiovisual (fotos breves) para documentar procesos cuando sea pertinente.</li>
              <li>Material del taller y normativa/protocolos internos de seguridad e inocuidad (si aplica).</li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium text-foreground mb-1">Aportes posibles de docentes y alumnado</h4>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Dispositivos móviles para lectura/consulta puntual y registro (cuando el contexto lo permita).</li>
              <li>Insumos simples para dinámicas (cartulinas, marcadores, cinta, impresiones).</li>
              <li>Selección de noticias, notas o materiales de divulgación vinculados a ciencia, tecnología y ética.</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Adaptaciones situadas */}
      <Card>
        <CardHeader><CardTitle className="text-base">Adaptaciones situadas</CardTitle></CardHeader>
        <CardContent>
          <ul className="list-disc list-inside space-y-1 text-sm">
            <li>Textos con glosario y audio de apoyo; consignas de alta estructura y plantillas (apoyo, base y extensión).</li>
            <li>Alternativa de baja tecnología en todas las actividades; materiales no perecederos y registros impresos.</li>
            <li>Roles rotativos y tiempos cortos para sostener la atención en jornadas extensas.</li>
          </ul>
        </CardContent>
      </Card>

      {/* Formas de evaluar */}
      <Card>
        <CardHeader><CardTitle className="text-base">Formas de evaluar</CardTitle></CardHeader>
        <CardContent className="space-y-4 text-sm">
          <p>Evaluación continua, global y formativa, entendida como parte del proceso de aprendizaje y de la mejora de la argumentación y la toma de decisiones técnicas. Se evalúan procesos y productos con criterios explícitos, y se prevé una instancia de recuperación por cuatrimestre.</p>
          <p><span className="font-medium">Instrumentos:</span> producciones escritas y orales pautadas; análisis de casos; cuestionarios semiestructurados; trabajos de búsqueda con referencias completas; controles de carpeta; exposiciones orales; bitácoras y planillas de registro; dossier integrador y proyecto (C1); coevaluación y autoevaluación.</p>

          <h3 className="font-semibold text-foreground mt-4 mb-2">Rúbrica (criterios y niveles)</h3>

          {/* C1 */}
          <Card className="border-l-4 border-l-primary/50">
            <CardContent className="pt-4 space-y-2">
              <h4 className="font-semibold">C1. Comprensión conceptual</h4>
              <p className="text-muted-foreground italic text-xs">Filosofía / ciencia / tecnología; ejes del cuatrimestre; precisión de términos</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li><span className="font-medium">Excelente (4):</span> define con precisión, distingue con criterios, aplica conceptos a casos sin contradicciones.</li>
                <li><span className="font-medium">Satisfactorio (3):</span> define y distingue en general; pequeñas imprecisiones; aplicación adecuada.</li>
                <li><span className="font-medium">Básico (2):</span> definiciones parciales; confunde categorías; aplicación superficial.</li>
                <li><span className="font-medium">Insuficiente (1):</span> errores conceptuales persistentes; no logra aplicar a situaciones.</li>
              </ul>
            </CardContent>
          </Card>

          {/* C2 */}
          <Card className="border-l-4 border-l-primary/50">
            <CardContent className="pt-4 space-y-2">
              <h4 className="font-semibold">C2. Evidencias y registro</h4>
              <p className="text-muted-foreground italic text-xs">datos, planillas, observaciones, trazabilidad del trabajo</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li><span className="font-medium">Excelente (4):</span> registra completo y ordenado; evidencia pertinente; fuentes claras; trazabilidad del proceso.</li>
                <li><span className="font-medium">Satisfactorio (3):</span> registro suficiente; evidencia pertinente con algunos vacíos menores.</li>
                <li><span className="font-medium">Básico (2):</span> registro incompleto o desordenado; evidencia poco pertinente.</li>
                <li><span className="font-medium">Insuficiente (1):</span> sin registros o registros inválidos; no se justifica con evidencia.</li>
              </ul>
            </CardContent>
          </Card>

          {/* C3 */}
          <Card className="border-l-4 border-l-primary/50">
            <CardContent className="pt-4 space-y-2">
              <h4 className="font-semibold">C3. Argumentación y comunicación</h4>
              <p className="text-muted-foreground italic text-xs">tesis–evidencia–razón; coherencia; objeción y respuesta; oral y escrito</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li><span className="font-medium">Excelente (4):</span> tesis clara; razones sólidas; integra evidencia; considera objeciones; comunicación precisa.</li>
                <li><span className="font-medium">Satisfactorio (3):</span> tesis y razones claras; evidencia suficiente; objeción parcial; comunicación comprensible.</li>
                <li><span className="font-medium">Básico (2):</span> tesis débil; razones poco desarrolladas; evidencia escasa; comunicación confusa.</li>
                <li><span className="font-medium">Insuficiente (1):</span> sin tesis identificable; sin razones ni evidencia; comunicación incoherente.</li>
              </ul>
            </CardContent>
          </Card>

          {/* C4 */}
          <Card className="border-l-4 border-l-primary/50">
            <CardContent className="pt-4 space-y-2">
              <h4 className="font-semibold">C4. Relación teoría–práctica y decisión técnica</h4>
              <p className="text-muted-foreground italic text-xs">transferencia a casos del taller; criterio; evaluación de impactos</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li><span className="font-medium">Excelente (4):</span> transfiere con criterio; pondera impactos; justifica decisiones y propone mejoras factibles.</li>
                <li><span className="font-medium">Satisfactorio (3):</span> transfiere a casos; justifica decisiones con algún criterio explícito.</li>
                <li><span className="font-medium">Básico (2):</span> transferencia limitada; justificación genérica; poca consideración de impactos.</li>
                <li><span className="font-medium">Insuficiente (1):</span> no vincula teoría con práctica; decisiones sin fundamento.</li>
              </ul>
            </CardContent>
          </Card>

          {/* C5 */}
          <Card className="border-l-4 border-l-primary/50">
            <CardContent className="pt-4 space-y-2">
              <h4 className="font-semibold">C5. Trabajo y actitud</h4>
              <p className="text-muted-foreground italic text-xs">responsabilidad, participación, colaboración, uso honesto de fuentes, respeto de normas</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li><span className="font-medium">Excelente (4):</span> participación sostenida; trabajo autónomo; colabora; cumple normas y citas.</li>
                <li><span className="font-medium">Satisfactorio (3):</span> participación regular; cumple; colabora cuando se le solicita.</li>
                <li><span className="font-medium">Básico (2):</span> participación intermitente; entregas tardías; requiere acompañamiento constante.</li>
                <li><span className="font-medium">Insuficiente (1):</span> inasistencias o incumplimientos reiterados; no respeta normas básicas.</li>
              </ul>
            </CardContent>
          </Card>
        </CardContent>
      </Card>

      {/* Ponderación */}
      <Card>
        <CardHeader><CardTitle className="text-base">Ponderación sugerida (ajustable)</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm">C1 20% · C2 20% · C3 25% · C4 25% · C5 10%.</p>
        </CardContent>
      </Card>

      {/* Bibliografía */}
      <Card>
        <CardHeader><CardTitle className="text-base">Bibliografía</CardTitle></CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div>
            <h3 className="font-semibold text-foreground mb-2">Bibliografía general</h3>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Boido, Guillermo; Domenech, Graciela; Espejo, Adriana; Flichman, Eduardo; Nillni, Nancy y Onna, Alberto. (1990). <em>Pensamiento científico. Estructura II.</em> Buenos Aires: CONICET.</li>
              <li>Boido, Guillermo; Flichman, Eduardo; Yagüe, Jorge y otros. (1988). <em>Pensamiento científico. Estructura I.</em> Buenos Aires: CONICET.</li>
              <li>Broncano, Fernando. (2000). <em>Mundos artificiales. Filosofía del cambio tecnológico.</em> México: Paidós.</li>
              <li>Chalmers, Alan. (1998). <em>¿Qué es esa cosa llamada ciencia?</em> Buenos Aires: Siglo XXI.</li>
              <li>Crombie, Alistair Cameron. (1974). <em>Historia de la ciencia.</em> Madrid: Alianza.</li>
              <li>Echeverría, Javier. (1999). <em>Introducción a la metodología de la ciencia.</em> Madrid: Cátedra.</li>
              <li>Elster, Jon. (2006). <em>El cambio tecnológico. Investigaciones sobre la racionalidad y la transformación social.</em> Barcelona: Gedisa.</li>
              <li>Flichman, Eduardo y Pacífico, Andrea. (1995). <em>Pensamiento científico. La polémica epistemológica actual.</em> Buenos Aires: CONICET.</li>
              <li>Flichman, Eduardo; Miguel, Hernán; Paruelo, Jorge y Pissinis, Gabriel (eds.). (2001). <em>Las raíces y los frutos. Temas de filosofía de la ciencia.</em> Buenos Aires: CCC‑Educando.</li>
              <li>González García, Marta y López Cerezo, Jorge. (1996). <em>Ciencia, tecnología y sociedad. Una introducción al estudio social de la ciencia y la tecnología.</em> Madrid: Tecnos.</li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold text-foreground mb-2">Obras generales</h3>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Holton, Gerald y Brush, Stephen. (1996). <em>Introducción a los conceptos y teorías de las ciencias físicas.</em> Barcelona: Reverté.</li>
              <li>Klimovsky, Gregorio. (1994). <em>Las desventuras del conocimiento científico. Una introducción a la epistemología.</em> Buenos Aires: AZ Editora.</li>
              <li>Kragh, Helge. (1989). <em>Introducción a la historia de la ciencia.</em> Barcelona: Crítica.</li>
              <li>Merton, Robert. (1973). <em>Sociología de la ciencia.</em> Madrid: Alianza.</li>
              <li>Mitcham, Carl. (1989). <em>¿Qué es la filosofía de la tecnología?</em> Barcelona: Anthropos.</li>
              <li>Serrés, Michel. (1989). <em>Historia de las ciencias.</em> Madrid: Cátedra.</li>
              <li>Thuillier, Pierre. (1990). <em>De Arquímedes a Einstein. Las caras ocultas de la invención científica.</em> Madrid: Alianza.</li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold text-foreground mb-2">Para los casos de estudio</h3>
            <h4 className="font-medium text-foreground mt-2 mb-1">La revolución copernicana</h4>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Boido, Guillermo. (1996). <em>Noticias del planeta Tierra. Galileo Galilei y la revolución científica.</em> Buenos Aires: AZ Editora.</li>
              <li>Kuhn, Thomas. (1996). <em>La revolución copernicana.</em> Barcelona: Ariel.</li>
              <li>Levinas, Marcelo. (1996). <em>Las imágenes del universo. Una historia de las ideas del cosmos.</em> Buenos Aires: Fondo de Cultura Económica.</li>
              <li>Lindberg, David. (2002). <em>Los inicios de la ciencia occidental.</em> Buenos Aires: Paidós.</li>
            </ul>
            <h4 className="font-medium text-foreground mt-2 mb-1">Pasteur‑Pouchet y la generación espontánea</h4>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Hacking, Ian. (1996). <em>Representar e intervenir.</em> Buenos Aires: Paidós.</li>
              <li>Latour, Bruno. (1992). <em>Ciencia en acción.</em> Barcelona: Labor.</li>
            </ul>
            <h4 className="font-medium text-foreground mt-2 mb-1">Mendel y la genética</h4>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>López Cerezo, José. (2008). <em>El triunfo de la antisepsia.</em> México: Fondo de Cultura Económica.</li>
              <li>Popper, Karl. (1973). <em>La lógica de la investigación científica.</em> Madrid: Tecnos.</li>
              <li>Serrés, Michel. (1989). <em>Historia de las ciencias.</em> Madrid: Cátedra.</li>
              <li>Hempel, Carl. (1979). <em>Filosofía de la ciencia natural.</em> Madrid: Alianza.</li>
              <li>Miguel, Hernán y Baringoltz, Eleonora. (1996). <em>Problemas epistemológicos y metodológicos.</em> Buenos Aires: Eudeba.</li>
              <li>Nagel, Ernest. (1968). <em>La estructura de la ciencia.</em> Buenos Aires: Paidós.</li>
            </ul>
            <h4 className="font-medium text-foreground mt-2 mb-1">Evolucionismo en Biología</h4>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Brown, Harold. (1984). <em>La nueva filosofía de la ciencia.</em> Madrid: Tecnos.</li>
              <li>Kuhn, Thomas. (1971). <em>La estructura de las revoluciones científicas.</em> México: Fondo de Cultura Económica.</li>
              <li>Kuhn, Thomas. (1989). <em>¿Qué son las revoluciones científicas?</em> Barcelona: Paidós.</li>
              <li>Lakatos, Imre. (1983). <em>La metodología de los programas de investigación científica.</em> Madrid: Alianza.</li>
              <li>Laudan, Larry. (1984). <em>Ciencia y valores.</em> Berkeley: University of California.</li>
              <li>Laudan, Larry. (1986). <em>El progreso y sus problemas. Hacia una teoría del progreso científico.</em> Madrid: Encuentro.</li>
              <li>Monod, Jacques. (2000). <em>El azar y la necesidad. Ensayo sobre la filosofía natural de la biología moderna.</em> Barcelona: Metatemas.</li>
            </ul>
            <h4 className="font-medium text-foreground mt-2 mb-1">Desarrollo de la cosmología actual</h4>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Pérez Ransanz, Antonio. (1999). <em>Kuhn y el cambio científico.</em> México: Fondo de Cultura Económica.</li>
              <li>Shapin, Steven. (2000). <em>La revolución científica: una interpretación alternativa.</em> Buenos Aires: Paidós.</li>
              <li>Sober, Elliot. (1996). <em>Filosofía de la biología.</em> Madrid: Alianza.</li>
              <li>Gangui, Alejandro. (2005). <em>El big bang. La génesis de nuestra cosmología actual.</em> Buenos Aires: Eudeba.</li>
              <li>Hawking, Stephen. (1996). <em>Historia del tiempo ilustrada.</em> Barcelona: Crítica.</li>
              <li>Sklar, Lawrence. (1994). <em>Filosofía de la física.</em> Madrid: Alianza.</li>
            </ul>
            <h4 className="font-medium text-foreground mt-2 mb-1">El surgimiento de las geometrías no euclideanas</h4>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Casini, Alejandro. (2008). <em>El juego de los principios. Una introducción al método axiomático.</em> Buenos Aires: AZ Editores.</li>
              <li>Datri, Edgardo. (1999). <em>Geometría y realidad física: de Euclides a Riemann.</em> Buenos Aires: Eudeba.</li>
              <li>Klimovsky, Gregorio. (2000). <em>Las ciencias formales y el método axiomático.</em> Buenos Aires: AZ Editores.</li>
              <li>Klimovsky, Gregorio y Boido, Guillermo. (2005). <em>Las desventuras del conocimiento matemático. Filosofía de la matemática: una introducción.</em> Buenos Aires: AZ Editora.</li>
            </ul>
            <h4 className="font-medium text-foreground mt-2 mb-1">El experimento de Milgram</h4>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Giddens, Anthony. (1993). <em>Las nuevas reglas del método sociológico.</em> Buenos Aires: Amorrortu.</li>
              <li>Klimovsky, Gregorio e Hidalgo, Cecilia. (1998). <em>La inexplicable sociedad. Cuestiones de epistemología de las ciencias sociales.</em> Buenos Aires: AZ Editora.</li>
              <li>Velasco Gómez, Ambrosio. (2000). <em>Tradiciones naturalistas y hermenéuticas en la filosofía de las ciencias sociales.</em> México: UNAM.</li>
              <li>Von Wright, Georg Henrik. (1987). <em>Explicación y comprensión.</em> Madrid: Alianza.</li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold text-foreground mb-2">Para los temas de integración</h3>
            <h4 className="font-medium text-foreground mt-2 mb-1">Descubrimiento de América</h4>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Belmonte Avilés, José. (s. f.). "El origen de nuestra visión del cosmos. La investigación arqueoastronómica". <em>Ciencia Hoy</em>, 19(110).</li>
              <li>Gould, Stephen Jay. (1997). <em>Un dinosaurio en un pajar.</em> Barcelona: Crítica.</li>
              <li>Levinas, Marcelo. (2001). <em>El último crimen de Colón.</em> Buenos Aires: Alfaguara.</li>
              <li>Moledo, Leonardo. (2008). <em>Los mitos de la ciencia.</em> Buenos Aires: Planeta.</li>
            </ul>
            <h4 className="font-medium text-foreground mt-2 mb-1">Fusión y fisión nuclear</h4>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Alcañiz, Isabella. (2005). "Cincuenta años de política nuclear en la Argentina". <em>Ciencia Hoy</em>, 15(88).</li>
              <li>Mariscotti, Mario. (1996). <em>El secreto atómico de Huemul.</em> Buenos Aires: Sigma.</li>
              <li>Holton, Georg y otros. (1996). <em>Introducción a los conceptos y teorías de las ciencias físicas.</em> Barcelona: Reverté.</li>
              <li>Felizia, Eduardo. (2003). "Descubrimiento de la fisión nuclear y la generación de energía". <em>Ciencia Hoy</em>, 13(73).</li>
              <li>Felizia, Eduardo. (1996). "Centrales Nucleares. La Evaluación Probabilística de su Seguridad". <em>Ciencia Hoy</em>, 5(35).</li>
            </ul>
            <h4 className="font-medium text-foreground mt-2 mb-1">Estructura de la materia</h4>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Allekotte, Engomar; Bertou, Xavier; Harari, Diego; Mollerach, Silvia y Roulet, Esteban. (2008). "El origen de los rayos cósmicos de mayor energía". <em>Ciencia Hoy</em>, 17(102).</li>
              <li>Bensaude‑Vincent, Bernadette y Stengers, Isabelle. (1997). <em>Historia de la química.</em> Madrid: Addison‑Wesley Iberoamericana.</li>
              <li>Dova, María Teresa. (1998). "En busca del origen de la masa". <em>Ciencia Hoy</em>, 8(47).</li>
              <li>De la Llosa, Pedro. (2000). <em>El espectro de Demócrito.</em> Barcelona: Ediciones del Serbal.</li>
              <li>Fernández Niello, Jorge y Pacheco, Alberto. (2007). "Núcleos 'halo' y núcleos borromeos". <em>Ciencia Hoy</em>, 17(98).</li>
              <li>Oerter, Robert. (2008). <em>La teoría de casi todo.</em> México: Fondo de Cultura Económica.</li>
            </ul>
            <h4 className="font-medium text-foreground mt-2 mb-1">Donación de órganos</h4>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Gherardi, Carlos. (2007). <em>Vida y muerte en terapia intensiva.</em> Buenos Aires: Biblos.</li>
              <li>Abraham, Gustavo; González, María y Cuadrado, Teresita. (1998). "La ciencia y la ingeniería de los biomateriales, un desafío interdisciplinario". <em>Ciencia Hoy</em>, 9(49).</li>
              <li>Argibay, Pablo. (2005). "Consideraciones acerca del transplante neuronal". <em>Ciencia Hoy</em>, 14(84).</li>
              <li>Ariès, Philippe. (2000). <em>Historia de la muerte en Occidente.</em> Barcelona: El Acantilado.</li>
              <li>Golombek, Diego. (2003). "Más cerca del trasplante de cerebros". <em>Ciencia Hoy</em>, 13(75).</li>
              <li>Klein, Susan. (2000). "El uso de animales en la investigación biomédica". <em>Ciencia Hoy</em>, 10(55).</li>
              <li>Vianello, Sergio. (2003). "Descubriendo las células progenitoras". <em>Ciencia Hoy</em>, 13(73).</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Carpeta de casos */}
      <Card>
        <CardHeader><CardTitle className="text-base">Carpeta de casos</CardTitle></CardHeader>
        <CardContent>
          <ul className="list-disc list-inside space-y-1 text-sm">
            <li><span className="font-medium">Caso A — Dulce:</span> gelificación y seguridad; decisión: reprocesar / corregir / descartar.</li>
            <li><span className="font-medium">Caso B — Chacinados:</span> control de acidez/temperatura/trazabilidad; decisión: reprocesar / extender / descartar.</li>
            <li><span className="font-medium">Caso C — Agua de proceso:</span> cloración y detención preventiva; decisión: detener/corregir/continuar bajo control o descartar intermedio.</li>
            <li><span className="font-medium">Caso D — Ovinos:</span> antiparasitario, bienestar y período de retiro; decisión: posponer / alternativa / comunicación responsable.</li>
            <li><span className="font-medium">Caso E — Privacidad y trazabilidad digital:</span> políticas de uso y resguardos mínimos.</li>
            <li><span className="font-medium">Caso F — Cambios teóricos:</span> Darwin y Pasteur–Pouchet; qué cuenta como refutación, ajustes razonables y transferencia.</li>
          </ul>
        </CardContent>
      </Card>

      {/* Ejemplo desarrollado — Caso A */}
      <Card>
        <CardHeader><CardTitle className="text-base">Ejemplo desarrollado — Caso A "Dulce"</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div>
            <h4 className="font-medium text-foreground mb-1">Contexto y pregunta</h4>
            <p>Lote con textura blanda; registros (tiempo/temperatura, pH, Brix, relación pectina–fruta–azúcar, fotos). Pregunta: ¿liberar, reprocesar o descartar?</p>
          </div>
          <div>
            <h4 className="font-medium text-foreground mb-1">Problematizar, conceptualizar, argumentar</h4>
            <p>Supuestos (textura aceptable, umbral sanitario, criterio de calidad) y definiciones operativas; conclusiones con razones y abiertas a objeciones.</p>
          </div>
          <div>
            <h4 className="font-medium text-foreground mb-1">Problema e hipótesis</h4>
            <p>Gelificación insuficiente por relación inadecuada pectina–fruta–azúcar o acidez fuera de rango; si se corrige relación y acidez, se normaliza.</p>
          </div>
          <div>
            <h4 className="font-medium text-foreground mb-1">Controles y evidencias</h4>
            <p>Verificar registros; prueba controlada a pequeña escala.</p>
          </div>
          <div>
            <h4 className="font-medium text-foreground mb-1">Producción modelo Tesis–Evidencia–Razón</h4>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li><span className="font-medium">Tesis:</span> el lote no debe liberarse en su estado actual.</li>
              <li><span className="font-medium">Evidencias:</span> acidez 3,5 vs protocolo 3,0–3,3; Brix 55 vs 60; foto textura blanda; planilla firmada.</li>
              <li><span className="font-medium">Razón:</span> acidez alta y menor azúcar reducen poder de gel y elevan riesgo microbiológico; corresponde corregir y repetir mediciones.</li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium text-foreground mb-1">Matriz de impactos</h4>
            <p>Sanitario (prioritario), ambiental (energía reprocesado), económico (costo/tiempo), reputación escolar; priman salud y protocolo.</p>
          </div>
          <div>
            <h4 className="font-medium text-foreground mb-1">Decisión y justificación</h4>
            <p>Reprocesar con corrección relación pectina–fruta–azúcar y ajuste de acidez; registrar; volver a medir.</p>
          </div>
          <div>
            <h4 className="font-medium text-foreground mb-1">Transferencia</h4>
            <p>Aplicar estructura Tesis–Evidencia–Razón y matriz de impactos a cloración insuficiente y acidez de chacinados.</p>
          </div>
          <div>
            <h4 className="font-medium text-foreground mb-1">Nota de uso en cronograma</h4>
            <p>Vincular con C1 Clase 8, 9 y 10; agregar "Ver Ejemplo desarrollado: Caso A — Dulce".</p>
          </div>
        </CardContent>
      </Card>
    </>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// TAB B — SECUENCIA DIDÁCTICA (Unidad III, clases 15-17)
// ════════════════════════════════════════════════════════════════════════════

function TabSecuencia() {
  return (
    <>
      {/* Header */}
      <Card>
        <CardHeader><CardTitle className="text-base">Secuencia Didáctica — Unidad III: Lenguaje y lógica de la explicación (Clases 15 a 17)</CardTitle></CardHeader>
        <CardContent className="text-sm space-y-1">
          <p><span className="font-medium">Espacio curricular:</span> Filosofía e Historia de la Ciencia y la Tecnología (6.º año)</p>
          <p><span className="font-medium">Carga horaria:</span> 2 módulos semanales</p>
          <p><span className="font-medium">Tramo anual:</span> Segundo cuatrimestre — Clases 15, 16 y 17</p>
          <p><span className="font-medium">Eje de la unidad:</span> lenguaje, precisión y estructura lógica de la explicación; razonamientos y falacias; reescritura con cohesión/coherencia; citas y referencias.</p>
        </CardContent>
      </Card>

      {/* Propósitos */}
      <Card>
        <CardHeader><CardTitle className="text-base">1. Propósitos</CardTitle></CardHeader>
        <CardContent>
          <ul className="list-disc list-inside space-y-1 text-sm">
            <li>Fortalecer el uso del lenguaje para producir explicaciones claras, justificadas y revisables.</li>
            <li>Reconocer cómo la ambigüedad y la vaguedad afectan la comprensión y la discusión racional.</li>
            <li>Identificar estructura de explicación (qué se explica / cómo / por qué vale) y mejorar inferencias.</li>
            <li>Reconocer razonamientos inductivos y deductivos en textos escolares y detectar errores frecuentes.</li>
            <li>Incorporar prácticas de escritura académica escolar: cohesión, coherencia, citas y referencias.</li>
          </ul>
        </CardContent>
      </Card>

      {/* Alcances y encuadre */}
      <Card>
        <CardHeader><CardTitle className="text-base">2. Alcances y encuadre</CardTitle></CardHeader>
        <CardContent className="text-sm space-y-2">
          <p>Los talleres (por ejemplo, "dulce") se usan solo como casos ilustrativos para pensar explicaciones, razones y criterios; no constituyen el núcleo técnico de la clase.</p>
          <p>El foco del trabajo es la calidad de la explicación, la estructura argumentativa y la revisión del texto.</p>
        </CardContent>
      </Card>

      {/* Aprendizajes esperados */}
      <Card>
        <CardHeader><CardTitle className="text-base">3. Aprendizajes esperados (al finalizar la clase 17)</CardTitle></CardHeader>
        <CardContent>
          <ul className="list-disc list-inside space-y-1 text-sm">
            <li>Distingue y corrige ambigüedad y vaguedad en enunciados.</li>
            <li>Produce una explicación breve con estructura qué / cómo / por qué vale, apoyada en razones.</li>
            <li>Identifica conclusiones y razones, reconoce razonamientos inductivos/deductivos y corrige al menos dos problemas inferenciales.</li>
            <li>Reescribe un informe breve mejorando cohesión y coherencia e incorporando dos referencias del material del curso.</li>
          </ul>
        </CardContent>
      </Card>

      {/* Evidencia mínima */}
      <Card>
        <CardHeader><CardTitle className="text-base">4. Evidencia mínima (única, con progresión)</CardTitle></CardHeader>
        <CardContent className="text-sm space-y-3">
          <div>
            <h4 className="font-medium text-foreground mb-1">Producto integrador (clase 17)</h4>
            <p>Informe breve argumentado (1 carilla) sobre una situación-caso (una de las tres propuestas o una equivalente), que incluya:</p>
            <ol className="list-decimal list-inside space-y-1 ml-2 mt-1">
              <li>Explicación (8–12 líneas) con estructura: Qué se explica / Cómo (condiciones relevantes) / Por qué vale (razón + indicio/evidencia mencionada).</li>
              <li>Dos correcciones incorporadas al texto final: una corrección de precisión (ambigüedad o vaguedad) con su reescritura; una corrección de lógica (falacia o salto inferencial) con su reescritura.</li>
              <li>Dos referencias del material trabajado en clase (bibliografía de la planificación o material provisto por el/la docente).</li>
            </ol>
          </div>
          <div>
            <h4 className="font-medium text-foreground mb-1">Recuperación equivalente</h4>
            <p>Mismo producto final (1 carilla), con apoyos: texto base más corto, glosario, plantilla de explicación y lista acotada de falacias. Mantiene el mismo tipo de evidencia.</p>
          </div>
        </CardContent>
      </Card>

      {/* Evaluación formativa */}
      <Card>
        <CardHeader><CardTitle className="text-base">5. Evaluación formativa (instrumento común a las 3 clases)</CardTitle></CardHeader>
        <CardContent className="text-sm">
          <p className="mb-2">Lista de cotejo (Logrado / En proceso / A revisar) aplicada a borradores y versión final:</p>
          <ol className="list-decimal list-inside space-y-1">
            <li><span className="font-medium">Precisión:</span> reduce ambigüedad/vaguedad en enunciados clave.</li>
            <li><span className="font-medium">Estructura:</span> aparece con claridad "qué/cómo/por qué vale".</li>
            <li><span className="font-medium">Justificación:</span> la conclusión se apoya en razones (sin saltos).</li>
            <li><span className="font-medium">Corrección:</span> identifica y corrige 2 problemas de razonamiento o falacias.</li>
            <li><span className="font-medium">Escritura académica escolar:</span> cohesión, coherencia y referencias consistentes.</li>
          </ol>
        </CardContent>
      </Card>

      {/* ═══ CLASE 15 ═══ */}
      <Card id="clase-15" className="scroll-mt-20">
        <CardHeader><CardTitle className="text-base">Clase 15 — Lenguaje y explicación: ambigüedad, vaguedad y precisión</CardTitle></CardHeader>
        <CardContent className="text-sm space-y-4">
          <div>
            <h4 className="font-medium text-foreground mb-1">Propósito de la clase</h4>
            <p>Reconocer problemas de lenguaje (ambigüedad/vaguedad) y producir un borrador inicial de explicación con estructura "qué/cómo/por qué vale".</p>
          </div>
          <div>
            <h4 className="font-medium text-foreground mb-1">Entrada (10–15')</h4>
            <p className="mb-2">Lectura de una situación-caso (elegir una):</p>
            <div className="space-y-2 ml-2">
              <div>
                <p className="font-medium">Caso A: Dulce (taller, solo como ejemplo)</p>
                <p className="italic text-muted-foreground">"En el grupo salió el dulce 'más oscuro' que otras veces. Algunos dicen que fue porque 'se calentó de más', otros porque 'la fruta estaba distinta'. Se revolvió 'un rato' y después se decidió envasar 'cuando ya estaba'. En algunos frascos quedó más espeso y en otros más líquido. Para la próxima, acordaron 'tener más cuidado'."</p>
              </div>
              <div>
                <p className="font-medium">Caso B: Registro y trazabilidad (escuela)</p>
                <p className="italic text-muted-foreground">"En una planilla de trazabilidad del lote aparecen datos 'más o menos' completos. Un grupo sostiene que 'no pasa nada' porque se entiende igual; otro dice que 'así no sirve'. Al comparar con otros registros, ven que algunas categorías cambian de nombre ('materia prima buena' / 'apta' / 'ok'). Se discute si el registro 'es confiable'."</p>
              </div>
              <div>
                <p className="font-medium">Caso C: Agua de proceso (control simple)</p>
                <p className="italic text-muted-foreground">"En un control sale un valor 'raro'. Un grupo concluye que 'el instrumento falló' porque 'siempre funciona bien'. Otro grupo cree que 'el agua estaba mal' porque 'se notaba'. Nadie recuerda exactamente qué se hizo antes del control ni cuánto tiempo pasó. Igual deciden informar que 'está todo bien'."</p>
              </div>
            </div>
            <p className="mt-2"><span className="font-medium">Pregunta guía:</span> ¿Qué no se puede discutir con razones porque el lenguaje está "flojo" (vago/ambiguo)?</p>
          </div>
          <div>
            <h4 className="font-medium text-foreground mb-1">Desarrollo (55–60')</h4>
            <ol className="list-decimal list-inside space-y-2 ml-2">
              <li><span className="font-medium">Detección y clasificación (parejas):</span> marcar 8 expresiones del caso y clasificarlas en: (a) Ambigüedad (dos sentidos posibles), (b) Vaguedad (falta de precisión), (c) Enunciado sin criterio (no explicita qué cuenta como "bien", "mal", "raro", "confiable").</li>
              <li><span className="font-medium">Reescritura por precisión (parejas):</span> reescribir 6 expresiones agregando condiciones relevantes y criterios (cuándo, bajo qué condiciones, qué cuenta como…).</li>
              <li><span className="font-medium">Borrador 1 (individual):</span> escribir 10–12 líneas con la estructura: (1) Qué se explica, (2) Cómo (condiciones relevantes), (3) Por qué vale (razón + indicio/evidencia mencionada). Además, subrayar 3 términos que deban definirse y escribir una definición operativa de una frase para cada uno.</li>
            </ol>
          </div>
          <div>
            <h4 className="font-medium text-foreground mb-1">Cierre y salida (10–15')</h4>
            <p>Puesta en común breve: dos ejemplos de "antes/después" (vago → preciso).</p>
            <p>Evidencia de clase: entrega de Borrador 1 + lista de 6 reescrituras de precisión.</p>
            <p>Salida hacia la clase 16: "Traé tu borrador: vamos a revisar la lógica del 'por qué'."</p>
          </div>
          <div>
            <h4 className="font-medium text-foreground mb-1">Plan B low-tech</h4>
            <p>Caso escrito en pizarrón o dictado; producción en hoja; devolución oral guiada.</p>
          </div>
        </CardContent>
      </Card>

      {/* ═══ CLASE 16 ═══ */}
      <Card id="clase-16" className="scroll-mt-20">
        <CardHeader><CardTitle className="text-base">Clase 16 — Razonamientos y falacias: sostener y revisar explicaciones</CardTitle></CardHeader>
        <CardContent className="text-sm space-y-4">
          <div>
            <h4 className="font-medium text-foreground mb-1">Propósito de la clase</h4>
            <p>Distinguir conclusión/razones/supuestos, reconocer razonamientos inductivos/deductivos y corregir errores frecuentes (falacias o saltos inferenciales).</p>
          </div>
          <div>
            <h4 className="font-medium text-foreground mb-1">Entrada (10–15')</h4>
            <p>Lectura rápida de 2–3 fragmentos de Borrador 1 (anónimos o voluntarios).</p>
            <p>Identificación colectiva:</p>
            <ul className="list-disc list-inside ml-2">
              <li>¿Cuál es la conclusión?</li>
              <li>¿Cuál es la razón principal?</li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium text-foreground mb-1">Desarrollo (55–60')</h4>
            <ol className="list-decimal list-inside space-y-2 ml-2">
              <li><span className="font-medium">Mapa mínimo de inferencias (docente + curso):</span> Conclusión / Razones / Supuestos / Objeción posible. Aplicación a un fragmento del caso.</li>
              <li>
                <span className="font-medium">Falacias y errores frecuentes (4 tipos, con ejemplos breves):</span>
                <ol className="list-decimal list-inside ml-4 mt-1 space-y-1">
                  <li>Falsa causa</li>
                  <li>Generalización apresurada</li>
                  <li>Apelación a autoridad sin respaldo</li>
                  <li>Falso dilema</li>
                </ol>
                <p className="ml-4 mt-1">En cada una se trabaja: cómo reconocerla y cómo corregirla.</p>
              </li>
              <li><span className="font-medium">Borrador 2 (individual, con apoyo de pares):</span> Identificar en el Borrador 1 dos problemas (falacia/salto inferencial). Reescribir los dos fragmentos. Agregar una frase: "Se corrige porque…"</li>
            </ol>
          </div>
          <div>
            <h4 className="font-medium text-foreground mb-1">Cierre y salida (10–15')</h4>
            <p>Puesta en común de 2 correcciones ejemplares.</p>
            <p>Evidencia de clase: entrega de Borrador 2 con dos correcciones justificadas.</p>
            <p>Salida hacia la clase 17: "Vamos a cerrar con reescritura final y dos referencias."</p>
          </div>
          <div>
            <h4 className="font-medium text-foreground mb-1">Plan B low-tech</h4>
            <p>Tarjetas en papel con definiciones y ejemplos; corrección a mano; devolución con lista de cotejo en pizarrón.</p>
          </div>
        </CardContent>
      </Card>

      {/* ═══ CLASE 17 ═══ */}
      <Card id="clase-17" className="scroll-mt-20">
        <CardHeader><CardTitle className="text-base">Clase 17 — Reescritura final: cohesión, coherencia y referencias</CardTitle></CardHeader>
        <CardContent className="text-sm space-y-4">
          <div>
            <h4 className="font-medium text-foreground mb-1">Propósito de la clase</h4>
            <p>Cerrar el informe breve con mejoras de escritura (orden, conectores) y trazabilidad (citas y referencias) para que la explicación sea discutible y revisable.</p>
          </div>
          <div>
            <h4 className="font-medium text-foreground mb-1">Entrada (10–15')</h4>
            <p>Recordatorio de criterio: una buena explicación debe poder discutirse (razones) y rastrearse (fuentes).</p>
          </div>
          <div>
            <h4 className="font-medium text-foreground mb-1">Desarrollo (55–60')</h4>
            <ol className="list-decimal list-inside space-y-2 ml-2">
              <li>
                <span className="font-medium">Cohesión y coherencia (mini-taller):</span>
                <ul className="list-disc list-inside ml-4 mt-1 space-y-1">
                  <li>Ordenar: situación → condiciones → observaciones → explicación → recomendación</li>
                  <li>Incorporar conectores: porque / por lo tanto / sin embargo / dado que</li>
                  <li>Quitar repeticiones y saltos de tema</li>
                </ul>
              </li>
              <li><span className="font-medium">Citas y referencias (práctica escolar):</span> Se trabaja con material del curso (bibliografía de la planificación o fragmentos provistos por el/la docente). Se registra al final con un formato consistente.</li>
              <li>
                <span className="font-medium">Versión final (individual):</span> redactar el Informe breve argumentado (1 carilla) incorporando:
                <ol className="list-decimal list-inside ml-4 mt-1 space-y-1">
                  <li>estructura qué/cómo/por qué vale</li>
                  <li>dos correcciones integradas (precisión + lógica)</li>
                  <li>dos referencias</li>
                </ol>
              </li>
            </ol>
            <p className="mt-2">Revisión por pares (10'): aplicación de lista de cotejo (5 criterios).</p>
          </div>
          <div>
            <h4 className="font-medium text-foreground mb-1">Cierre</h4>
            <p>Entrega de la versión final como evidencia mínima de la unidad.</p>
          </div>
          <div>
            <h4 className="font-medium text-foreground mb-1">Plan B low-tech</h4>
            <p>Referencias manuscritas; revisión por pares con lista en pizarrón.</p>
          </div>
        </CardContent>
      </Card>

      {/* Plantilla de producción */}
      <Card>
        <CardHeader><CardTitle className="text-base">6. Plantilla única de producción (para fotocopiar)</CardTitle></CardHeader>
        <CardContent className="text-sm space-y-4">
          <div>
            <h4 className="font-medium text-foreground mb-1">A) Explicación (qué / cómo / por qué vale) — 10 a 12 líneas</h4>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Qué se explica: ___</li>
              <li>Cómo ocurrió (condiciones relevantes): ___</li>
              <li>Por qué vale (razón + indicio/evidencia mencionada): ___</li>
            </ul>
            <p className="mt-2 font-medium">Términos a precisar (subrayá 3 y definilos en una frase):</p>
            <ol className="list-decimal list-inside ml-2">
              <li>___ = ___</li>
              <li>___ = ___</li>
              <li>___ = ___</li>
            </ol>
          </div>
          <div>
            <h4 className="font-medium text-foreground mb-1">B) Lógica del "por qué" (clase 16)</h4>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Conclusión principal: ___</li>
              <li>Razón principal: ___</li>
              <li>Supuesto que estoy usando (aunque no lo diga): ___</li>
              <li>Objeción posible: ___</li>
            </ul>
            <p className="mt-2 font-medium">Dos correcciones (elegí 2 fragmentos y reescribí):</p>
            <ol className="list-decimal list-inside ml-2 space-y-2">
              <li>Fragmento original: ___ · Problema (falacia/salto): ___ · Reescritura corregida: ___ · Justificación: "Se corrige porque…" ___</li>
              <li>Fragmento original: ___ · Problema (falacia/salto): ___ · Reescritura corregida: ___ · Justificación: "Se corrige porque…" ___</li>
            </ol>
          </div>
          <div>
            <h4 className="font-medium text-foreground mb-1">C) Referencias (clase 17)</h4>
            <p>Escribí 2 referencias del material trabajado en clase.</p>
            <ul className="list-disc list-inside ml-2">
              <li>Referencia 1: Autor/a. Título. Editorial, año. (Cap./apartado trabajado).</li>
              <li>Referencia 2: Autor/a. Título. Editorial, año. (Cap./apartado trabajado).</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Material de lectura para estudiantes */}
      <Card>
        <CardHeader><CardTitle className="text-base">Material de lectura para estudiantes — Unidad III (para trabajar en clases 15 a 17)</CardTitle></CardHeader>
        <CardContent className="prose prose-sm max-w-none text-foreground space-y-3">
          <p>En esta unidad vamos a practicar algo que parece sencillo y, sin embargo, suele fallar incluso en textos "bien intencionados": explicar con claridad y con razones. Explicar no es repetir lo que pasó ni enumerar pasos. Tampoco es "opinar" o "contar una impresión". Una explicación busca que otra persona pueda comprender qué se afirma, en qué se apoya y por qué esa afirmación es aceptable. En el trabajo escolar esto importa porque una explicación se discute: alguien puede preguntar "¿qué querés decir con eso?", "¿cómo lo sabés?", "¿por qué pensás que eso se sigue de lo anterior?". Cuando una explicación está bien escrita, esas preguntas tienen respuesta dentro del texto.</p>
          <p>Un primer obstáculo para explicar es el lenguaje impreciso. Hay dos problemas distintos que conviene separar. El primero es la ambigüedad: una misma expresión puede entenderse de dos maneras diferentes. Si alguien escribe "salió más oscuro", no siempre queda claro si se refiere al color final, al brillo, a la apariencia de superficie o a otra comparación. La ambigüedad se corrige aclarando el sentido: "más oscuro en el color final del producto", "más oscuro en comparación con el lote anterior", "más oscuro en la superficie del frasco". El segundo problema es la vaguedad: una expresión no tiene bordes claros o no aporta la precisión mínima para discutirla. Palabras como "mucho", "poco", "bastante", "un rato", "más o menos", "raro", "bien", "mal" pueden ser útiles en una conversación informal, pero en una explicación dejan al lector sin herramientas para evaluar lo que se dice. La vaguedad se corrige agregando condiciones relevantes y criterios: cuánto, cuándo, bajo qué condiciones, qué cuenta como "bien" y qué cuenta como "mal" en esa situación.</p>
          <p>Cuando una explicación mejora en precisión, aparece una ventaja importante: se vuelve revisable. Revisable significa que se puede volver sobre lo dicho para ajustar, corregir o discutir, sin depender de "lo que el autor quiso decir". En la escuela, esa revisabilidad es una forma de responsabilidad: quien explica se hace cargo de que sus palabras permitan una discusión justa. Por eso, en esta unidad vamos a aprender a transformar frases vagas o ambiguas en enunciados que sostienen una conversación racional.</p>
          <p>Ahora bien, explicar no es solo elegir palabras. También es organizar lo que se dice. Una estructura útil, especialmente en informes breves, es la de tres partes: qué se explica, cómo ocurrió y por qué vale la explicación. La primera parte, "qué se explica", consiste en identificar el fenómeno o el problema: algo que requiere ser entendido y no solo contado. La segunda, "cómo ocurrió", reúne condiciones relevantes: no todo detalle importa por igual; se eligen las condiciones que hacen diferencia para comprender el fenómeno. La tercera, "por qué vale", es la parte más filosófica: allí se ofrece una razón que conecta las condiciones con la conclusión. Esa conexión es lo que hace que el texto sea una explicación y no un relato.</p>
          <p>En la práctica, la sección "por qué vale" suele ser la más frágil. Muchas veces aparece como una frase que suena convincente pero no está justificada, o como una conclusión que no se sigue de lo anterior. Para fortalecerla conviene distinguir entre conclusión y razones. La conclusión es lo que el texto pretende sostener. Las razones son lo que el texto ofrece para apoyar esa conclusión. También suele haber supuestos: ideas que se usan sin decirlas, como si fueran obvias. Y, además, siempre es posible pensar una objeción: una alternativa o un contraejemplo que obligue a mejorar la explicación. Cuando aprendemos a distinguir conclusión, razones, supuestos y objeciones, el texto se vuelve más sólido.</p>
          <p>Esta unidad también trabaja una distinción clásica: razonamientos deductivos e inductivos. En un razonamiento deductivo, si las premisas son verdaderas y la forma del argumento es correcta, la conclusión queda garantizada. En un razonamiento inductivo, en cambio, la conclusión va más allá de lo observado: se apoya en casos, evidencias o regularidades y, por eso, puede ser fuerte o débil, pero no queda garantizada de manera absoluta. En la vida cotidiana y en muchas explicaciones escolares usamos inducciones: generalizamos desde casos. La clave no es "prohibir" la inducción, sino hacerla responsable: indicar qué evidencia la respalda, cuántos casos, qué condiciones y qué límites tiene la generalización.</p>
          <p>Cuando una explicación falla, a veces no es por falta de datos sino por errores en el modo de razonar. A esos errores frecuentes los llamamos falacias. Una falacia no es simplemente "decir algo falso"; es razonar de una manera que parece buena, pero no lo es. Reconocer falacias ayuda a mejorar explicaciones, porque permite reformular el texto con mejores conexiones entre razones y conclusiones. Hay cuatro errores típicos que vamos a mirar de cerca.</p>

          <h4 className="font-medium text-foreground mt-4">1. Falsa Causa</h4>
          <p>Ocurre cuando se afirma que algo fue causa de otra cosa sin justificar esa relación, o cuando se confunde simultaneidad con causalidad. Es común escribir: "pasó X, entonces fue por Y" sin mostrar por qué Y es relevante o sin descartar otras posibilidades. Para corregir una falsa causa conviene agregar condiciones, comparar con un caso distinto, o reformular la afirmación de modo más prudente: "es posible que…", "una hipótesis es…", "esto se apoya en…".</p>

          <h4 className="font-medium text-foreground mt-4">2. Generalización Apresurada</h4>
          <p>Se pasa de uno o pocos casos a una afirmación general, como "siempre ocurre", "nunca ocurre", "en todos los casos". Se corrige indicando límites: "en este caso", "en los registros observados", "con estos datos", o buscando evidencia adicional.</p>

          <h4 className="font-medium text-foreground mt-4">3. Apelación a la Autoridad sin Respaldo</h4>
          <p>A veces se afirma que algo es así "porque lo dijo alguien", pero no se explica el criterio por el cual esa autoridad sería relevante ni se ofrece evidencia. Esto no significa que no podamos apoyarnos en autores, docentes o manuales; significa que, cuando lo hacemos, debemos mostrar qué aporta esa fuente y cómo se relaciona con lo que decimos. Justamente por eso en la clase 17 trabajamos con referencias.</p>

          <h4 className="font-medium text-foreground mt-4">4. Falso Dilema</h4>
          <p>Presentar solo dos opciones como si fueran las únicas posibles ("o pasa esto o pasa lo otro"), cuando existen alternativas intermedias o diferentes. Se corrige ampliando el abanico: "otra posibilidad es…", "también podría ocurrir…", "depende de…".</p>

          <p>La mejora de una explicación no termina en el razonamiento: también importa cómo se escribe. Dos ideas guían el trabajo de reescritura. La primera es la cohesión: que las oraciones estén bien conectadas y que el lector pueda seguir el hilo con conectores adecuados, evitando saltos. La segunda es la coherencia: que el texto mantenga un propósito claro, un orden lógico y que cada parte contribuya a lo que se quiere sostener. Un texto puede ser cohesivo (conectores bien puestos) y, aun así, ser incoherente si mezcla temas sin relación o si cambia de criterio a mitad de camino. En esta unidad vamos a ordenar los informes de manera simple: situación o problema, condiciones relevantes, observaciones, explicación, y una recomendación o cierre.</p>

          <p>Por último, una explicación escolar también debe ser trazable: el lector debe poder saber de dónde sale una afirmación. Para eso sirven las citas y referencias. Citar no es copiar frases largas, ni "decorar" el texto con nombres. Es indicar qué idea tomamos de un material y permitir que alguien lo encuentre. Referenciar es registrar, al final del texto, los datos mínimos del material usado. En esta unidad vamos a usar un formato simple: autor o institución, título, editorial o fuente y año, y el capítulo o apartado trabajado. Si el material fue entregado como fragmento en clase, se registra como "fragmento entregado por la cátedra" con fecha. Esto no busca burocracia: busca honestidad intelectual y claridad.</p>

          <p>Este material se articula con la bibliografía del curso del siguiente modo. En términos generales, textos de epistemología y metodología ayudan a pensar qué cuenta como explicación, qué tipo de razones usamos y cómo se justifican afirmaciones. No necesitamos memorizar definiciones: necesitamos aprender a escribir explicaciones mejores y a revisarlas. Por eso, durante las clases 15 a 17, vas a pasar por tres versiones de tu texto: un primer borrador para ganar precisión, un segundo borrador para corregir razonamientos y, finalmente, una versión final con mejor escritura y referencias. El objetivo no es "tener razón" desde el inicio: es poder mejorar el modo en que sostenés lo que afirmás.</p>

          <p>Al terminar la unidad, deberías poder reconocer la diferencia entre una frase que "suena bien" y una explicación que realmente se sostiene. De eso trata esta secuencia: aprender a hacer que nuestras explicaciones sean más claras, más discutibles y más responsables.</p>

          <p className="font-medium mt-4">Materiales de referencia del curso (para registrar al final del informe):</p>
          <p>Chalmers, Alan. <em>¿Qué es esa cosa llamada ciencia?</em></p>
        </CardContent>
      </Card>
    </>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// TAB C — PREPARAR CLASE (Clase 20 Popper)
// ════════════════════════════════════════════════════════════════════════════

function TabClase20() {
  return (
    <>
      {/* Header */}
      <Card>
        <CardHeader><CardTitle className="text-base">Clase 20 (2.º cuatrimestre) — Popper: falsación y "prueba crítica en papel" (2 módulos)</CardTitle></CardHeader>
        <CardContent className="text-sm space-y-1">
          <p><span className="font-medium">Curso y espacio:</span> 6.º año EESA (PBA) — Filosofía e Historia de la Ciencia y la Tecnología (2 módulos semanales)</p>
          <p><span className="font-medium">Ubicación en la secuencia:</span> Luego de Kuhn (clase 19) y antes del Caso 2: Darwin (clase 21)</p>
        </CardContent>
      </Card>

      {/* Propósito */}
      <Card>
        <CardHeader><CardTitle className="text-base">Propósito</CardTitle></CardHeader>
        <CardContent className="text-sm">
          <p>Que el estudiantado pueda distinguir entre confirmar y poner a prueba críticamente una hipótesis, y que aprenda a formular una prueba riesgosa (que podría refutar la hipótesis), dejando por escrito una predicción esperada y qué resultado contaría como refutación, para transferir luego este criterio a situaciones del entorno agro.</p>
        </CardContent>
      </Card>

      {/* Contenidos */}
      <Card>
        <CardHeader><CardTitle className="text-base">Contenidos de la clase</CardTitle></CardHeader>
        <CardContent>
          <ul className="list-disc list-inside space-y-1 text-sm">
            <li>Popper: conjeturas y refutaciones; criterio de falsación; "riesgo" teórico.</li>
            <li>Diseño de pruebas críticas (en papel): predicción, resultado incompatible, control de ambigüedades.</li>
          </ul>
        </CardContent>
      </Card>

      {/* Bibliografía */}
      <Card>
        <CardHeader><CardTitle className="text-base">Bibliografía de base (para esta clase)</CardTitle></CardHeader>
        <CardContent className="text-sm">
          <p>Popper, Karl. (1973). <em>La lógica de la investigación científica.</em> Madrid: Tecnos.</p>
        </CardContent>
      </Card>

      {/* Material de lectura */}
      <Card>
        <CardHeader><CardTitle className="text-base">Material de lectura para estudiantes</CardTitle></CardHeader>
        <CardContent className="prose prose-sm max-w-none text-foreground space-y-3">
          <h4 className="font-medium text-foreground">Popper: por qué una buena teoría tiene que poder fallar</h4>
          <p>Cuando en el taller o en el aula decimos "esto funciona", muchas veces estamos describiendo una experiencia que salió bien. Por ejemplo: "con esta receta el dulce siempre sale", o "si hacemos tal procedimiento, no aparece tal problema". Es comprensible: buscamos repetir lo que da resultado. Sin embargo, para Popper hay una diferencia clave entre acumular casos favorables y poner a prueba de verdad una idea. Una hipótesis puede coincidir con muchos casos y, aun así, no ser científicamente sólida si nunca se arriesga a perder. La pregunta no es solo "¿cuántas veces salió bien?", sino también "¿qué tendría que pasar para admitir que estaba equivocado?".</p>
          <p>Popper propone pensar el conocimiento científico como una práctica de conjeturas y refutaciones. Una conjetura es una explicación o hipótesis que intentamos sostener; una refutación es el resultado de una prueba que muestra que esa conjetura no puede ser correcta tal como está formulada. En este enfoque, avanzar no significa "confirmar para siempre", sino aprender a formular hipótesis que puedan ser sometidas a pruebas exigentes y, cuando fallan, mejorar nuestras ideas o reemplazarlas por otras mejores. El conocimiento progresa, entonces, no por coleccionar éxitos, sino por aprender de los fracasos bien interpretados.</p>
          <p>Para entenderlo, conviene distinguir dos maneras de "apoyar" una hipótesis. La primera es buscar ejemplos que la favorezcan. Si yo creo que "este procedimiento garantiza inocuidad", puedo mirar solo los casos donde nada salió mal y sentirme seguro. El problema es que esa seguridad puede ser engañosa, porque casi cualquier práctica puede parecer perfecta si no buscamos en serio condiciones donde podría fallar. La segunda manera es más incómoda: consiste en diseñar una prueba que, si la hipótesis es falsa, tenga altas chances de mostrarlo. A esto Popper lo llama prueba crítica. Es crítica porque no se conforma con corroborar; intenta descubrir un resultado incompatible con lo que la hipótesis afirma.</p>
          <p>En este marco aparece el criterio de falsación. Una hipótesis es falsable cuando, por su forma, permite indicar qué observación o resultado la dejaría en evidencia como falsa. Esto no significa que ya sepamos que es falsa; significa que sabemos cómo podría ser refutada. Si una afirmación es tan flexible que, pase lo que pase, siempre puede acomodarse para seguir teniendo razón, entonces no queda realmente expuesta a la crítica. En términos cotidianos: si "siempre tengo una excusa" para que mi idea no pierda, entonces mi idea no está aprendiendo nada del mundo.</p>
          <p>Una prueba crítica en papel se diseña antes de hacer nada, por escrito, para no engañarnos con el resultado que nos conviene. El diseño incluye, como mínimo, cuatro piezas. Primero, la hipótesis: una afirmación clara sobre lo que debería ocurrir. Segundo, la predicción: qué resultado esperamos si la hipótesis es correcta, en una situación definida. Tercero, el resultado incompatible: qué tendría que observarse para decir "esto refuta la hipótesis". Cuarto, las condiciones del test: qué se mantiene constante y qué se observa, evitando confusiones por ambigüedad o por cambios múltiples a la vez.</p>
          <p>Un ejemplo simple, sin laboratorio, puede ayudarnos. Supongamos la hipótesis: "si el registro de temperatura se mantiene dentro del rango indicado durante todo el proceso, el producto final no presenta signos de deterioro tempranos en el almacenamiento". Una prueba crítica no sería almacenar el producto "en condiciones ideales" y esperar que salga bien; eso solo suma un caso favorable. La prueba crítica, en cambio, define condiciones precisas y busca un indicador que, si aparece, sería incompatible con lo que la hipótesis afirma. Por ejemplo: "si aun con el registro dentro del rango, aparece deterioro temprano según el indicador X, entonces la hipótesis, tal como está formulada, queda refutada o requiere revisión". El foco está en anticipar, con claridad, qué cuenta como "fallo" de la hipótesis.</p>
          <p>Esta manera de pensar fortalece la toma de decisiones técnicas porque obliga a explicitar criterios. En vez de quedarnos en "me parece" o "siempre fue así", pasamos a "si sostengo esto, entonces me comprometo con tales predicciones y acepto tales señales de error". Esa actitud también mejora la comunicación: quien lee el informe sabe qué se quiso probar, qué se esperaba y qué dato haría cambiar la conclusión. En Popper, esa disposición a dejarse corregir no es debilidad; es la condición para que el conocimiento sea más confiable.</p>
        </CardContent>
      </Card>

      {/* Desarrollo de la clase */}
      <Card>
        <CardHeader><CardTitle className="text-base">Desarrollo de la clase (con tiempos orientativos)</CardTitle></CardHeader>
        <CardContent className="text-sm space-y-4">
          {/* Entrada */}
          <div>
            <h4 className="font-medium text-foreground mb-1">1) Entrada (10–15'): retoma y puente con Kuhn</h4>
            <p>Recuperación breve de la clase anterior: "ciencia normal, anomalías, crisis". En el pizarrón: una frase síntesis. Puente: "Si Kuhn explica cambios por crisis de paradigmas, Popper propone otra pregunta: ¿cómo distinguir lo científico de lo que no lo es?".</p>
            <p className="mt-1">Disparador (oral): "En el taller, ¿qué afirmación escuchamos seguido que 'parece' segura? ¿Cómo haríamos para que esa afirmación se juegue a perder (o ganar) con un dato?"</p>
          </div>
          {/* Lectura guiada */}
          <div>
            <h4 className="font-medium text-foreground mb-1">2) Lectura guiada (20–25'): ideas clave para usar en la producción</h4>
            <p>Lectura silenciosa o lectura por turnos.</p>
            <p className="mt-1">Preguntas de control (orales, breves):</p>
            <ul className="list-disc list-inside ml-2">
              <li>¿Qué diferencia hay entre "sumar casos a favor" y "poner a prueba críticamente"?</li>
              <li>¿Qué significa que una hipótesis sea falsable?</li>
              <li>¿Por qué conviene escribir la prueba antes del resultado?</li>
            </ul>
          </div>
          {/* Actividad central */}
          <div>
            <h4 className="font-medium text-foreground mb-1">3) Actividad central (35–40'): "Diseño de una prueba crítica en papel"</h4>
            <p>Consigna (parejas o tríos): elijan una situación y completen la plantilla.</p>
            <p className="mt-1 font-medium">Situaciones posibles (elegir 1):</p>
            <ul className="list-disc list-inside ml-2">
              <li>A) Conservación/inocuidad: "Con el protocolo de higiene X, se evita contaminación cruzada en el proceso Y".</li>
              <li>B) Trazabilidad/registro: "Si el registro se completa en el momento, disminuyen errores de lote/etiquetado".</li>
              <li>C) Bienestar animal/decisión técnica: "Si se cumple el manejo Z, se reducen signos de estrés en el traslado".</li>
            </ul>
            <p className="mt-2 font-medium">Plantilla de producción (debe quedar escrita):</p>
            <ol className="list-decimal list-inside ml-2 space-y-1">
              <li>Hipótesis (una oración clara).</li>
              <li>Predicción esperada (qué observaríamos si la hipótesis es correcta).</li>
              <li>Resultado incompatible (qué observaríamos si es falsa).</li>
              <li>Cómo lo mediríamos/observaríamos (indicador sencillo y condición definida).</li>
              <li>Nota de "riesgo": explicar por qué el test podría realmente refutar la hipótesis (no solo confirmarla).</li>
            </ol>
            <p className="mt-2 font-medium">Andamiaje docente:</p>
            <ul className="list-disc list-inside ml-2">
              <li>Verificar que el "resultado incompatible" no sea ambiguo.</li>
              <li>Verificar que predicción e incompatible sean contrarios respecto de la hipótesis.</li>
              <li>Evitar formulaciones que se acomodan a todo.</li>
            </ul>
          </div>
          {/* Cierre */}
          <div>
            <h4 className="font-medium text-foreground mb-1">4) Cierre (10–15')</h4>
            <p>Socialización breve y salida para la próxima.</p>
            <p>Dos grupos leen hipótesis + predicción + resultado incompatible.</p>
            <p>Cierre: "En Popper, una buena idea es la que se anima a decir qué la haría caer".</p>
            <p>Salida para clase 21 (Darwin): 4–5 líneas: "¿Qué predicción arriesgada podríamos pedirle a una teoría como la de Darwin? ¿Qué tipo de evidencia contaría en contra?".</p>
          </div>
        </CardContent>
      </Card>

      {/* Evidencia mínima */}
      <Card>
        <CardHeader><CardTitle className="text-base">Evidencia mínima</CardTitle></CardHeader>
        <CardContent className="text-sm space-y-2">
          <p><span className="font-medium">Producto:</span> "Propuesta de prueba crítica y predicción esperada" (plantilla completa).</p>
          <h4 className="font-medium text-foreground mt-2 mb-1">Criterios de validez (corrección rápida)</h4>
          <ol className="list-decimal list-inside space-y-1">
            <li>Claridad conceptual: distingue hipótesis, predicción y resultado incompatible.</li>
            <li>Falsabilidad: el incompatible refuta la hipótesis.</li>
            <li>Riesgo y precisión: test arriesgado e indicador no vago.</li>
            <li>Coherencia: vínculo "si… entonces…".</li>
            <li>Registro: escrito legible y completo.</li>
          </ol>
        </CardContent>
      </Card>

      {/* Recuperación equivalente */}
      <Card>
        <CardHeader><CardTitle className="text-base">Recuperación equivalente</CardTitle></CardHeader>
        <CardContent>
          <ol className="list-decimal list-inside space-y-1 text-sm">
            <li>Reescritura de la hipótesis para que sea falsable + reformulación del resultado incompatible.</li>
            <li>Nueva predicción esperada + breve justificación del "riesgo" (3–4 líneas).</li>
          </ol>
        </CardContent>
      </Card>

      {/* Recursos */}
      <Card>
        <CardHeader><CardTitle className="text-base">Recursos</CardTitle></CardHeader>
        <CardContent>
          <ul className="list-disc list-inside space-y-1 text-sm">
            <li>Texto de lectura impreso o digital.</li>
            <li>Hoja/plantilla de evidencia.</li>
            <li>Pizarrón y hojas A4.</li>
          </ul>
        </CardContent>
      </Card>

      {/* Plan B */}
      <Card>
        <CardHeader><CardTitle className="text-base">Plan B (baja tecnología)</CardTitle></CardHeader>
        <CardContent className="text-sm">
          <p>Lectura en voz alta por turnos + plantilla copiada del pizarrón + entrega en carpeta.</p>
        </CardContent>
      </Card>

      {/* Adaptaciones situadas */}
      <Card>
        <CardHeader><CardTitle className="text-base">Adaptaciones situadas (accesibilidad)</CardTitle></CardHeader>
        <CardContent>
          <ul className="list-disc list-inside space-y-1 text-sm">
            <li>Plantilla estructurada y ejemplo modelado.</li>
            <li>Respuesta oral con escribiente del grupo.</li>
            <li>Tiempos segmentados (lectura por párrafos y pausas breves).</li>
          </ul>
        </CardContent>
      </Card>
    </>
  );
}
