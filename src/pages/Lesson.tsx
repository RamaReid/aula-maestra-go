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

export default function Lesson() {
  const { lessonId } = useParams<{ lessonId: string }>();
  const { entitlements } = useEntitlements();
  const [lesson, setLesson] = useState<any>(null);
  const [planLesson, setPlanLesson] = useState<any>(null);
  const [brief, setBrief] = useState<any>(null);
  const [teachingMaterial, setTeachingMaterial] = useState<any>(null);
  const [readingMaterial, setReadingMaterial] = useState<any>(null);
  const [bibliographyNodes, setBibliographyNodes] = useState<any[]>([]);
  const [mappedCurriculumNodes, setMappedCurriculumNodes] = useState<any[]>([]);
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
    setLesson(lessonData);

    const [planLessonRes, briefRes, teachingRes, readingRes] = await Promise.all([
      supabase.from("plan_lessons").select("*").eq("id", lessonData.plan_lesson_id).single(),
      supabase.from("lesson_briefs").select("*").eq("lesson_id", lessonId).maybeSingle(),
      supabase.from("teaching_materials").select("*").eq("lesson_id", lessonId).maybeSingle(),
      supabase.from("reading_materials").select("*").eq("lesson_id", lessonId).maybeSingle(),
    ]);

    setPlanLesson(planLessonRes.data);
    setBrief(briefRes.data);
    setTeachingMaterial(teachingRes.data);
    setReadingMaterial(readingRes.data);

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
            .select("id, name, node_type")
            .in("id", nodeIds)
            .order("order_index");
          setMappedCurriculumNodes(mappedNodes || []);
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
      const { data: nodes } = await supabase
        .from("curriculum_nodes")
        .select("id, name, node_type")
        .in("id", briefRes.data.bibliografia_confirmada);
      setBibliographyNodes(nodes || []);
    } else {
      setBibliographyNodes([]);
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
        toast({ title: "Error al generar", description: error.message, variant: "destructive" });
        return;
      }
      if (data?.error) {
        toast({ title: "Error", description: data.error, variant: "destructive" });
        return;
      }
      if (data?.reading_pdf_base64) {
        setPdfBase64(data.reading_pdf_base64);
      }
      toast({ title: "Materiales generados correctamente" });
      fetchData();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
      fetchData();
    }
  };

  const handleRegenerateTeaching = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("generate-materials", {
        body: { lesson_id: lessonId, regenerate_only: "teaching" },
      });
      if (error) {
        toast({ title: "Error al regenerar", description: error.message, variant: "destructive" });
        return;
      }
      if (data?.error) {
        toast({ title: "Error", description: data.error, variant: "destructive" });
        return;
      }
      toast({ title: "Material didáctico regenerado" });
      fetchData();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
      fetchData();
    }
  };

  const handleRegenerateReading = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("generate-materials", {
        body: { lesson_id: lessonId, regenerate_only: "reading" },
      });
      if (error) {
        toast({ title: "Error al regenerar", description: error.message, variant: "destructive" });
        return;
      }
      if (data?.error) {
        toast({ title: "Error", description: data.error, variant: "destructive" });
        return;
      }
      if (data?.reading_pdf_base64) {
        setPdfBase64(data.reading_pdf_base64);
      }
      toast({ title: "Material de lectura regenerado" });
      fetchData();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
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
                      Bibliografia confirmada para generar
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {bibliographyNodes.length > 0 ? (
                        bibliographyNodes.map((node) => (
                          <Badge key={node.id} variant="secondary">
                            [{node.node_type}] {node.name}
                          </Badge>
                        ))
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          El brief todavia no tiene bibliografia confirmada.
                        </p>
                      )}
                    </div>
                  </div>

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
                              [{node.node_type}] {node.name}
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
                  <TeachingMaterialView material={teachingMaterial} />
                </div>
              )}

              {readingMaterial && (
                <div className="mt-6">
                  <ReadingMaterialView material={readingMaterial} pdfBase64={pdfBase64} />
                </div>
              )}
            </section>
          </div>

          {(brief?.status === "READY_FOR_PRODUCTION" || brief?.status === "PRODUCED") && (
            <aside className="border rounded-lg p-4 h-fit sticky top-4">
              <CopilotPanel
                bibliographyNodes={bibliographyNodes}
                referencedNodeIds={referencedNodeIds}
                depthLevel={brief.nivel_profundidad}
                onDepthChange={handleDepthChange}
                onRegenerateTeaching={handleRegenerateTeaching}
                onRegenerateReading={handleRegenerateReading}
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
