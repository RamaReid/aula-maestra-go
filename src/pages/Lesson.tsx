import { useEffect, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, ClipboardEdit } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import BriefForm from "@/components/lesson/BriefForm";
import TeachingMaterialView from "@/components/lesson/TeachingMaterialView";
import ReadingMaterialView from "@/components/lesson/ReadingMaterialView";
import CopilotPanel from "@/components/lesson/CopilotPanel";
import GenerateButton from "@/components/lesson/GenerateButton";
import { useEntitlements } from "@/hooks/useEntitlements";
import { StatusBadge, briefLabel, briefTone, materialLabel, materialTone, lessonStatusLabel, lessonStatusTone } from "@/components/ui/StatusBadge";
import { StepHeader } from "@/components/ui/StepHeader";
import { SkeletonList } from "@/components/ui/SkeletonList";
import { ThinkingBook } from "@/components/ui/ThinkingBook";
import type { Tables } from "@/integrations/supabase/types";
import { formatErrorMessage, formatFunctionErrorMessage } from "@/lib/errors";

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

const AUTHORIZED_SOURCES_TABLE = "authorized_sources" as any;

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
  const { entitlements, planType } = useEntitlements();
  const [lesson, setLesson] = useState<LessonRow | null>(null);
  const [planLesson, setPlanLesson] = useState<PlanLessonRow | null>(null);
  const [brief, setBrief] = useState<LessonBriefRow | null>(null);
  const [teachingMaterial, setTeachingMaterial] = useState<TeachingMaterialRow | null>(null);
  const [readingMaterial, setReadingMaterial] = useState<ReadingMaterialRow | null>(null);
  const [bibliographyNodes, setBibliographyNodes] = useState<CurriculumNodeRow[]>([]);
  const [authorizedSourceNodes, setAuthorizedSourceNodes] = useState<AuthorizedSourceRow[]>([]);
  const [mappedCurriculumNodes, setMappedCurriculumNodes] = useState<CurriculumNodeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [pdfBase64, setPdfBase64] = useState<string | null>(null);

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

    const [planLessonRes, briefRes, teachingRes, readingRes] = await Promise.all([
      supabase.from("plan_lessons").select("*").eq("id", lessonData.plan_lesson_id).single(),
      supabase.from("lesson_briefs").select("*").eq("lesson_id", lessonId).maybeSingle(),
      supabase.from("teaching_materials").select("*").eq("lesson_id", lessonId).maybeSingle(),
      supabase.from("reading_materials").select("*").eq("lesson_id", lessonId).maybeSingle(),
    ]);

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
        return;
      }
      const responseData = data as GenerateMaterialsResponse | null;
      if (responseData?.error) {
        toast({ title: "Error", description: responseData.error, variant: "destructive" });
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
        return;
      }
      const responseData = data as GenerateMaterialsResponse | null;
      if (responseData?.error) {
        toast({ title: "Error", description: responseData.error, variant: "destructive" });
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
        return;
      }
      const responseData = data as GenerateMaterialsResponse | null;
      if (responseData?.error) {
        toast({ title: "Error", description: responseData.error, variant: "destructive" });
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

  if (loading) {
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

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-4">
          <Button variant="ghost" size="sm" asChild>
            <Link to={`/course/${lesson.course_id}`}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Volver al curso
            </Link>
          </Button>
          <div className="flex-1">
            <h1 className="text-lg font-semibold text-foreground">
              Lección {lesson.lesson_number}
              {planLesson?.theme ? ` — ${planLesson.theme}` : ""}
            </h1>
            <div className="flex gap-2 mt-1">
              <StatusBadge tone={lessonStatusTone(lesson.status)} label={lessonStatusLabel(lesson.status)} />
              {lesson.is_generating && (
                <StatusBadge tone="warning" label="Generando..." />
              )}
            </div>
          </div>

          {/* Canonical CTA */}
          {briefIsDraft && (
            <Button onClick={scrollToBrief}>
              <ClipboardEdit className="h-4 w-4 mr-2" />
              Completar brief
            </Button>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-8">
          <div className="space-y-8">
            {lesson.is_generating && (
              <Card>
                <CardContent className="pt-6">
                  <ThinkingBook
                    title="Estamos elaborando el material de la clase"
                    detail="Cuando termine, la seccion de materiales se actualiza automaticamente."
                  />
                </CardContent>
              </Card>
            )}

            {planLesson && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Canon de esta clase</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-1">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Foco</p>
                    <p className="text-sm">{planLesson.theme}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Operacion</p>
                    <p className="text-sm">{canonSummary.operation}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Evidencia minima</p>
                    <p className="text-sm">{canonSummary.evidence}</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {planLesson && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Trazabilidad curricular</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Nodos curriculares mapeados a esta clase
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {mappedCurriculumNodes.length > 0 ? (
                        mappedCurriculumNodes.map((node) => (
                          <Badge key={node.id} variant="outline">
                            [{node.node_type}] {node.name}
                          </Badge>
                        ))
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          Esta clase aun no muestra nodos curriculares enlazados desde la anual.
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Fuentes curriculares confirmadas para generar
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {bibliographyNodes.length > 0 ? (
                        bibliographyNodes.map((node) => (
                          <Badge key={node.id} variant="secondary">
                            [FUENTE CURRICULAR] {node.name}
                          </Badge>
                        ))
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          El brief todavia no tiene bibliografia confirmada.
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
                              [DOCENTE/{source.media_type}] {source.title}
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
                              [FUENTE] {node.name}
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

            <section id="brief-form">
              <StepHeader
                stepNumber={1}
                title="Relevamiento"
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

              <GenerateButton
                onClick={handleGenerate}
                isGenerating={lesson.is_generating}
                disabled={!canGenerate}
              />

              {teachingMaterial && (
                <div className="mt-6">
                  <TeachingMaterialView
                    material={{
                      ...teachingMaterial,
                      activities: Array.isArray(teachingMaterial.activities) ? teachingMaterial.activities as any : [],
                      differentiation: Array.isArray(teachingMaterial.differentiation) ? teachingMaterial.differentiation as any : [],
                    }}
                    canExportPdf={canExportValidatedPdf}
                    exportFileName={`${lessonSlug}-material-didactico.pdf`}
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
                  />
                </div>
              )}
            </section>
          </div>

          {(brief?.status === "READY_FOR_PRODUCTION" || brief?.status === "PRODUCED") && (
            <aside className="border rounded-lg p-4 h-fit sticky top-4">
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
              />
            </aside>
          )}
        </div>
      </main>
    </div>
  );
}
