import { useEffect, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, ClipboardEdit, Bot, X, Sparkles } from "lucide-react";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "@/hooks/use-toast";
import BriefForm from "@/components/lesson/BriefForm";
import TeachingMaterialView from "@/components/lesson/TeachingMaterialView";
import ReadingMaterialView from "@/components/lesson/ReadingMaterialView";
import CopilotPanel from "@/components/lesson/CopilotPanel";
import CopilotChat from "@/components/lesson/CopilotChat";
import GenerateButton from "@/components/lesson/GenerateButton";
import { useEntitlements } from "@/hooks/useEntitlements";
import { StatusBadge, briefLabel, briefTone, materialLabel, materialTone, lessonStatusLabel, lessonStatusTone } from "@/components/ui/StatusBadge";
import { StepHeader } from "@/components/ui/StepHeader";
import { SkeletonList } from "@/components/ui/SkeletonList";
import { ThinkingBook } from "@/components/ui/ThinkingBook";
import { LoadingState } from "@/components/ui/LoadingState";
import type { Tables } from "@/integrations/supabase/types";
import { formatErrorMessage, formatFunctionErrorMessage } from "@/lib/errors";
import GuidedTour from "@/components/GuidedTour";
import type { TourStep } from "@/hooks/useTour";

const LESSON_TOUR_STEPS: TourStep[] = [
  {
    id: "brief",
    targetSelector: '[data-tour="lesson-brief"]',
    title: "Indicaciones de la clase",
    description: "Completá los datos del brief: enfoque, dinámica y observaciones. Es lo que la IA usa para generar.",
  },
  {
    id: "generate",
    targetSelector: '[data-tour="lesson-generate"]',
    title: "Generar materiales",
    description: "Una vez que las indicaciones estén listas, usá este botón para generar los materiales con IA.",
  },
  {
    id: "copilot",
    targetSelector: '[data-tour="lesson-copilot"]',
    title: "Copiloto IA",
    description: "Abrí el panel lateral para trabajar con el asistente mientras editás la clase.",
  },
];

type LessonRow = Tables<"lessons">;
type PlanLessonRow = Tables<"plan_lessons">;
type TeachingMaterialRow = Tables<"teaching_materials">;
type ReadingMaterialRow = Tables<"reading_materials">;
type CurriculumNodeRow = Pick<Tables<"curriculum_nodes">, "id" | "name" | "node_type" | "parent_id" | "order_index">;
type LessonBriefRow = Tables<"lesson_briefs"> & {
  authorized_source_ids?: string[] | null;
};
type AuthorizedSourceRow = {
  id: string;
  title: string | null;
  media_type: string | null;
  origin_type: string | null;
  status: string | null;
};
type GenerateMaterialsResponse = {
  error?: string;
  reading_pdf_base64?: string;
  reading_status?: "VALIDATED" | "INVALIDATED" | "skipped";
  reading_validation_issues?: string[];
};

type CourseContextRow = Pick<Tables<"courses">, "subject" | "year_level" | "academic_year"> & {
  schools: Pick<Tables<"schools">, "official_name"> | null;
};

type TeachingActivity = {
  title: string;
  description: string;
  duration_minutes: number;
  type: string;
};

type TeachingDifferentiation = {
  type: string;
  description: string;
};

const AUTHORIZED_SOURCES_TABLE = "authorized_sources" as never;

function extractCanonSummary(activitiesSummary?: string | null, fallbackTheme?: string | null) {
  const summary = (activitiesSummary || "").trim();
  if (!summary) {
    return {
      operation: `Desarrollo guiado sobre ${fallbackTheme || "la clase"}.`,
      evidence: `Produccion breve verificable alineada con ${fallbackTheme || "la clase"}.`,
    };
  }

  const operationMatch = summary.match(/operacion\s*:\s*([\s\S]*?)(?=evidencia minima\s*:|$)/i);
  const evidenceMatch = summary.match(/evidencia minima\s*:\s*([\s\S]*)$/i);

  return {
    operation: (operationMatch?.[1] || summary).replace(/\s+/g, " ").trim(),
    evidence: (evidenceMatch?.[1] || `Produccion breve verificable alineada con ${fallbackTheme || "la clase"}.`)
      .replace(/\s+/g, " ")
      .trim(),
  };
}

function stripTechnicalLabel(value: string | null | undefined) {
  return (value || "").replace(/^(?:\[[^\]]+\]\s*)+/g, "").trim();
}

function isLikelyBibliographyEntry(name: string): boolean {
  const trimmed = name.trim();
  const commaCount = (trimmed.match(/,/g) || []).length;
  const hasAuthorPrefix = /^[A-ZÁÉÍÓÚÑ][^,]{1,90},/.test(trimmed);
  const hasYear = /\b(1[89]\d{2}|20\d{2})\b/.test(trimmed);
  const hasEditionFallback = /\bvarias\s+ediciones\b/i.test(trimmed);

  return hasAuthorPrefix && commaCount >= 2 && (hasYear || hasEditionFallback || commaCount >= 3);
}

function isBibliographyHeading(name: string): boolean {
  const normalized = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

  return (
    normalized.includes("bibliografia") ||
    normalized.includes("bibliografica") ||
    normalized.includes("fuentes bibliograficas")
  );
}

function extractProtocolBibliographyNodes(nodes: CurriculumNodeRow[]): CurriculumNodeRow[] {
  const childrenByParent = new Map<string, CurriculumNodeRow[]>();
  nodes.forEach((node) => {
    if (!node.parent_id) return;
    const current = childrenByParent.get(node.parent_id) || [];
    current.push(node);
    childrenByParent.set(node.parent_id, current);
  });

  const bibliographyRootIds = nodes.filter((node) => isBibliographyHeading(node.name)).map((node) => node.id);
  const bibliographyDescendantIds = new Set<string>();
  const queue = [...bibliographyRootIds];

  while (queue.length > 0) {
    const parentId = queue.shift()!;
    const children = childrenByParent.get(parentId) || [];
    children.forEach((child) => {
      bibliographyDescendantIds.add(child.id);
      queue.push(child.id);
    });
  }

  const protocolNodes = nodes.filter(
    (node) =>
      node.node_type === "CONTENIDO" &&
      ((bibliographyDescendantIds.has(node.id) && !isNoiseNode(node.name)) || isLikelyBibliographyEntry(node.name))
  );

  const unique = new Map<string, CurriculumNodeRow>();
  protocolNodes.forEach((node) => {
    const key = node.name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
    if (!unique.has(key)) unique.set(key, node);
  });

  return Array.from(unique.values()).sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
}

function isNoiseNode(name: string): boolean {
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
    normalized.includes("autoridades")
  );
}

export default function Lesson() {
  const { lessonId } = useParams<{ lessonId: string }>();
  const {
    entitlements,
    planType,
    loading: entitlementsLoading,
    error: entitlementsError,
    refetch: refetchEntitlements,
  } = useEntitlements();
  const [lesson, setLesson] = useState<LessonRow | null>(null);
  const [courseContext, setCourseContext] = useState<CourseContextRow | null>(null);
  const [planLesson, setPlanLesson] = useState<PlanLessonRow | null>(null);
  const [brief, setBrief] = useState<LessonBriefRow | null>(null);
  const [teachingMaterial, setTeachingMaterial] = useState<TeachingMaterialRow | null>(null);
  const [readingMaterial, setReadingMaterial] = useState<ReadingMaterialRow | null>(null);
  const [bibliographyNodes, setBibliographyNodes] = useState<CurriculumNodeRow[]>([]);
  const [authorizedSourceNodes, setAuthorizedSourceNodes] = useState<AuthorizedSourceRow[]>([]);
  const [mappedCurriculumNodes, setMappedCurriculumNodes] = useState<CurriculumNodeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [pdfBase64, setPdfBase64] = useState<string | null>(null);
  const [copilotOpen, setCopilotOpen] = useState(false);

  const fetchData = useCallback(async () => {
    if (!lessonId) return;

    const { data: lessonData } = await supabase
      .from("lessons")
      .select("*")
      .eq("id", lessonId)
      .single();

    if (!lessonData) {
      setLoading(false);
      return;
    }
    setLesson(lessonData as LessonRow);

    const [courseRes, planLessonRes, briefRes, teachingRes, readingRes] = await Promise.all([
      supabase
        .from("courses")
        .select("subject, year_level, academic_year, schools(official_name)")
        .eq("id", lessonData.course_id)
        .maybeSingle(),
      supabase.from("plan_lessons").select("*").eq("id", lessonData.plan_lesson_id).single(),
      supabase.from("lesson_briefs").select("*").eq("lesson_id", lessonId).maybeSingle(),
      supabase.from("teaching_materials").select("*").eq("lesson_id", lessonId).maybeSingle(),
      supabase.from("reading_materials").select("*").eq("lesson_id", lessonId).maybeSingle(),
    ]);

    setCourseContext((courseRes.data as CourseContextRow | null) ?? null);
    setPlanLesson(planLessonRes.data as PlanLessonRow | null);
    setBrief((briefRes.data as LessonBriefRow | null) ?? null);
    setTeachingMaterial(teachingRes.data as TeachingMaterialRow | null);
    setReadingMaterial(readingRes.data as ReadingMaterialRow | null);

    if (lessonData.plan_lesson_id) {
      const { data: lessonLinks } = await supabase
        .from("plan_lesson_content_links")
        .select("plan_content_mapping_id")
        .eq("plan_lesson_id", lessonData.plan_lesson_id);

      const mappingIds = (lessonLinks || []).map((link) => link.plan_content_mapping_id);
      if (mappingIds.length > 0) {
        const { data: mappings } = await supabase
          .from("plan_content_mappings")
          .select("curriculum_node_id")
          .in("id", mappingIds);

        const nodeIds = Array.from(new Set((mappings || []).map((mapping) => mapping.curriculum_node_id)));
        if (nodeIds.length > 0) {
          const { data: mappedNodes } = await supabase
            .from("curriculum_nodes")
            .select("id, name, node_type, parent_id, order_index")
            .in("id", nodeIds)
            .order("order_index");
          const visibleMappedNodes = ((mappedNodes || []) as CurriculumNodeRow[]).filter(
            (node) => !isNoiseNode(node.name)
          );
          const bibliographyNodeIds = new Set(
            extractProtocolBibliographyNodes(visibleMappedNodes).map((node) => node.id)
          );
          setMappedCurriculumNodes(
            visibleMappedNodes.filter((node) => !bibliographyNodeIds.has(node.id))
          );
        } else {
          setMappedCurriculumNodes([]);
        }
      } else {
        setMappedCurriculumNodes([]);
      }
    } else {
      setMappedCurriculumNodes([]);
    }

    if (briefRes.data?.bibliografia_confirmada?.length > 0) {
      const { data: courseCurriculum } = await supabase
        .from("courses")
        .select("curriculum_document_id")
        .eq("id", lessonData.course_id)
        .maybeSingle();

      if (courseCurriculum?.curriculum_document_id) {
        const { data: documentNodes } = await supabase
          .from("curriculum_nodes")
          .select("id, name, node_type, parent_id, order_index")
          .eq("curriculum_document_id", courseCurriculum.curriculum_document_id)
          .order("order_index");

        const protocolNodes = extractProtocolBibliographyNodes((documentNodes || []) as CurriculumNodeRow[]);
        setBibliographyNodes(
          protocolNodes.filter((node) => briefRes.data!.bibliografia_confirmada.includes(node.id))
        );
      } else {
        setBibliographyNodes([]);
      }
    } else {
      setBibliographyNodes([]);
    }

    const briefData = briefRes.data as LessonBriefRow | null;
    if (briefData?.authorized_source_ids?.length > 0) {
      const { data: sources } = await supabase
        .from(AUTHORIZED_SOURCES_TABLE)
        .select("id, title, media_type, origin_type, status")
        .in("id", briefData.authorized_source_ids)
        .order("created_at", { ascending: false });
      setAuthorizedSourceNodes((sources || []) as unknown as AuthorizedSourceRow[]);
    } else {
      setAuthorizedSourceNodes([]);
    }

    setLoading(false);
  }, [lessonId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleGenerate = async () => {
    // Optimistic: immediately show generating state
    setLesson((prev) => prev ? { ...prev, is_generating: true } : prev);
    try {
      const { data, error } = await supabase.functions.invoke("generate-materials", {
        body: { lesson_id: lessonId },
      });
      if (error) {
        toast({
          title: "Error al generar",
          description: await formatFunctionErrorMessage(error),
          variant: "destructive",
        });
        await fetchData();
        return;
      }
      const responseData = data as GenerateMaterialsResponse | null;
      if (responseData?.error) {
        toast({ title: "Error", description: responseData.error, variant: "destructive" });
        await fetchData();
        return;
      }
      if (responseData?.reading_pdf_base64) {
        setPdfBase64(responseData.reading_pdf_base64);
      }
      if (responseData?.reading_status === "INVALIDATED") {
        const details = (responseData.reading_validation_issues || []).join(" | ");
        toast({
          title: "Material didactico generado; lectura pendiente",
          description: details || "La lectura no paso validacion. Revisa y regenera lectura.",
          variant: "destructive",
        });
      } else {
        toast({ title: "Materiales generados correctamente" });
      }
      fetchData();
    } catch (err: unknown) {
      toast({ title: "Error", description: formatErrorMessage(err), variant: "destructive" });
      fetchData();
    }
  };

  const handleRegenerateTeaching = async () => {
    setLesson((prev) => prev ? { ...prev, is_generating: true } : prev);
    try {
      const { data, error } = await supabase.functions.invoke("generate-materials", {
        body: { lesson_id: lessonId, regenerate_only: "teaching" },
      });
      if (error) {
        toast({
          title: "Error al regenerar",
          description: await formatFunctionErrorMessage(error),
          variant: "destructive",
        });
        await fetchData();
        return;
      }
      const responseData = data as GenerateMaterialsResponse | null;
      if (responseData?.error) {
        toast({ title: "Error", description: responseData.error, variant: "destructive" });
        await fetchData();
        return;
      }
      toast({ title: "Material didáctico regenerado" });
      fetchData();
    } catch (err: unknown) {
      toast({ title: "Error", description: formatErrorMessage(err), variant: "destructive" });
      fetchData();
    }
  };

  const handleRegenerateReading = async () => {
    setLesson((prev) => prev ? { ...prev, is_generating: true } : prev);
    try {
      const { data, error } = await supabase.functions.invoke("generate-materials", {
        body: { lesson_id: lessonId, regenerate_only: "reading" },
      });
      if (error) {
        toast({
          title: "Error al regenerar",
          description: await formatFunctionErrorMessage(error),
          variant: "destructive",
        });
        await fetchData();
        return;
      }
      const responseData = data as GenerateMaterialsResponse | null;
      if (responseData?.error) {
        toast({ title: "Error", description: responseData.error, variant: "destructive" });
        await fetchData();
        return;
      }
      if (responseData?.reading_pdf_base64) {
        setPdfBase64(responseData.reading_pdf_base64);
      }
      if (responseData?.reading_status === "INVALIDATED") {
        const details = (responseData.reading_validation_issues || []).join(" | ");
        toast({
          title: "Lectura no validada",
          description: details || "La lectura no paso validacion en este intento.",
          variant: "destructive",
        });
      } else {
        toast({ title: "Material de lectura regenerado" });
      }
      fetchData();
    } catch (err: unknown) {
      toast({ title: "Error", description: formatErrorMessage(err), variant: "destructive" });
      fetchData();
    }
  };

  const handleDepthChange = async (level: "BAJO" | "MEDIO" | "ALTO") => {
    if (brief) {
      await supabase
        .from("lesson_briefs")
        .update({ nivel_profundidad: level, status: "READY_FOR_PRODUCTION" })
        .eq("id", brief.id);
      fetchData();
    }
  };

  const referencedNodeIds: string[] = [];
  if (readingMaterial?.content_html) {
    const regex = /data-ref="([^"]+)"/g;
    let match;
    while ((match = regex.exec(readingMaterial.content_html)) !== null) {
      if (!referencedNodeIds.includes(match[1])) {
        referencedNodeIds.push(match[1]);
      }
    }
  }

  const canGenerate = brief?.status === "READY_FOR_PRODUCTION" && !lesson?.is_generating;

  const scrollToBrief = () => {
    document.getElementById("brief-form")?.scrollIntoView({ behavior: "smooth" });
  };

  if ((!planType || !entitlements) && !entitlementsError) {
    return (
      <LoadingState
        variant="page"
        tips={[
          "Verificando tu plan...",
          "Cargando la leccion...",
          "Ya casi estamos...",
        ]}
      />
    );
  }

  if ((!planType || !entitlements) && entitlementsError) {
    return (
      <div className="min-h-screen bg-background">
        <main className="mx-auto flex min-h-screen max-w-4xl items-center justify-center px-4 py-8">
          <Card className="w-full max-w-xl">
            <CardContent className="flex flex-col items-center gap-5 py-14 text-center">
              <Sparkles className="h-10 w-10 text-muted-foreground" />
              <div className="space-y-2">
                <h2 className="text-2xl font-semibold text-foreground">No se pudo cargar tu plan</h2>
                <p className="text-sm text-muted-foreground">{entitlementsError}</p>
              </div>
              <Button size="lg" onClick={() => refetchEntitlements()}>
                Reintentar
              </Button>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  if (!planType || !entitlements) {
    return null;
  }

  if (loading || entitlementsLoading) {
    return (
      <div className="min-h-screen bg-background p-8">
        <SkeletonList count={4} />
      </div>
    );
  }

  if (!lesson) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <p className="text-muted-foreground">Lección no encontrada</p>
        <Button asChild>
          <Link to="/dashboard">Volver al dashboard</Link>
        </Button>
      </div>
    );
  }

  const hasMaterials = !!(teachingMaterial || readingMaterial);
  const briefIsDraft = !brief || brief.status === "IN_PROGRESS";
  const canonSummary = extractCanonSummary(planLesson?.activities_summary, planLesson?.theme);
  const referencedNodes = bibliographyNodes.filter((node) => referencedNodeIds.includes(node.id));
  const canExportValidatedPdf = planType === "BASICO" || planType === "PREMIUM";
  const lessonSlug = `leccion-${lesson.lesson_number}`;
  const documentMeta = [
    { label: "Institución", value: courseContext?.schools?.official_name || null },
    { label: "Materia", value: courseContext?.subject || null },
    { label: "Curso", value: courseContext?.year_level ? `${courseContext.year_level} año` : null },
    { label: "Clase", value: `Lección ${lesson.lesson_number}` },
    { label: "Tema", value: planLesson?.theme || null },
    { label: "Ciclo", value: courseContext?.academic_year || null },
  ];
  const normalizedTeachingMaterial = teachingMaterial
    ? {
        ...teachingMaterial,
        activities: Array.isArray(teachingMaterial.activities)
          ? (teachingMaterial.activities as unknown as TeachingActivity[])
          : [],
        differentiation: Array.isArray(teachingMaterial.differentiation)
          ? (teachingMaterial.differentiation as unknown as TeachingDifferentiation[])
          : [],
      }
    : null;

  return (
    <div className="h-screen flex flex-col bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-4">
          <Button variant="ghost" size="sm" asChild className="shrink-0">
            <Link to={`/course/${lesson.course_id}`}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Volver al curso
            </Link>
          </Button>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold text-foreground truncate">
                Lección {lesson.lesson_number}
              </h1>
              <StatusBadge tone={lessonStatusTone(lesson.status)} label={lessonStatusLabel(lesson.status)} />
              {lesson.is_generating && (
                <StatusBadge tone="warning" label="Generando..." />
              )}
              {planLesson?.theme ? (
                <span className="text-sm text-muted-foreground truncate">— {planLesson.theme}</span>
              ) : null}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Canonical CTA */}
            {briefIsDraft && (
              <Button onClick={scrollToBrief}>
                <ClipboardEdit className="h-4 w-4 mr-2" />
                Completar indicaciones
              </Button>
            )}

            {/* Copilot toggle button */}
            <Button
              variant={copilotOpen ? "default" : "outline"}
              size="sm"
              className="gap-2"
              onClick={() => setCopilotOpen((prev) => !prev)}
              data-tour="lesson-copilot"
            >
              <Bot className="h-4 w-4" />
              <span>Copiloto</span>
              {entitlements.copiloto_mode === "full" && (
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
                </span>
              )}
            </Button>
          </div>
        </div>
      </header>

      <ResizablePanelGroup direction="horizontal" className="flex-1 min-h-0">
        <ResizablePanel defaultSize={copilotOpen ? 65 : 100} minSize={40}>
          <ScrollArea className="h-full">
            <main className="mx-auto max-w-5xl px-4 py-8">
              <div className="space-y-8">
                {lesson.is_generating && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
                    <Card className="w-full max-w-md mx-4 shadow-2xl border-primary/20">
                      <CardContent className="flex flex-col items-center gap-5 py-10 text-center">
                        <ThinkingBook
                          title="Estamos elaborando el material de la clase"
                          detail="Este proceso puede tardar entre 30 segundos y 2 minutos. No cierres ni recargues la pagina."
                        />
                        <p className="text-xs text-muted-foreground animate-pulse">
                          Procesando con inteligencia artificial...
                        </p>
                      </CardContent>
                    </Card>
                  </div>
                )}

                {planLesson && (
                  <Card>
                    <CardHeader className="pb-3">
                      <div className="flex items-baseline gap-4">
                        <CardTitle className="text-base">Canon de esta clase</CardTitle>
                        <p className="text-sm text-muted-foreground">
                          <span className="text-xs font-medium uppercase tracking-wide">Tema: </span>
                          <span className="font-medium text-foreground">{planLesson.theme}</span>
                        </p>
                      </div>
                    </CardHeader>
                    <CardContent className="grid gap-6 md:grid-cols-[3fr_2fr]">
                      <div className="space-y-1">
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Operación</p>
                        <p className="text-sm">{canonSummary.operation}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Evidencia mínima</p>
                        <p className="text-sm">{canonSummary.evidence}</p>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {planLesson && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Vinculacion curricular</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Contenidos curriculares mapeados a esta clase
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {mappedCurriculumNodes.length > 0 ? (
                            mappedCurriculumNodes.map((node) => (
                              <Badge key={node.id} variant="outline">
                                {stripTechnicalLabel(node.name)}
                              </Badge>
                            ))
                          ) : (
                            <p className="text-sm text-muted-foreground">
                              Esta clase aun no muestra contenidos curriculares enlazados desde la anual.
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Bibliografia sugerida confirmada para generar
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {bibliographyNodes.length > 0 ? (
                            bibliographyNodes.map((node) => (
                              <Badge key={node.id} variant="secondary">
                                {stripTechnicalLabel(node.name)}
                              </Badge>
                            ))
                          ) : (
                            <p className="text-sm text-muted-foreground">
                              Las indicaciones todavia no tienen bibliografia confirmada.
                            </p>
                          )}
                        </div>
                      </div>

                      {(planType === "BASICO" || planType === "PREMIUM") && (
                        <div className="space-y-2">
                          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            Fuentes del docente confirmadas
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {authorizedSourceNodes.length > 0 ? (
                              authorizedSourceNodes.map((source) => (
                                <Badge key={source.id} variant="secondary">
                                  {stripTechnicalLabel(source.title)}
                                </Badge>
                              ))
                            ) : (
                              <p className="text-sm text-muted-foreground">
                                Esta clase todavia no tiene fuentes del docente seleccionadas.
                              </p>
                            )}
                          </div>
                        </div>
                      )}

                      {readingMaterial && (
                        <div className="space-y-2">
                          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            Referencias visibles en el material de lectura
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {referencedNodes.length}/{bibliographyNodes.length} fuentes confirmadas quedaron efectivamente marcadas en el texto generado.
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {referencedNodes.length > 0 ? (
                              referencedNodes.map((node) => (
                                <Badge key={node.id} variant="outline">
                                  {stripTechnicalLabel(node.name)}
                                </Badge>
                              ))
                            ) : (
                              <p className="text-sm text-muted-foreground">
                                Todavia no hay referencias detectadas en el material de lectura.
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                <section id="brief-form" data-tour="lesson-brief">
                  <StepHeader
                    stepNumber={1}
                    title="Indicaciones"
                    status={briefLabel(brief?.status)}
                    statusTone={briefTone(brief?.status)}
                  />
                  <BriefForm
                    lessonId={lessonId!}
                    courseId={lesson.course_id}
                    brief={brief}
                    onUpdate={fetchData}
                    planType={planType}
                    planTheme={planLesson?.theme}
                    learningOutcome={planLesson?.learning_outcome}
                    canonOperation={canonSummary.operation}
                    canonEvidence={canonSummary.evidence}
                    mappedCurriculumNodes={mappedCurriculumNodes}
                    bibliographyNodes={bibliographyNodes}
                    authorizedSourceNodes={authorizedSourceNodes}
                  />
                </section>

                <Separator />

                <section id="materials-section">
                  <StepHeader
                    stepNumber={2}
                    title="Generación"
                    status={materialLabel(hasMaterials ? (readingMaterial?.status || teachingMaterial?.status) : null)}
                    statusTone={materialTone(hasMaterials ? (readingMaterial?.status || teachingMaterial?.status) : null)}
                  />

                  <div data-tour="lesson-generate">
                    <GenerateButton
                      onClick={handleGenerate}
                      isGenerating={lesson.is_generating}
                      disabled={!canGenerate}
                    />
                  </div>

                  {normalizedTeachingMaterial && (
                    <div className="mt-6">
                      <TeachingMaterialView
                        material={normalizedTeachingMaterial}
                        canExportPdf={canExportValidatedPdf}
                        exportFileName={`${lessonSlug}-material-didactico.pdf`}
                        documentTitle={planLesson?.theme ? `Material didactico - ${planLesson.theme}` : "Material didactico"}
                        documentSummary="Documento de trabajo para aula con proposito, actividades, criterios y cierre listo para uso real."
                        documentMeta={documentMeta}
                        generatedAt={normalizedTeachingMaterial.created_at}
                      />
                    </div>
                  )}

                  {readingMaterial && (
                    <div className="mt-6">
                      <ReadingMaterialView
                        material={readingMaterial}
                        pdfBase64={pdfBase64}
                        canExportPdf={canExportValidatedPdf}
                        exportFileName={`${lessonSlug}-material-lectura.pdf`}
                        documentTitle={planLesson?.theme ? `Material de lectura - ${planLesson.theme}` : "Material de lectura"}
                        documentSummary="Lectura continua y trazable, preparada como pieza pedagogica presentable y lista para compartir."
                        documentMeta={documentMeta}
                        generatedAt={readingMaterial.created_at}
                      />
                    </div>
                  )}
                </section>
              </div>
            </main>
          </ScrollArea>
        </ResizablePanel>

        {copilotOpen && (
          <>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={35} minSize={25}>
              <div className="h-full flex flex-col border-l bg-card">
                {/* Copilot header */}
                <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    <span className="text-sm font-semibold">Copiloto</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={entitlements.copiloto_mode === "full" ? "default" : "outline"}>
                      {entitlements.copiloto_mode === "full" ? "Premium" : entitlements.copiloto_mode === "limited" ? "Básico" : "Bloqueado"}
                    </Badge>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCopilotOpen(false)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Copilot content */}
                <div className="flex-1 min-h-0 flex flex-col overflow-y-auto px-4 py-4">
                  {(brief?.status === "READY_FOR_PRODUCTION" || brief?.status === "PRODUCED") && (
                    <div className="mb-4">
                      <CopilotPanel
                        bibliographyNodes={bibliographyNodes}
                        referencedNodeIds={referencedNodeIds}
                        mappedCurriculumNodes={mappedCurriculumNodes}
                        authorizedSources={authorizedSourceNodes}
                        depthLevel={brief.nivel_profundidad}
                        planTheme={planLesson?.theme}
                        learningOutcome={planLesson?.learning_outcome}
                        canonOperation={canonSummary.operation}
                        canonEvidence={canonSummary.evidence}
                        briefFocus={brief?.enfoque_deseado}
                        briefDynamic={brief?.tipo_dinamica_sugerida}
                        briefObservations={brief?.observaciones_docente}
                        briefStatus={brief?.status}
                        teachingStatus={teachingMaterial?.status}
                        readingStatus={readingMaterial?.status}
                        onDepthChange={handleDepthChange}
                        onRegenerateTeaching={handleRegenerateTeaching}
                        onRegenerateReading={handleRegenerateReading}
                        onFocusBrief={scrollToBrief}
                        isGenerating={lesson.is_generating}
                        isLocked={lesson.status === "LOCKED"}
                        copilotoMode={entitlements.copiloto_mode}
                        subject={courseContext?.subject}
                        yearLevel={courseContext?.year_level}
                      />
                    </div>
                  )}

                  {entitlements.copiloto_mode === "full" && (
                    <CopilotChat
                      copilotoMode={entitlements.copiloto_mode}
                      lessonContext={{
                        theme: planLesson?.theme,
                        learningOutcome: planLesson?.learning_outcome,
                        canonOperation: canonSummary.operation,
                        canonEvidence: canonSummary.evidence,
                        briefFocus: brief?.enfoque_deseado,
                        briefDynamic: brief?.tipo_dinamica_sugerida,
                        depthLevel: brief?.nivel_profundidad,
                        teachingStatus: teachingMaterial?.status,
                        readingStatus: readingMaterial?.status,
                        subject: courseContext?.subject,
                        yearLevel: courseContext?.year_level,
                        curriculumNodeNames: mappedCurriculumNodes.map((n) => n.name),
                        bibliographyNames: bibliographyNodes.map((n) => n.name),
                        authorizedSourceTitles: authorizedSourceNodes.map((s) => s.title),
                      }}
                      placeholder="¿Cómo mejorar las indicaciones o los materiales de esta clase?"
                    />
                  )}

                  {entitlements.copiloto_mode === "limited" && !(brief?.status === "READY_FOR_PRODUCTION" || brief?.status === "PRODUCED") && (
                    <p className="text-xs text-muted-foreground text-center py-4">
                      El chat del copiloto está disponible en el plan Premium. Desde una lección con indicaciones listas, podés usar los controles de profundidad y regeneración.
                    </p>
                  )}

                  {entitlements.copiloto_mode === "none" && (
                    <p className="text-xs text-muted-foreground text-center py-4">
                      Actualizá tu plan para usar el Copiloto.
                    </p>
                  )}
                </div>
              </div>
            </ResizablePanel>
          </>
        )}
      </ResizablePanelGroup>
      <GuidedTour steps={LESSON_TOUR_STEPS} />
    </div>
  );
}

