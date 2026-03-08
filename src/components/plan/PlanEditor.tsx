import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { X, Plus, RotateCcw, ShieldCheck, Maximize2, Download, ArrowUp, ArrowDown } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import PlanObjectivesEditor from "./PlanObjectivesEditor";
import PlanLessonsEditor, { fetchLessonUnitMap } from "./PlanLessonsEditor";
import { InlineValidationSummary } from "@/components/ui/InlineValidationSummary";
import type { Tables } from "@/integrations/supabase/types";
import { formatErrorMessage } from "@/lib/errors";
import { downloadStructuredPdf } from "@/lib/pdfExport";
import { extractBibliographyProtocolNodes, type BibliographyProtocolNode } from "@/lib/bibliographyProtocol";

interface PlanData {
  fundamentacion: string;
  estrategias_marco: string;
  estrategias_practicas: string[];
  evaluacion_marco: string;
  resources: string;
  bibliografia_curso: string;
}

interface MappedCurriculumNode {
  id: string;
  name: string;
  node_type: string;
  parent_id?: string | null;
  order_index?: number | null;
}

interface BibNode extends BibliographyProtocolNode {
  parent_id: string | null;
  order_index?: number;
}

interface GroupedContent {
  groupLabel: string;
  groupType: string;
  children: MappedCurriculumNode[];
}

type PlanExportSectionKey =
  | "fundamentacion"
  | "objetivos"
  | "estrategias"
  | "contenidos"
  | "evaluacion"
  | "clases"
  | "recursos"
  | "bibliografia";

const DEFAULT_PLAN_EXPORT_ORDER: PlanExportSectionKey[] = [
  "fundamentacion",
  "objetivos",
  "estrategias",
  "contenidos",
  "evaluacion",
  "clases",
  "recursos",
  "bibliografia",
];

const PLAN_EXPORT_LABELS: Record<PlanExportSectionKey, string> = {
  fundamentacion: "Fundamentación",
  objetivos: "Objetivos",
  estrategias: "Estrategias",
  contenidos: "Contenidos",
  evaluacion: "Evaluación",
  clases: "Clases",
  recursos: "Recursos",
  bibliografia: "Bibliografía",
};

type ExpandableField = "fundamentacion" | "estrategias_marco" | "evaluacion_marco" | "resources" | "bibliografia_curso";

const fieldTitles: Record<ExpandableField, string> = {
  fundamentacion: "Fundamentación",
  estrategias_marco: "Estrategia marco",
  evaluacion_marco: "Evaluación",
  resources: "Recursos",
  bibliografia_curso: "Bibliografía del curso",
};

interface Props {
  planId: string;
  courseId: string;
  curriculumDocumentId?: string | null;
  planStatus: string;
  onValidated: () => void;
  courseArchived?: boolean;
}

type PlanStatus = Tables<"plans">["status"];

function buildRepairGuidance(errors: string[]) {
  const steps: string[] = [];
  const lessonIssues = new Map<number, string[]>();

  for (const error of errors) {
    if (error.includes("Fundamentacion")) {
      steps.push("Revise la pestaña Fundamentación y extienda el marco del plan hasta dejar una base anual útil.");
      continue;
    }
    if (error.includes("Estrategias marco") || error.includes("estrategia practica")) {
      steps.push("Revise la pestaña Estrategias y complete tanto el enfoque general como al menos una estrategia práctica.");
      continue;
    }
    if (error.includes("Evaluacion marco")) {
      steps.push("Revise la pestaña Evaluación y explicite cómo se seguirá y recuperará el trabajo del curso.");
      continue;
    }
    if (error.includes("Recursos")) {
      steps.push("Revise la pestaña Recursos y complete los soportes, materiales y alternativas low-tech del plan.");
      continue;
    }
    if (error.includes("propositos")) {
      steps.push("Revise la pestaña Objetivos y deje entre 4 y 8 objetivos observables.");
      continue;
    }
    if (error.includes("contenido curricular mapeado")) {
      steps.push("La base curricular no quedó bien enlazada: rearme el borrador curricular o revise el programa asociado al curso.");
      continue;
    }
    if (error.includes("Ya existen lecciones para este curso")) {
      steps.push("El curso ya tiene lecciones creadas. Si hubo cambios fuertes, use la revalidación o rearme el borrador en lugar de validar como plan nuevo.");
      continue;
    }

    const lessonMatch = error.match(/^Clase\s+(\d+):\s+(.*)$/i);
    if (lessonMatch) {
      const lessonNumber = Number(lessonMatch[1]);
      const issue = lessonMatch[2];
      const current = lessonIssues.get(lessonNumber) || [];
      current.push(issue);
      lessonIssues.set(lessonNumber, current);
    }
  }

  const lessonRepairs = Array.from(lessonIssues.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([lessonNumber, issues]) => {
      const normalizedIssues = issues.map((issue) => issue.replace(" es obligatorio", "").trim().toLowerCase());
      return `Clase ${lessonNumber}: revise ${normalizedIssues.join(", ")} en la pestaña Clases.`;
    });

  return Array.from(new Set([...steps, ...lessonRepairs]));
}

function isLikelyBibliographyNode(name: string): boolean {
  const trimmed = name.trim();
  const commaCount = (trimmed.match(/,/g) || []).length;
  const hasAuthorPrefix = /^[A-ZÁÉÍÓÚÑ][^,]{1,90},/.test(trimmed);
  const hasYear = /\b(1[89]\d{2}|20\d{2})\b/.test(trimmed);
  const hasEditionFallback = /\bvarias\s+ediciones\b/i.test(trimmed);

  return hasAuthorPrefix && commaCount >= 2 && (hasYear || hasEditionFallback || commaCount >= 3);
}

function isAuthorityOrNoiseNode(name: string): boolean {
  const normalized = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, "");

  return (
    normalized.includes("isbn") ||
    normalized.includes("cdd") ||
    normalized.includes("disenocurricular") ||
    normalized.includes("educacionsecundaria") ||
    normalized.includes("directorageneral") ||
    normalized.includes("presidentadelconsejo") ||
    normalized.includes("subsecretariadeeducacion") ||
    normalized.includes("directoraprovincial") ||
    normalized.includes("equipodeespecialistas") ||
    normalized.includes("autoridades")
  );
}

export default function PlanEditor({
  planId,
  courseId,
  curriculumDocumentId,
  planStatus,
  onValidated,
  courseArchived,
}: Props) {
  const [plan, setPlan] = useState<PlanData | null>(null);
  const [loading, setLoading] = useState(true);
  const [validating, setValidating] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [newStrategy, setNewStrategy] = useState("");
  const [expandedField, setExpandedField] = useState<ExpandableField | null>(null);
  const [bibliographyNodes, setBibliographyNodes] = useState<BibNode[]>([]);
  const [groupedContent, setGroupedContent] = useState<GroupedContent[]>([]);
  const [contentFromFallback, setContentFromFallback] = useState(false);
  const [currentStatus, setCurrentStatus] = useState(planStatus);
  const [hasEditedAfterValidation, setHasEditedAfterValidation] = useState(false);
  const [exportOrder, setExportOrder] = useState<PlanExportSectionKey[]>(DEFAULT_PLAN_EXPORT_ORDER);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const transitioningRef = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const readOnly = !!courseArchived;
  const repairGuidance = buildRepairGuidance(validationErrors);

  useEffect(() => {
    setCurrentStatus(planStatus);
    setHasEditedAfterValidation(planStatus === "EDITED");
  }, [planStatus]);

  const fetchMappedNodes = useCallback(async () => {
    const { data: mappings } = await supabase
      .from("plan_content_mappings")
      .select("curriculum_node_id")
      .eq("plan_id", planId);

    const nodeIds = Array.from(new Set((mappings || []).map((mapping) => mapping.curriculum_node_id)));

    let contentNodes: MappedCurriculumNode[] = [];
    if (nodeIds.length > 0) {
      const { data: nodes } = await supabase
        .from("curriculum_nodes")
        .select("id, name, node_type, parent_id, order_index")
        .in("id", nodeIds)
        .order("order_index");
      contentNodes = ((nodes || []) as MappedCurriculumNode[]).filter((n) => !isAuthorityOrNoiseNode(n.name) && !isLikelyBibliographyNode(n.name));
    }

    // Fallback: if no mappings but curriculum document exists, load nodes directly
    let usingFallback = false;
    if (contentNodes.length === 0 && curriculumDocumentId) {
      const { data: docNodes } = await supabase
        .from("curriculum_nodes")
        .select("id, name, node_type, parent_id, order_index")
        .eq("curriculum_document_id", curriculumDocumentId)
        .in("node_type", ["UNIDAD", "BLOQUE", "CONTENIDO"])
        .order("order_index");
      contentNodes = ((docNodes || []) as MappedCurriculumNode[]).filter((n) => !isAuthorityOrNoiseNode(n.name) && !isLikelyBibliographyNode(n.name));
      usingFallback = contentNodes.length > 0;
    }
    setContentFromFallback(usingFallback);

    const parentIds = Array.from(new Set(contentNodes.map((n) => n.parent_id).filter(Boolean))) as string[];
    let parentMap = new Map<string, { name: string; node_type: string }>();
    if (parentIds.length > 0) {
      const { data: parents } = await supabase
        .from("curriculum_nodes")
        .select("id, name, node_type")
        .in("id", parentIds);
      (parents || []).forEach((p) => parentMap.set(p.id, { name: p.name, node_type: p.node_type }));
    }

    const groups = new Map<string, GroupedContent>();
    contentNodes.forEach((node) => {
      const parentKey = node.parent_id || "__root__";
      if (!groups.has(parentKey)) {
        const parent = node.parent_id ? parentMap.get(node.parent_id) : null;
        groups.set(parentKey, {
          groupLabel: parent?.name || "Otros contenidos",
          groupType: parent?.node_type || "",
          children: [],
        });
      }
      groups.get(parentKey)!.children.push(node);
    });
    setGroupedContent(Array.from(groups.values()));

    if (curriculumDocumentId) {
      const { data: allDocNodes } = await supabase
        .from("curriculum_nodes")
        .select("id, name, node_type, parent_id, order_index")
        .eq("curriculum_document_id", curriculumDocumentId)
        .order("order_index");
      setBibliographyNodes(extractBibliographyProtocolNodes((allDocNodes || []) as BibNode[]));
    } else {
      setBibliographyNodes([]);
    }
  }, [planId, curriculumDocumentId]);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("plans")
        .select("fundamentacion, estrategias_marco, estrategias_practicas, evaluacion_marco, resources, bibliografia_curso")
        .eq("id", planId)
        .single();

      if (data) setPlan(data as PlanData);
      await fetchMappedNodes();
      setLoading(false);
    };

    fetch();
  }, [planId, fetchMappedNodes]);

  const transitionToEdited = useCallback(async () => {
    if (transitioningRef.current || readOnly) return;
    if (currentStatus !== "VALIDATED") return;

    transitioningRef.current = true;
    await supabase.from("plans").update({ status: "EDITED" as PlanStatus }).eq("id", planId);
    setCurrentStatus("EDITED");
    setHasEditedAfterValidation(true);
    transitioningRef.current = false;
  }, [currentStatus, planId, readOnly]);

  const saveField = useCallback(
    (field: keyof PlanData, value: string | string[]) => {
      if (readOnly) return;

      setValidationErrors([]);
      if (saveTimer.current) clearTimeout(saveTimer.current);

      saveTimer.current = setTimeout(async () => {
        if (currentStatus === "VALIDATED") {
          await transitionToEdited();
        }

        await supabase.from("plans").update({ [field]: value }).eq("id", planId);
      }, 500);
    },
    [currentStatus, planId, readOnly, transitionToEdited]
  );

  const updateField = (field: keyof PlanData, value: string) => {
    setPlan((prev) => (prev ? { ...prev, [field]: value } : prev));
    saveField(field, value);
  };

  const addStrategy = () => {
    if (!newStrategy.trim() || !plan) return;
    const updated = [...plan.estrategias_practicas, newStrategy.trim()];
    setPlan({ ...plan, estrategias_practicas: updated });
    setNewStrategy("");
    saveField("estrategias_practicas", updated);
  };

  const removeStrategy = (idx: number) => {
    if (!plan) return;
    const updated = plan.estrategias_practicas.filter((_, i) => i !== idx);
    setPlan({ ...plan, estrategias_practicas: updated });
    saveField("estrategias_practicas", updated);
  };

  const handleRebuildPlan = async () => {
    if (!curriculumDocumentId) {
      toast({
        title: "Falta base curricular",
        description: "Este curso no tiene un documento curricular persistido para rearmar el borrador.",
        variant: "destructive",
      });
      return;
    }

    setBootstrapping(true);
    setValidationErrors([]);

    try {
      const { data, error } = await supabase.functions.invoke("bootstrap-course-plan", {
        body: {
          course_id: courseId,
          plan_id: planId,
          curriculum_document_id: curriculumDocumentId,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const { data: refreshedPlan } = await supabase
        .from("plans")
        .select("fundamentacion, estrategias_marco, estrategias_practicas, evaluacion_marco, resources, bibliografia_curso")
        .eq("id", planId)
        .single();

      if (refreshedPlan) setPlan(refreshedPlan as PlanData);
      await fetchMappedNodes();

      const nextStatus =
        data?.plan_status === "EDITED" || data?.plan_status === "VALIDATED" ? data.plan_status : "INCOMPLETE";
      setCurrentStatus(nextStatus);
      setHasEditedAfterValidation(nextStatus === "EDITED");

      toast({
        title: "Borrador reconstruido",
        description: data?.synthetic_nodes_created
          ? "Se regeneró el plan y se creó una estructura curricular mínima porque el documento aún no tenía nodos procesados."
          : "Se regeneró la base anual del plan a partir del programa oficial del curso.",
      });
      onValidated();
    } catch (err: unknown) {
      toast({
        title: "No se pudo reconstruir el borrador",
        description: formatErrorMessage(err),
        variant: "destructive",
      });
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
        toast({
          title: "Validación fallida",
          description: result.errors.join(". "),
          variant: "destructive",
        });
        return;
      }

      toast({
        title: hasEditedAfterValidation ? "Plan revalidado" : "Plan validado",
        description: hasEditedAfterValidation
          ? "Los cambios fueron validados correctamente."
          : "Se crearon las lecciones del curso.",
      });
      onValidated();
    } catch (err: unknown) {
      toast({ title: "Error", description: formatErrorMessage(err), variant: "destructive" });
    } finally {
      setValidating(false);
    }
  };

  const moveExportSection = (index: number, offset: -1 | 1) => {
    const nextIndex = index + offset;
    if (nextIndex < 0 || nextIndex >= exportOrder.length) return;
    const nextOrder = [...exportOrder];
    [nextOrder[index], nextOrder[nextIndex]] = [nextOrder[nextIndex], nextOrder[index]];
    setExportOrder(nextOrder);
  };

  const renderStatusBadge = () => {
    switch (currentStatus) {
      case "VALIDATED":
        return <Badge variant="default">Validado</Badge>;
      case "EDITED":
        return (
          <div className="flex items-center gap-2">
            <Badge variant="destructive">Editado</Badge>
            <span className="text-xs text-muted-foreground">Requiere revalidación</span>
          </div>
        );
      default:
        return <Badge variant="secondary">Incompleto</Badge>;
    }
  };

  const allContentNodes = groupedContent.flatMap((g) => g.children);

  const handleExportPlanPdf = async () => {
    setExportingPdf(true);

    try {
      const [{ data: objectives, error: objectivesError }, { data: planLessons, error: lessonsError }, lessonUnits] =
        await Promise.all([
          supabase
            .from("plan_objectives")
            .select("description, order_index")
            .eq("plan_id", planId)
            .order("order_index"),
          supabase
            .from("plan_lessons")
            .select("id, lesson_number, term, theme, justification, learning_outcome, activities_summary")
            .eq("plan_id", planId)
            .order("lesson_number"),
          fetchLessonUnitMap(planId),
        ]);

      if (objectivesError) throw objectivesError;
      if (lessonsError) throw lessonsError;

      const objectiveLines =
        (objectives || [])
          .map((objective, index) => objective.description?.trim() ? `${index + 1}. ${objective.description.trim()}` : "")
          .filter(Boolean) || [];

      const strategiesLines = [
        plan.estrategias_marco?.trim() ? `Marco: ${plan.estrategias_marco.trim()}` : "",
        ...(plan.estrategias_practicas || [])
          .map((strategy, index) => strategy.trim() ? `Estrategia práctica ${index + 1}: ${strategy.trim()}` : "")
          .filter(Boolean),
      ].filter(Boolean);

      const classesLines =
        (planLessons || [])
          .map((lesson) => {
            const unitName = lessonUnits.get(lesson.id);
            const chunks = [
              `Clase ${lesson.lesson_number}.`,
              unitName ? `Unidad: ${unitName}.` : "",
              lesson.theme?.trim() ? `Tema: ${lesson.theme.trim()}.` : "",
            ].filter(Boolean);
            return chunks.join(" ");
          })
          .filter(Boolean) || [];

      const bibliografiaLines = [
        ...(bibliographyNodes.length > 0
          ? ["Bibliografía curricular:", ...bibliographyNodes.map((node, index) => `  ${index + 1}. ${node.name}`)]
          : ["Sin bibliografía curricular detectada."]),
        "",
        ...(plan.bibliografia_curso?.trim()
          ? ["Bibliografía del curso:", plan.bibliografia_curso.trim()]
          : ["Sin bibliografía del curso cargada."]),
      ];

      const sectionContent: Record<PlanExportSectionKey, { title: string; body: string[] }> = {
        fundamentacion: {
          title: "Fundamentación",
          body: [plan.fundamentacion?.trim() || "Sin fundamentación cargada."],
        },
        objetivos: {
          title: "Objetivos",
          body: objectiveLines.length > 0 ? objectiveLines : ["Sin objetivos cargados."],
        },
        estrategias: {
          title: "Estrategias",
          body: strategiesLines.length > 0 ? strategiesLines : ["Sin estrategias cargadas."],
        },
        contenidos: {
          title: "Contenidos",
          body:
            allContentNodes.length > 0
              ? groupedContent.flatMap((g) => [
                  g.groupLabel,
                  ...g.children.map((node) => `  • ${node.name}`),
                ])
              : ["Sin contenidos curriculares mapeados."],
        },
        evaluacion: {
          title: "Evaluación",
          body: [plan.evaluacion_marco?.trim() || "Sin criterios de evaluación cargados."],
        },
        clases: {
          title: "Clases",
          body: classesLines.length > 0 ? classesLines : ["Sin clases cargadas."],
        },
        recursos: {
          title: "Recursos",
          body: [plan.resources?.trim() || "Sin recursos cargados."],
        },
        bibliografia: {
          title: "Bibliografía",
          body: bibliografiaLines,
        },
      };

      downloadStructuredPdf({
        title: "Planificación anual",
        subtitle: "Documento de trabajo anual con fundamento, objetivos, estrategias, contenidos y recorrido de clases.",
        filename: `planificacion-anual-${planId.slice(0, 8)}.pdf`,
        generatedAt: new Intl.DateTimeFormat("es-AR", {
          day: "2-digit",
          month: "long",
          year: "numeric",
        }).format(new Date()),
        meta: [
          { label: "Documento", value: "Planificación anual" },
          { label: "Plan", value: planId.slice(0, 8).toUpperCase() },
        ],
        sections: exportOrder.map((sectionKey) => sectionContent[sectionKey]),
      });
    } catch (err: unknown) {
      toast({
        title: "No se pudo exportar el imprimible",
        description: formatErrorMessage(err),
        variant: "destructive",
      });
    } finally {
      setExportingPdf(false);
    }
  };

  const ctaLabel = currentStatus === "EDITED" ? "Validar cambios" : "Validar plan";
  const showCta = !readOnly && !courseArchived && currentStatus !== "VALIDATED";

  if (loading || !plan) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-muted-foreground">Cargando plan...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg">Planificación anual</CardTitle>
        {renderStatusBadge()}
      </CardHeader>
      <CardContent className="space-y-4">
        <InlineValidationSummary errors={validationErrors} />
        {repairGuidance.length > 0 && (
          <div className="rounded-lg border border-warning/30 bg-warning/10 p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-warning">
              <ShieldCheck className="h-4 w-4" />
              Reparación sugerida
            </div>
            <div className="space-y-1 text-sm text-foreground">
              {repairGuidance.map((step, index) => (
                <p key={`${step}-${index}`}>{step}</p>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {!readOnly && (
            <Button
              type="button"
              variant="outline"
              onClick={handleRebuildPlan}
              disabled={bootstrapping || !curriculumDocumentId}
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              {bootstrapping ? "Reconstruyendo..." : "Rearmar borrador curricular"}
            </Button>
          )}
          <Button type="button" variant="outline" onClick={() => setShowExportDialog(true)} disabled={exportingPdf}>
            <Download className="mr-2 h-4 w-4" />
            {exportingPdf ? "Exportando..." : "Exportar imprimible"}
          </Button>
        </div>

        <Dialog open={showExportDialog} onOpenChange={setShowExportDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Exportar imprimible anual</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              Ordená las secciones del PDF antes de exportar. Este orden no modifica la planificación.
            </p>
            <div className="space-y-1">
              {exportOrder.map((sectionKey, index) => (
                <div key={sectionKey} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                  <span>
                    {index + 1}. {PLAN_EXPORT_LABELS[sectionKey]}
                  </span>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => moveExportSection(index, -1)}
                      disabled={index === 0}
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => moveExportSection(index, 1)}
                      disabled={index === exportOrder.length - 1}
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between pt-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-xs"
                onClick={() => setExportOrder(DEFAULT_PLAN_EXPORT_ORDER)}
              >
                <RotateCcw className="mr-1 h-3 w-3" />
                Restablecer orden
              </Button>
              <Button
                type="button"
                onClick={() => { setShowExportDialog(false); handleExportPlanPdf(); }}
                disabled={exportingPdf}
              >
                <Download className="mr-2 h-4 w-4" />
                Exportar PDF
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* ========= NAVEGACIÓN 2×4 ========= */}
        <Tabs defaultValue="fundamentacion">
          <div className="rounded-lg bg-muted p-1.5 space-y-1">
            <TabsList className="grid w-full grid-cols-4 bg-transparent h-auto p-0">
              <TabsTrigger value="fundamentacion" className="text-xs sm:text-sm py-2.5">Fundamentación</TabsTrigger>
              <TabsTrigger value="objetivos" className="text-xs sm:text-sm py-2.5">Objetivos</TabsTrigger>
              <TabsTrigger value="estrategias" className="text-xs sm:text-sm py-2.5">Estrategias</TabsTrigger>
              <TabsTrigger value="contenidos" className="text-xs sm:text-sm py-2.5">Contenidos</TabsTrigger>
            </TabsList>
            <TabsList className="grid w-full grid-cols-4 bg-transparent h-auto p-0">
              <TabsTrigger value="evaluacion" className="text-xs sm:text-sm py-2.5">Evaluación</TabsTrigger>
              <TabsTrigger value="clases" className="text-xs sm:text-sm py-2.5">Clases</TabsTrigger>
              <TabsTrigger value="recursos" className="text-xs sm:text-sm py-2.5">Recursos</TabsTrigger>
              <TabsTrigger value="bibliografia" className="text-xs sm:text-sm py-2.5">Bibliografía</TabsTrigger>
            </TabsList>
          </div>

          {/* 1. FUNDAMENTACIÓN */}
          <TabsContent value="fundamentacion" className="space-y-2 pt-4">
            <div className="flex items-center justify-between gap-2">
              <Label className="text-base font-semibold">Fundamentación</Label>
              <Button type="button" variant="ghost" size="sm" onClick={() => setExpandedField("fundamentacion")}>
                <Maximize2 className="mr-2 h-4 w-4" />
                Expandir editar
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Texto académico-docente que sostiene el enfoque del curso. Cada párrafo debe arrancar con sangría y mantener interlineado formal.
            </p>
            <Textarea
              value={plan.fundamentacion}
              onChange={(e) => updateField("fundamentacion", e.target.value)}
              placeholder="Escribir la fundamentación del plan anual..."
              rows={10}
              disabled={readOnly}
              onDoubleClick={() => setExpandedField("fundamentacion")}
              className="indent-8 leading-relaxed whitespace-pre-wrap"
            />
            <p className="text-xs text-muted-foreground">{plan.fundamentacion.length} caracteres</p>
          </TabsContent>

          {/* 2. OBJETIVOS */}
          <TabsContent value="objetivos" className="pt-4">
            <div className="space-y-2">
              <Label className="text-base font-semibold">Objetivos del curso</Label>
              <p className="text-xs text-muted-foreground">
                Listado de 4 a 8 objetivos observables del curso. Cada objetivo debe expresar lo que el estudiantado podrá hacer al cierre del año.
              </p>
            </div>
            <div className="mt-3">
              <PlanObjectivesEditor planId={planId} readOnly={readOnly} onDirty={transitionToEdited} />
            </div>
          </TabsContent>

          {/* 3. ESTRATEGIAS */}
          <TabsContent value="estrategias" className="space-y-4 pt-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label className="text-base font-semibold">Estrategia marco</Label>
                <Button type="button" variant="ghost" size="sm" onClick={() => setExpandedField("estrategias_marco")}>
                  <Maximize2 className="mr-2 h-4 w-4" />
                  Expandir editar
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Enfoque general que organiza la enseñanza durante el año. Describe la lógica didáctica que atraviesa todo el curso.
              </p>
              <Textarea
                value={plan.estrategias_marco}
                onChange={(e) => updateField("estrategias_marco", e.target.value)}
                placeholder="Describir el enfoque estratégico general del curso..."
                rows={4}
                disabled={readOnly}
                onDoubleClick={() => setExpandedField("estrategias_marco")}
                className="indent-8 leading-relaxed"
              />
            </div>

            <div className="space-y-3">
              <Label className="text-base font-semibold">Estrategias prácticas</Label>
              <p className="text-xs text-muted-foreground">
                Estrategias concretas que se aplicarán en las clases. Agregue y quite según necesidad.
              </p>
              <div className="space-y-2">
                {plan.estrategias_practicas.map((strategy, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <span className="text-sm font-medium text-muted-foreground w-6 shrink-0">{index + 1}.</span>
                    <Input
                      value={strategy}
                      onChange={(e) => {
                        const updated = [...plan.estrategias_practicas];
                        updated[index] = e.target.value;
                        setPlan({ ...plan, estrategias_practicas: updated });
                      }}
                      onBlur={() => saveField("estrategias_practicas", plan.estrategias_practicas)}
                      disabled={readOnly}
                      placeholder="Describir estrategia práctica..."
                    />
                    {!readOnly && (
                      <Button variant="ghost" size="icon" onClick={() => removeStrategy(index)}>
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
              {!readOnly && (
                <div className="flex gap-2">
                  <Input
                    value={newStrategy}
                    onChange={(e) => setNewStrategy(e.target.value)}
                    placeholder="Nueva estrategia práctica..."
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addStrategy())}
                  />
                  <Button type="button" variant="outline" size="sm" onClick={addStrategy}>
                    <Plus className="h-4 w-4 mr-1" /> Agregar
                  </Button>
                </div>
              )}
            </div>
          </TabsContent>

          {/* 4. CONTENIDOS */}
          <TabsContent value="contenidos" className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label className="text-base font-semibold">Contenidos curriculares del plan</Label>
              <p className="text-xs text-muted-foreground">
                Estructura anual del contenido organizada por bloques, unidades o ejes. Estos temas son la base que luego se desarrollará en las clases.
              </p>
            </div>
            <div className="rounded-md border p-4">
              {contentFromFallback && (
                <div className="rounded-md bg-warning/10 border border-warning/30 p-3 mb-3">
                  <p className="text-sm text-warning font-medium">Contenidos cargados desde el programa oficial</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Estos contenidos provienen directamente del documento curricular. Para vincularlos al plan y a cada clase, use el botón "Rearmar borrador curricular".
                  </p>
                </div>
              )}
              <p className="text-sm text-muted-foreground mb-3">
                {allContentNodes.length} contenidos del programa curricular.
              </p>
              <div className="max-h-80 space-y-4 overflow-y-auto pr-1">
                {groupedContent.length > 0 ? (
                  groupedContent.map((group) => (
                    <div key={group.groupLabel} className="space-y-1.5">
                      <p className="text-sm font-semibold text-foreground">
                        {group.groupLabel}
                      </p>
                      {group.children.map((node) => (
                        <p key={node.id} className="pl-4 text-sm text-muted-foreground">
                          • {node.name}
                        </p>
                      ))}
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No hay contenidos curriculares mapeados. Revisá el programa oficial y volvé a rearmar el borrador.
                  </p>
                )}
              </div>
            </div>
          </TabsContent>

          {/* 5. EVALUACIÓN */}
          <TabsContent value="evaluacion" className="space-y-4 pt-4">
            <div className="flex items-center justify-between gap-2">
              <Label className="text-base font-semibold">Evaluación</Label>
              <Button type="button" variant="ghost" size="sm" onClick={() => setExpandedField("evaluacion_marco")}>
                <Maximize2 className="mr-2 h-4 w-4" />
                Expandir
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Criterios de evaluación y rúbrica articulada con las unidades de contenido. Explicite cómo se seguirá, evaluará y recuperará el trabajo del curso.
            </p>
            <Textarea
              value={plan.evaluacion_marco}
              onChange={(e) => updateField("evaluacion_marco", e.target.value)}
              placeholder="Describir los criterios de evaluación, la rúbrica por unidad o bloque de contenido y los mecanismos de seguimiento y recuperación..."
              rows={8}
              disabled={readOnly}
              onDoubleClick={() => setExpandedField("evaluacion_marco")}
              className="leading-relaxed"
            />
          </TabsContent>

          {/* 6. CLASES */}
          <TabsContent value="clases" className="pt-4">
            <div className="space-y-2 mb-3">
              <Label className="text-base font-semibold">Clases del año</Label>
              <p className="text-xs text-muted-foreground">
                Las 28 clases del curso organizadas por cuatrimestre. Cada clase pertenece a una unidad curricular y tiene su propio tema.
              </p>
            </div>
            <PlanLessonsEditor planId={planId} readOnly={readOnly} onDirty={transitionToEdited} />
          </TabsContent>

          {/* 7. RECURSOS */}
          <TabsContent value="recursos" className="space-y-2 pt-4">
            <div className="flex items-center justify-between gap-2">
              <Label className="text-base font-semibold">Recursos</Label>
              <Button type="button" variant="ghost" size="sm" onClick={() => setExpandedField("resources")}>
                <Maximize2 className="mr-2 h-4 w-4" />
                Expandir
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Sección metodológica-instrumental: qué recursos se utilizarán, cómo se aprovechará la bibliografía, el programa y la orientación. Incluya herramientas, soportes y formas de trabajo.
            </p>
            <Textarea
              value={plan.resources}
              onChange={(e) => updateField("resources", e.target.value)}
              placeholder="Describir qué recursos se utilizarán para transmitir conocimientos, cómo se aprovechará la bibliografía y el programa, qué herramientas y soportes se emplearán, y cómo se articula con la orientación del curso..."
              rows={8}
              disabled={readOnly}
              onDoubleClick={() => setExpandedField("resources")}
              className="leading-relaxed"
            />
          </TabsContent>

          {/* 8. BIBLIOGRAFÍA */}
          <TabsContent value="bibliografia" className="space-y-6 pt-4">
            {/* Bibliografía curricular */}
            <div className="space-y-2">
              <Label className="text-base font-semibold">Bibliografía curricular</Label>
              <p className="text-xs text-muted-foreground">
                Bibliografía que surge del diseño curricular oficial de la materia.
              </p>
              <div className="rounded-md border p-4">
                <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
                  {bibliographyNodes.length > 0 ? (
                    bibliographyNodes.map((node, index) => (
                      <p key={node.id} className="text-sm">
                        <span className="text-muted-foreground mr-1">{index + 1}.</span> {node.name}
                      </p>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No se detectó bibliografía curricular en el programa importado. Reimportá el programa y rearmá el borrador.
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Bibliografía del curso */}
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label className="text-base font-semibold">Bibliografía del curso</Label>
                <Button type="button" variant="ghost" size="sm" onClick={() => setExpandedField("bibliografia_curso")}>
                  <Maximize2 className="mr-2 h-4 w-4" />
                  Expandir
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Bibliografía propuesta por el docente para este curso en particular.
              </p>
              <Textarea
                value={plan.bibliografia_curso}
                onChange={(e) => updateField("bibliografia_curso", e.target.value)}
                placeholder="Agregar la bibliografía seleccionada para el curso: autores, textos, artículos, recursos digitales..."
                rows={6}
                disabled={readOnly}
                onDoubleClick={() => setExpandedField("bibliografia_curso")}
                className="leading-relaxed"
              />
            </div>
          </TabsContent>
        </Tabs>

        {showCta && (
          <Button onClick={handleValidate} disabled={validating} className="mt-4 w-full">
            <ShieldCheck className="mr-2 h-4 w-4" />
            {validating ? "Validando..." : ctaLabel}
          </Button>
        )}

        <Dialog open={!!expandedField} onOpenChange={(open) => !open && setExpandedField(null)}>
          <DialogContent className="max-w-5xl">
            <DialogHeader>
              <DialogTitle>{expandedField ? fieldTitles[expandedField] : "Editor"}</DialogTitle>
            </DialogHeader>
            {expandedField && (
              <div className="space-y-2">
                <Textarea
                  value={(plan as unknown as Record<string, string>)[expandedField] ?? ""}
                  onChange={(event) => updateField(expandedField, event.target.value)}
                  rows={24}
                  disabled={readOnly}
                  className="max-h-[70vh] min-h-[60vh] leading-relaxed"
                />
                <p className="text-xs text-muted-foreground">{((plan as unknown as Record<string, string>)[expandedField] ?? "").length} caracteres</p>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
