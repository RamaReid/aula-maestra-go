import { useCallback, useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { Archive, ArrowLeft, BookOpen } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import PlanEditor from "@/components/plan/PlanEditor";
import AgendaView from "@/components/plan/AgendaView";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonList } from "@/components/ui/SkeletonList";
import { StatusBadge, briefLabel, briefTone, lessonStatusLabel, lessonStatusTone } from "@/components/ui/StatusBadge";

interface LessonWithPlanLesson {
  id: string;
  lesson_number: number;
  status: string;
  scheduled_date: string | null;
  is_generating: boolean;
  plan_lesson: { theme: string; learning_outcome: string } | null;
  brief_status: string | null;
}

interface CourseInfo {
  id: string;
  subject: string;
  year_level: number;
  academic_year: number;
  school_name: string;
  status: string;
  curriculum_document_id: string | null;
  curriculum_link_mode: "persisted" | "session_fallback" | "missing";
}

interface CurriculumInfo {
  id: string;
  official_title: string | null;
  official_url: string | null;
  source_provider: string;
  node_count?: number;
}

interface PlanInfo {
  id: string;
  status: string;
}

export default function Course() {
  const { courseId } = useParams<{ courseId: string }>();
  const [searchParams] = useSearchParams();
  const [course, setCourse] = useState<CourseInfo | null>(null);
  const [curriculum, setCurriculum] = useState<CurriculumInfo | null>(null);
  const [plan, setPlan] = useState<PlanInfo | null>(null);
  const [lessons, setLessons] = useState<LessonWithPlanLesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [archiving, setArchiving] = useState(false);
  const fallbackCurriculumId = searchParams.get("curriculum_document_id");

  const fetchData = useCallback(async () => {
    if (!courseId) return;

    setLoading(true);

    let courseData: any = null;
    const { data: courseWithCurriculum, error: courseWithCurriculumError } = await supabase
      .from("courses")
      .select("id, subject, year_level, academic_year, status, curriculum_document_id, schools(official_name)")
      .eq("id", courseId)
      .single();

    if (!courseWithCurriculumError && courseWithCurriculum) {
      courseData = courseWithCurriculum;
    } else if (
      courseWithCurriculumError &&
      courseWithCurriculumError.message.includes("curriculum_document_id")
    ) {
      const { data: courseWithoutCurriculum } = await supabase
        .from("courses")
        .select("id, subject, year_level, academic_year, status, schools(official_name)")
        .eq("id", courseId)
        .single();
      courseData = courseWithoutCurriculum;
    }

    if (courseData) {
      const resolvedCurriculumId = courseData.curriculum_document_id ?? fallbackCurriculumId;

      setCourse({
        id: courseData.id,
        subject: courseData.subject,
        year_level: courseData.year_level,
        academic_year: courseData.academic_year,
        school_name: (courseData as any).schools?.official_name ?? "Sin escuela",
        status: courseData.status,
        curriculum_document_id: resolvedCurriculumId,
        curriculum_link_mode: resolvedCurriculumId
          ? courseData.curriculum_document_id
            ? "persisted"
            : "session_fallback"
          : "missing",
      });

      if (resolvedCurriculumId) {
        const [{ data: curriculumData }, { count: nodeCount }] = await Promise.all([
          supabase
          .from("curriculum_documents")
          .select("id, official_title, official_url, source_provider")
          .eq("id", resolvedCurriculumId)
          .single(),
          supabase
            .from("curriculum_nodes")
            .select("id", { count: "exact", head: true })
            .eq("curriculum_document_id", resolvedCurriculumId),
        ]);

        setCurriculum(curriculumData ? { ...curriculumData, node_count: nodeCount || 0 } : null);
      } else {
        setCurriculum(null);
      }
    }

    const { data: planData } = await supabase
      .from("plans")
      .select("id, status")
      .eq("course_id", courseId)
      .single();

    if (planData) {
      setPlan({ id: planData.id, status: planData.status });
    }

    if (planData?.status === "VALIDATED" || planData?.status === "EDITED") {
      const { data: lessonsData } = await supabase
        .from("lessons")
        .select("id, lesson_number, status, scheduled_date, is_generating, plan_lesson_id")
        .eq("course_id", courseId)
        .order("lesson_number");

      if (lessonsData && lessonsData.length > 0) {
        const planLessonIds = lessonsData.map((lesson) => lesson.plan_lesson_id);
        const { data: planLessons } = await supabase
          .from("plan_lessons")
          .select("id, theme, learning_outcome")
          .in("id", planLessonIds);

        const lessonIds = lessonsData.map((lesson) => lesson.id);
        const { data: briefs } = await supabase
          .from("lesson_briefs")
          .select("lesson_id, status")
          .in("lesson_id", lessonIds);

        const planLessonMap = new Map((planLessons || []).map((planLesson) => [planLesson.id, planLesson]));
        const briefMap = new Map((briefs || []).map((brief: any) => [brief.lesson_id, brief.status]));

        setLessons(
          lessonsData.map((lesson) => ({
            id: lesson.id,
            lesson_number: lesson.lesson_number,
            status: lesson.status,
            scheduled_date: lesson.scheduled_date,
            is_generating: lesson.is_generating,
            plan_lesson: planLessonMap.get(lesson.plan_lesson_id) || null,
            brief_status: briefMap.get(lesson.id) || null,
          }))
        );
      } else {
        setLessons([]);
      }
    } else {
      setLessons([]);
    }

    setLoading(false);
  }, [courseId, fallbackCurriculumId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handlePlanValidated = () => fetchData();

  const handleArchive = async () => {
    if (!courseId) return;

    setArchiving(true);
    const { error } = await supabase.from("courses").update({ status: "ARCHIVED" }).eq("id", courseId);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Curso archivado" });
      fetchData();
    }
    setArchiving(false);
  };

  const isArchived = course?.status === "ARCHIVED";
  const planValidated = plan?.status === "VALIDATED" || plan?.status === "EDITED";

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-4xl items-center gap-4 px-4 py-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/dashboard">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold text-foreground">{course?.subject ?? "Cargando..."}</h1>
              {isArchived && <StatusBadge tone="archived" label="Archivado" />}
            </div>
            {course && (
              <p className="text-sm text-muted-foreground">
                {course.school_name} · {course.year_level}° ano · {course.academic_year}
              </p>
            )}
          </div>
          {course && !isArchived && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Archive className="h-4 w-4 mr-2" />
                  Archivar
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Archivar este curso</AlertDialogTitle>
                  <AlertDialogDescription>
                    No podras editar el plan, las lecciones ni la agenda una vez archivado.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={handleArchive} disabled={archiving}>
                    {archiving ? "Archivando..." : "Archivar"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8">
        {loading ? (
          <SkeletonList count={6} />
        ) : plan ? (
          <div className="space-y-4">
            <Card>
              <CardContent className="pt-6 space-y-2">
                <p className="text-sm font-medium text-foreground">Base curricular del curso</p>
                {curriculum ? (
                  <>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm">{curriculum.official_title || "Documento curricular asociado"}</p>
                      {course?.curriculum_link_mode === "persisted" && <Badge variant="default">Vinculo persistido</Badge>}
                      {course?.curriculum_link_mode === "session_fallback" && (
                        <Badge variant="secondary">Modo compatibilidad</Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                      <span>Fuente: {curriculum.source_provider}</span>
                      <span>Nodos curriculares: {curriculum.node_count ?? 0}</span>
                      <span>Curso: {course?.subject} {course?.year_level} ano</span>
                    </div>
                    {curriculum.source_provider === "ABC_PBA_WEB" && (
                      <p className="text-xs text-muted-foreground">
                        Documento resuelto desde ABC. La trazabilidad ya esta fijada, pero la extraccion profunda del contenido curricular sigue en construccion.
                      </p>
                    )}
                    {course?.curriculum_link_mode === "session_fallback" && (
                      <p className="text-xs text-muted-foreground">
                        El programa esta siendo reutilizado en esta sesion aunque la columna persistida del curso todavia no exista en el backend conectado.
                      </p>
                    )}
                    {curriculum.official_url && (
                      <a
                        href={curriculum.official_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm underline underline-offset-4"
                      >
                        Ver documento oficial
                      </a>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Este curso no tiene un diseno curricular oficial asociado todavia.
                  </p>
                )}
              </CardContent>
            </Card>

            <Tabs defaultValue="planificacion">
              <TabsList className={`grid w-full ${planValidated ? "grid-cols-3" : "grid-cols-1"}`}>
                <TabsTrigger value="planificacion">Planificacion</TabsTrigger>
                {planValidated && <TabsTrigger value="agenda">Agenda</TabsTrigger>}
                {planValidated && <TabsTrigger value="lecciones">Lecciones</TabsTrigger>}
              </TabsList>

              <TabsContent value="planificacion" className="pt-4">
                <PlanEditor
                  planId={plan.id}
                  courseId={courseId!}
                  curriculumDocumentId={course?.curriculum_document_id}
                  planStatus={plan.status}
                  onValidated={handlePlanValidated}
                  courseArchived={isArchived}
                />
              </TabsContent>

              {planValidated && (
                <TabsContent value="agenda" className="pt-4">
                  <AgendaView courseId={courseId!} readOnly={isArchived} />
                </TabsContent>
              )}

              {planValidated && (
                <TabsContent value="lecciones" className="pt-4">
                  {lessons.length === 0 ? (
                    <EmptyState icon={BookOpen} title="No hay lecciones creadas para este curso" />
                  ) : (
                    <div className="space-y-3">
                      {lessons.map((lesson) => (
                        <Link key={lesson.id} to={`/lesson/${lesson.id}`}>
                          <Card className="hover:border-primary/50 transition-colors cursor-pointer">
                            <CardHeader className="pb-2">
                              <div className="flex items-center justify-between">
                                <CardTitle className="text-base">
                                  Leccion {lesson.lesson_number}
                                  {lesson.plan_lesson?.theme ? ` - ${lesson.plan_lesson.theme}` : ""}
                                </CardTitle>
                                <div className="flex gap-2">
                                  <StatusBadge
                                    tone={lessonStatusTone(lesson.status)}
                                    label={lessonStatusLabel(lesson.status)}
                                  />
                                  {lesson.is_generating && (
                                    <Badge variant="outline" className="animate-pulse">
                                      Generando...
                                    </Badge>
                                  )}
                                  <StatusBadge
                                    tone={briefTone(lesson.brief_status)}
                                    label={briefLabel(lesson.brief_status)}
                                  />
                                </div>
                              </div>
                            </CardHeader>
                            {lesson.plan_lesson?.learning_outcome && (
                              <CardContent>
                                <p className="text-sm text-muted-foreground line-clamp-2">
                                  {lesson.plan_lesson.learning_outcome}
                                </p>
                              </CardContent>
                            )}
                          </Card>
                        </Link>
                      ))}
                    </div>
                  )}
                </TabsContent>
              )}
            </Tabs>
          </div>
        ) : null}
      </main>
    </div>
  );
}
