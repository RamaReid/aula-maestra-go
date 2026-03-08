import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InlineValidationSummary } from "@/components/ui/InlineValidationSummary";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Download, Maximize2, RotateCcw, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { toast } from "@/hooks/use-toast";
import { formatErrorMessage } from "@/lib/errors";
import { downloadStructuredPdf } from "@/lib/pdfExport";
import PlanContentBlocksEditor from "./PlanContentBlocksEditor";
import PlanLessonsEditor from "./PlanLessonsEditor";
import PlanObjectivesEditor from "./PlanObjectivesEditor";
import PlanRubricsEditor from "./PlanRubricsEditor";
import PlanTeacherBibliographyEditor from "./PlanTeacherBibliographyEditor";
import { StructuredListEditor } from "./StructuredListEditor";

interface PlanData {
  fundamentacion: string;
  estrategias_marco: string;
  estrategias_practicas: string[];
  evaluacion_marco: string;
  resources: string;
}

interface MappedCurriculumNode {
  id: string;
  name: string;
  node_type: string;
  order_index?: number | null;
}

interface TeacherBibliographyEntry {
  citation: string;
  usage_notes: string;
}

type ExpandableField = "fundamentacion" | "estrategias_marco" | "evaluacion_marco" | "resources";
type PlanStatus = Tables<"plans">["status"];

const PLAN_SECTIONS = [
  { value: "fundamentacion", label: "Fundamentación" },
  { value: "propositos", label: "Objetivos" },
  { value: "estrategias", label: "Estrategias" },
  { value: "contenidos", label: "Contenidos" },
  { value: "evaluacion", label: "Evaluación" },
  { value: "clases", label: "Clases" },
  { value: "recursos", label: "Recursos" },
  { value: "bibliografia", label: "Bibliografía" },
] as const;

const EXPORT_ORDER = ["fundamentacion", "propositos", "estrategias", "contenidos", "evaluacion", "clases", "recursos", "bibliografia"] as const;

const fieldTitles: Record<ExpandableField, string> = {
  fundamentacion: "Fundamentación",
  estrategias_marco: "Estrategia marco",
  evaluacion_marco: "Criterios de evaluación",
  resources: "Recursos",
};

interface Props {
  planId: string;
  courseId: string;
  curriculumDocumentId?: string | null;
  planStatus: string;
  onValidated: () => void;
  courseArchived?: boolean;
}

function buildRepairGuidance(errors: string[]) {
  const steps: string[] = [];
  for (const error of errors) {
    if (error.includes("Fundamentacion")) steps.push("Revisa la Fundamentación y deja un desarrollo anual claro, con varios párrafos y contexto docente explícito.");
    else if (error.includes("objetivos")) steps.push("La pestaña Objetivos debe quedar con entre 6 y 8 objetivos observables.");
    else if (error.includes("Estrategias marco") || error.includes("estrategia practica")) steps.push("Separa estrategia marco y estrategias prácticas, dejando al menos una práctica concreta.");
    else if (error.includes("bloque o unidad")) steps.push("En Contenidos define al menos un bloque, unidad o eje con título, descripción y temas.");
    else if (error.includes("rubrica")) steps.push("En Evaluación agrega filas de rúbrica vinculadas a los bloques de contenido.");
    else if (error.includes("Recursos")) steps.push("Amplía Recursos con soportes, bibliografía de trabajo, uso pedagógico y alternativas low-tech.");
    else if (error.includes("Clase")) steps.push("En Clases revisa tema, modo de trabajo, resultado y evidencia mínima de las clases observadas.");
    else if (error.includes("Ya existen lecciones")) steps.push("El curso ya tiene lecciones creadas. Si cambió la estructura anual, conviene revalidar desde el plan editado.");
  }
  return Array.from(new Set(steps));
}

function isLikelyBibliographyNode(name: string) {
  const trimmed = name.trim();
  const commaCount = (trimmed.match(/,/g) || []).length;
  const hasAuthorPrefix = /^[A-ZÁÉÍÓÚÑ][^,]{1,90},/.test(trimmed);
  const hasYear = /\b(1[89]\d{2}|20\d{2})\b/.test(trimmed);
  const hasEditionFallback = /\bvarias\s+ediciones\b/i.test(trimmed);
  return hasAuthorPrefix && commaCount >= 2 && (hasYear || hasEditionFallback || commaCount >= 3);
}

function isAuthorityOrNoiseNode(name: string) {
  const normalized = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, "");
  return normalized.includes("isbn") || normalized.includes("cdd") || normalized.includes("disenocurricular") || normalized.includes("educacionsecundaria") || normalized.includes("directorageneral") || normalized.includes("presidentadelconsejo") || normalized.includes("subsecretariadeeducacion") || normalized.includes("directoraprovincial") || normalized.includes("equipodeespecialistas") || normalized.includes("autoridades");
}

function splitParagraphs(value: string) {
  return value.split(/\n\s*\n/).map((paragraph) => paragraph.trim()).filter(Boolean);
}

export default function PlanEditor({ planId, courseId, curriculumDocumentId, planStatus, onValidated, courseArchived }: Props) {
  const [plan, setPlan] = useState<PlanData | null>(null);
  const [loading, setLoading] = useState(true);
  const [validating, setValidating] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [expandedField, setExpandedField] = useState<ExpandableField | null>(null);
  const [mappedNodes, setMappedNodes] = useState<MappedCurriculumNode[]>([]);
  const [curriculumBibliographyNodes, setCurriculumBibliographyNodes] = useState<MappedCurriculumNode[]>([]);
  const [currentStatus, setCurrentStatus] = useState(planStatus);
  const [hasEditedAfterValidation, setHasEditedAfterValidation] = useState(planStatus === "EDITED");
  const [exportingPdf, setExportingPdf] = useState(false);
  const transitioningRef = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const readOnly = !!courseArchived;
  const repairGuidance = buildRepairGuidance(validationErrors);

  useEffect(() => {
    setCurrentStatus(planStatus);
    setHasEditedAfterValidation(planStatus === "EDITED");
  }, [planStatus]);

  const fetchMappedNodes = useCallback(async () => {
    const { data: mappings } = await supabase.from("plan_content_mappings").select("curriculum_node_id").eq("plan_id", planId);
    const nodeIds = Array.from(new Set((mappings || []).map((mapping) => mapping.curriculum_node_id)));
    if (nodeIds.length === 0) {
      setMappedNodes([]);
      return;
    }
    const { data: nodes } = await supabase.from("curriculum_nodes").select("id, name, node_type, order_index").in("id", nodeIds).order("order_index");
    setMappedNodes((nodes || []).filter((node) => !isAuthorityOrNoiseNode(node.name)));
  }, [planId]);

  const fetchCurriculumBibliography = useCallback(async () => {
    if (!curriculumDocumentId) {
      setCurriculumBibliographyNodes([]);
      return;
    }
    const { data: nodes } = await supabase.from("curriculum_nodes").select("id, name, node_type, order_index").eq("curriculum_document_id", curriculumDocumentId).order("order_index");
    setCurriculumBibliographyNodes((nodes || []).filter((node) => !isAuthorityOrNoiseNode(node.name) && isLikelyBibliographyNode(node.name)));
  }, [curriculumDocumentId]);

  useEffect(() => {
    const fetchPlan = async () => {
      const { data } = await supabase.from("plans").select("fundamentacion, estrategias_marco, estrategias_practicas, evaluacion_marco, resources").eq("id", planId).single();
      if (data) setPlan(data);
      await Promise.all([fetchMappedNodes(), fetchCurriculumBibliography()]);
      setLoading(false);
    };
    fetchPlan();
  }, [fetchCurriculumBibliography, fetchMappedNodes, planId]);

  const transitionToEdited = useCallback(async () => {
    if (transitioningRef.current || readOnly || currentStatus !== "VALIDATED") return;
    transitioningRef.current = true;
    await supabase.from("plans").update({ status: "EDITED" as PlanStatus }).eq("id", planId);
    setCurrentStatus("EDITED");
    setHasEditedAfterValidation(true);
    transitioningRef.current = false;
  }, [currentStatus, planId, readOnly]);

  const saveField = useCallback((field: keyof PlanData, value: string | string[]) => {
    if (readOnly) return;
    setValidationErrors([]);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      if (currentStatus === "VALIDATED") await transitionToEdited();
      await supabase.from("plans").update({ [field]: value }).eq("id", planId);
    }, 400);
  }, [currentStatus, planId, readOnly, transitionToEdited]);

  const updateField = (field: keyof PlanData, value: string) => {
    setPlan((current) => (current ? { ...current, [field]: value } : current));
    saveField(field, value);
  };

  const updateStrategy = (index: number, value: string) => {
    if (!plan) return;
    const estrategias_practicas = [...plan.estrategias_practicas];
    estrategias_practicas[index] = value;
    setPlan({ ...plan, estrategias_practicas });
    saveField("estrategias_practicas", estrategias_practicas);
  };

  const addStrategy = () => {
    if (!plan || plan.estrategias_practicas.length >= 8) return;
    const estrategias_practicas = [...plan.estrategias_practicas, ""];
    setPlan({ ...plan, estrategias_practicas });
    saveField("estrategias_practicas", estrategias_practicas);
  };

  const removeStrategy = (index: number) => {
    if (!plan) return;
    const estrategias_practicas = plan.estrategias_practicas.filter((_, currentIndex) => currentIndex !== index);
    setPlan({ ...plan, estrategias_practicas });
    saveField("estrategias_practicas", estrategias_practicas);
  };

  const handleRebuildPlan = async () => {
    if (!curriculumDocumentId) {
      toast({ title: "Falta base curricular", description: "Este curso no tiene un documento curricular persistido para rearmar el borrador.", variant: "destructive" });
      return;
    }
    setBootstrapping(true);
    setValidationErrors([]);
    try {
      const { data, error } = await supabase.functions.invoke("bootstrap-course-plan", { body: { course_id: courseId, plan_id: planId, curriculum_document_id: curriculumDocumentId } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const { data: refreshedPlan } = await supabase.from("plans").select("fundamentacion, estrategias_marco, estrategias_practicas, evaluacion_marco, resources").eq("id", planId).single();
      if (refreshedPlan) setPlan(refreshedPlan);
      await Promise.all([fetchMappedNodes(), fetchCurriculumBibliography()]);
      const nextStatus = data?.plan_status === "EDITED" || data?.plan_status === "VALIDATED" ? data.plan_status : "INCOMPLETE";
      setCurrentStatus(nextStatus);
      setHasEditedAfterValidation(nextStatus === "EDITED");
      toast({ title: "Borrador reconstruido", description: "Se regeneró la base anual del plan con bloques, rúbricas, bibliografía curricular y estructura de clases actualizada." });
      onValidated();
    } catch (error: unknown) {
      toast({ title: "No se pudo reconstruir el borrador", description: formatErrorMessage(error), variant: "destructive" });
    } finally {
      setBootstrapping(false);
    }
  };

  const handleValidate = async () => {
    if (!plan) return;
    setValidating(true);
    setValidationErrors([]);
    try {
      const { data, error } = await supabase.rpc("validate_plan", { p_plan_id: planId });
      if (error) throw error;
      const result = data as unknown as { success: boolean; errors: string[] };
      if (!result.success) {
        setValidationErrors(result.errors);
        toast({ title: "Validación fallida", description: result.errors.join(". "), variant: "destructive" });
        return;
      }
      toast({ title: hasEditedAfterValidation ? "Plan revalidado" : "Plan validado", description: hasEditedAfterValidation ? "Los cambios anuales quedaron validados correctamente." : "Se creó la agenda base del curso con sus 28 clases." });
      onValidated();
    } catch (error: unknown) {
      toast({ title: "Error", description: formatErrorMessage(error), variant: "destructive" });
    } finally {
      setValidating(false);
    }
  };

  const renderStatusBadge = () => {
    if (currentStatus === "VALIDATED") return <Badge variant="default">Validado</Badge>;
    if (currentStatus === "EDITED") return <div className="flex items-center gap-2"><Badge variant="destructive">Editado</Badge><span className="text-xs text-muted-foreground">Requiere revalidación</span></div>;
    return <Badge variant="secondary">Incompleto</Badge>;
  };

  const visibleMappedNodes = useMemo(() => mappedNodes.filter((node) => !isLikelyBibliographyNode(node.name)), [mappedNodes]);

  const handleExportPlanPdf = async () => {
    if (!plan) return;
    setExportingPdf(true);
    try {
      const [{ data: objectives }, { data: contentBlocks }, { data: rubrics }, { data: lessons }, { data: teacherBibliography }] = await Promise.all([
        supabase.from("plan_objectives").select("description, order_index").eq("plan_id", planId).order("order_index"),
        supabase.from("plan_content_blocks").select("id, title, description, topics, term, order_index").eq("plan_id", planId).order("order_index"),
        supabase.from("plan_rubrics").select("content_block_id, criterion_name, focus_note, advanced_level, expected_level, basic_level, initial_level, order_index").eq("plan_id", planId).order("order_index"),
        supabase.from("plan_lessons").select("lesson_number, term, theme, subtitle").eq("plan_id", planId).order("lesson_number"),
        supabase.from("plan_teacher_bibliography_entries").select("citation, usage_notes, order_index").eq("plan_id", planId).order("order_index"),
      ]);
      const blockMap = new Map((contentBlocks || []).map((block) => [block.id, block.title]));
      const sections = {
        fundamentacion: { title: "Fundamentación", body: splitParagraphs(plan.fundamentacion).length > 0 ? splitParagraphs(plan.fundamentacion) : ["Sin fundamentación cargada."] },
        propositos: { title: "Objetivos", body: (objectives || []).length > 0 ? objectives!.map((objective, index) => `${index + 1}. ${objective.description}`) : ["Sin objetivos cargados."] },
        estrategias: { title: "Estrategias", body: [plan.estrategias_marco ? `Estrategia marco: ${plan.estrategias_marco}` : "", ...(plan.estrategias_practicas || []).filter(Boolean).map((strategy, index) => `${index + 1}. ${strategy}`)].filter(Boolean) },
        contenidos: { title: "Contenidos", body: (contentBlocks || []).length > 0 ? contentBlocks!.flatMap((block) => [`${block.title}${block.term ? ` (${block.term === 1 ? "Primer cuatrimestre" : "Segundo cuatrimestre"})` : ""}.`, block.description || "Sin descripción cargada.", `Temas: ${(block.topics || []).filter(Boolean).join("; ") || "Sin temas cargados."}`]) : ["Sin bloques de contenido cargados."] },
        evaluacion: { title: "Evaluación", body: [...splitParagraphs(plan.evaluacion_marco), ...(rubrics || []).flatMap((row) => [`Rúbrica · ${blockMap.get(row.content_block_id) || "Bloque"} · ${row.criterion_name}.`, row.focus_note, `Avanzado: ${row.advanced_level}`, `Esperado: ${row.expected_level}`, `Básico: ${row.basic_level}`, `Inicial: ${row.initial_level}`])].filter(Boolean) },
        clases: { title: "Clases", body: (lessons || []).length > 0 ? lessons!.map((lesson) => `Clase ${lesson.lesson_number} (${lesson.term === 1 ? "Primer cuatrimestre" : "Segundo cuatrimestre"}): ${lesson.theme || "Sin tema"}.`) : ["Sin clases cargadas."] },
        recursos: { title: "Recursos", body: splitParagraphs(plan.resources).length > 0 ? splitParagraphs(plan.resources) : ["Sin recursos cargados."] },
        bibliografia: { title: "Bibliografía", body: ["Bibliografía curricular:", ...(curriculumBibliographyNodes.length > 0 ? curriculumBibliographyNodes.map((node, index) => `${index + 1}. ${node.name}`) : ["Sin bibliografía curricular detectada."]), "Bibliografía del curso:", ...((teacherBibliography as TeacherBibliographyEntry[] | null)?.length ? (teacherBibliography as TeacherBibliographyEntry[]).flatMap((entry, index) => [`${index + 1}. ${entry.citation}`, entry.usage_notes ? `Uso previsto: ${entry.usage_notes}` : "Uso previsto: sin nota cargada."]) : ["Sin bibliografía propia del docente cargada."])] },
      };
      downloadStructuredPdf({
        title: "Planificación anual",
        subtitle: "Documento anual del curso con estructura pedagógica, contenidos, evaluación, clases y bibliografía.",
        filename: `planificacion-anual-${planId.slice(0, 8)}.pdf`,
        generatedAt: new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "long", year: "numeric" }).format(new Date()),
        meta: [{ label: "Documento", value: "Planificación anual" }, { label: "Plan", value: planId.slice(0, 8).toUpperCase() }],
        sections: EXPORT_ORDER.map((key) => sections[key]),
      });
    } catch (error: unknown) {
      toast({ title: "No se pudo exportar el imprimible", description: formatErrorMessage(error), variant: "destructive" });
    } finally {
      setExportingPdf(false);
    }
  };

  if (loading || !plan) return <Card><CardContent className="py-8 text-center"><p className="text-muted-foreground">Cargando planificación anual...</p></CardContent></Card>;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="gap-4 border-b bg-card/95">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="text-xl">Planificación anual</CardTitle>
            <p className="text-sm text-muted-foreground">La anual se organiza como documento pedagógico: fundamento, objetivos, estrategias, contenidos, evaluación, clases, recursos y bibliografía.</p>
          </div>
          {renderStatusBadge()}
        </div>
        <div className="flex flex-wrap gap-2">
          {!readOnly ? <Button type="button" variant="outline" onClick={handleRebuildPlan} disabled={bootstrapping || !curriculumDocumentId}><RotateCcw className="mr-2 h-4 w-4" />{bootstrapping ? "Reconstruyendo..." : "Reconstruir borrador anual"}</Button> : null}
          <Button type="button" variant="outline" onClick={handleExportPlanPdf} disabled={exportingPdf}><Download className="mr-2 h-4 w-4" />{exportingPdf ? "Exportando..." : "Exportar imprimible"}</Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-5 pt-6">
        <InlineValidationSummary errors={validationErrors} />
        {repairGuidance.length > 0 ? <div className="rounded-xl border border-warning/30 bg-warning/10 p-4"><p className="text-sm font-medium text-warning">Ajustes sugeridos para validar la anual</p><div className="mt-2 space-y-1 text-sm text-foreground">{repairGuidance.map((step, index) => <p key={`${step}-${index}`}>{step}</p>)}</div></div> : null}
        <Tabs defaultValue="fundamentacion" className="space-y-5">
          <TabsList className="grid h-auto w-full grid-cols-4 gap-2 rounded-2xl bg-muted/40 p-2">
            {PLAN_SECTIONS.map((section) => <TabsTrigger key={section.value} value={section.value} className="h-auto min-h-14 whitespace-normal rounded-xl px-3 py-3 text-center text-sm leading-snug data-[state=active]:bg-background data-[state=active]:shadow-sm">{section.label}</TabsTrigger>)}
          </TabsList>
          <TabsContent value="fundamentacion" className="space-y-4">
            <Card className="border-muted"><CardContent className="space-y-4 pt-5"><div className="flex items-center justify-between gap-3"><Label>Lectura de la fundamentación</Label><Button type="button" variant="ghost" size="sm" onClick={() => setExpandedField("fundamentacion")}><Maximize2 className="mr-2 h-4 w-4" />Expandir</Button></div><div className="rounded-2xl border bg-background p-5">{(splitParagraphs(plan.fundamentacion).length > 0 ? splitParagraphs(plan.fundamentacion) : ["Todavía no hay fundamentación cargada."]).map((paragraph, index) => <p key={`${paragraph}-${index}`} className="text-sm leading-7 text-foreground indent-6 [&:not(:first-child)]:mt-5">{paragraph}</p>)}</div><Textarea value={plan.fundamentacion} onChange={(event) => updateField("fundamentacion", event.target.value)} rows={10} disabled={readOnly} placeholder="Desarrolla la fundamentación anual con varios párrafos y lenguaje académico-docente claro." /></CardContent></Card>
          </TabsContent>
          <TabsContent value="propositos"><PlanObjectivesEditor planId={planId} readOnly={readOnly} onDirty={transitionToEdited} /></TabsContent>
          <TabsContent value="estrategias" className="space-y-4">
            <Card><CardContent className="space-y-4 pt-5"><div className="flex items-center justify-between gap-3"><Label>Estrategia marco</Label><Button type="button" variant="ghost" size="sm" onClick={() => setExpandedField("estrategias_marco")}><Maximize2 className="mr-2 h-4 w-4" />Expandir</Button></div><Textarea value={plan.estrategias_marco} onChange={(event) => updateField("estrategias_marco", event.target.value)} rows={5} disabled={readOnly} placeholder="Explica el enfoque metodológico general del curso." /></CardContent></Card>
            <StructuredListEditor items={plan.estrategias_practicas.map((strategy, index) => ({ id: String(index), value: strategy }))} label="Estrategias prácticas" itemLabel="Estrategia práctica" helper="Las estrategias prácticas deben verse y gestionarse con la misma lógica clara y editable que los objetivos." addLabel="Agregar estrategia" emptyLabel="Todavía no hay estrategias prácticas definidas." readOnly={readOnly} minItems={1} maxItems={8} onAdd={addStrategy} onDelete={(id) => removeStrategy(Number(id))} onChange={(id, value) => updateStrategy(Number(id), value)} onBlur={(id, value) => updateStrategy(Number(id), value)} />
          </TabsContent>
          <TabsContent value="contenidos" className="space-y-4">
            <PlanContentBlocksEditor planId={planId} readOnly={readOnly} onDirty={transitionToEdited} />
            <Card><CardContent className="space-y-3 pt-5"><div><p className="text-sm font-medium text-foreground">Anclaje curricular mapeado</p><p className="text-xs text-muted-foreground">Estos nodos sostienen la trazabilidad curricular del plan, pero no reemplazan la organización anual en bloques.</p></div><div className="space-y-2">{visibleMappedNodes.length > 0 ? visibleMappedNodes.map((node) => <p key={node.id} className="text-sm text-foreground">{node.name}</p>) : <p className="text-sm text-muted-foreground">No hay contenidos curriculares mapeados. Revisa el programa oficial y reconstruye el borrador anual.</p>}</div></CardContent></Card>
          </TabsContent>
          <TabsContent value="evaluacion" className="space-y-4">
            <Card><CardContent className="space-y-4 pt-5"><div className="flex items-center justify-between gap-3"><Label>Criterios de evaluación</Label><Button type="button" variant="ghost" size="sm" onClick={() => setExpandedField("evaluacion_marco")}><Maximize2 className="mr-2 h-4 w-4" />Expandir</Button></div><Textarea value={plan.evaluacion_marco} onChange={(event) => updateField("evaluacion_marco", event.target.value)} rows={6} disabled={readOnly} placeholder="Explica los criterios generales de evaluación del curso." /></CardContent></Card>
            <PlanRubricsEditor planId={planId} readOnly={readOnly} onDirty={transitionToEdited} />
          </TabsContent>
          <TabsContent value="clases"><PlanLessonsEditor planId={planId} courseId={courseId} readOnly={readOnly} onDirty={transitionToEdited} /></TabsContent>
          <TabsContent value="recursos" className="space-y-4">
            <Card><CardContent className="space-y-4 pt-5"><div className="flex items-center justify-between gap-3"><Label>Recursos y soportes de trabajo</Label><Button type="button" variant="ghost" size="sm" onClick={() => setExpandedField("resources")}><Maximize2 className="mr-2 h-4 w-4" />Expandir</Button></div><Textarea value={plan.resources} onChange={(event) => updateField("resources", event.target.value)} rows={7} disabled={readOnly} placeholder="Describe recursos, soportes, bibliografía de trabajo, formas de uso y alternativas low-tech." /></CardContent></Card>
          </TabsContent>
          <TabsContent value="bibliografia" className="space-y-4">
            <Card><CardContent className="space-y-4 pt-5"><div><p className="text-sm font-medium text-foreground">Bibliografía curricular</p><p className="text-xs text-muted-foreground">Referencias detectadas en el diseño curricular oficial del curso.</p></div><div className="space-y-2">{curriculumBibliographyNodes.length > 0 ? curriculumBibliographyNodes.map((node) => <p key={node.id} className="text-sm text-foreground">{node.name}</p>) : <p className="text-sm text-muted-foreground">No se detectó bibliografía curricular en la planificación. Esto debe revisarse en el documento curricular o en su reparación.</p>}</div></CardContent></Card>
            <PlanTeacherBibliographyEditor planId={planId} readOnly={readOnly} onDirty={transitionToEdited} />
          </TabsContent>
        </Tabs>
        {!readOnly && currentStatus !== "VALIDATED" ? <Button onClick={handleValidate} disabled={validating} className="w-full"><ShieldCheck className="mr-2 h-4 w-4" />{validating ? "Validando..." : currentStatus === "EDITED" ? "Validar cambios" : "Validar plan"}</Button> : null}
        <Dialog open={!!expandedField} onOpenChange={(open) => !open && setExpandedField(null)}>
          <DialogContent className="max-w-5xl"><DialogHeader><DialogTitle>{expandedField ? fieldTitles[expandedField] : "Editor"}</DialogTitle></DialogHeader>{expandedField ? <Textarea value={plan[expandedField]} onChange={(event) => updateField(expandedField, event.target.value)} rows={24} disabled={readOnly} className="max-h-[70vh] min-h-[60vh]" /> : null}</DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
