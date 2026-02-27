import { useEffect, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import BriefForm from "@/components/lesson/BriefForm";
import TeachingMaterialView from "@/components/lesson/TeachingMaterialView";
import ReadingMaterialView from "@/components/lesson/ReadingMaterialView";
import CopilotPanel from "@/components/lesson/CopilotPanel";
import GenerateButton from "@/components/lesson/GenerateButton";
import { useEntitlements } from "@/hooks/useEntitlements";

export default function Lesson() {
  const { lessonId } = useParams<{ lessonId: string }>();
  const { entitlements } = useEntitlements();
  const [lesson, setLesson] = useState<any>(null);
  const [planLesson, setPlanLesson] = useState<any>(null);
  const [brief, setBrief] = useState<any>(null);
  const [teachingMaterial, setTeachingMaterial] = useState<any>(null);
  const [readingMaterial, setReadingMaterial] = useState<any>(null);
  const [bibliographyNodes, setBibliographyNodes] = useState<any[]>([]);
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

    if (briefRes.data?.bibliografia_confirmada?.length > 0) {
      const { data: nodes } = await supabase
        .from("curriculum_nodes")
        .select("id, name, node_type")
        .in("id", briefRes.data.bibliografia_confirmada);
      setBibliographyNodes(nodes || []);
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

      // Store pdf_base64 for FREE users
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

  const canGenerate =
    brief?.status === "READY_FOR_PRODUCTION" && !lesson?.is_generating;

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
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

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to={`/course/${lesson.course_id}`}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="flex-1">
            <h1 className="text-lg font-semibold text-foreground">
              Lección {lesson.lesson_number}
              {planLesson?.theme ? ` — ${planLesson.theme}` : ""}
            </h1>
            <div className="flex gap-2 mt-1">
              <Badge variant="secondary">{lesson.status}</Badge>
              {lesson.is_generating && (
                <Badge variant="outline" className="animate-pulse">Generando...</Badge>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-8">
          <div className="space-y-8">
            <section>
              <h2 className="text-lg font-semibold mb-4">Paso 1 — Relevamiento</h2>
              <BriefForm
                lessonId={lessonId!}
                courseId={lesson.course_id}
                brief={brief}
                onUpdate={fetchData}
              />
            </section>

            <Separator />

            <section>
              <h2 className="text-lg font-semibold mb-4">Paso 2 — Generación</h2>

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
