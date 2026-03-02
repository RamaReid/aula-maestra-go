import { useEffect, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, BookOpen, Archive } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import PlanEditor from "@/components/plan/PlanEditor";
import AgendaView from "@/components/plan/AgendaView";
import { StatusBadge, briefLabel, briefTone, lessonStatusLabel, lessonStatusTone } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonList } from "@/components/ui/SkeletonList";
import { Badge } from "@/components/ui/badge";

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
}

interface PlanInfo {
  id: string;
  status: string;
}

export default function Course() {
  const { courseId } = useParams<{ courseId: string }>();
  const [course, setCourse] = useState<CourseInfo | null>(null);
  const [plan, setPlan] = useState<PlanInfo | null>(null);
  const [lessons, setLessons] = useState<LessonWithPlanLesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [archiving, setArchiving] = useState(false);

  const fetchData = useCallback(async () => {
    if (!courseId) return;

    const { data: courseData } = await supabase
      .from("courses")
      .select("id, subject, year_level, academic_year, status, schools(official_name)")
      .eq("id", courseId)
      .single();

    if (courseData) {
      setCourse({
        id: courseData.id,
        subject: courseData.subject,
        year_level: courseData.year_level,
        academic_year: courseData.academic_year,
        school_name: (courseData as any).schools?.official_name ?? "Sin escuela",
        status: courseData.status,
      });
    }

    const { data: planData } = await supabase
      .from("plans")
      .select("id, status")
      .eq("course_id", courseId)
      .single();

    if (planData) {
      setPlan({ id: planData.id, status: planData.status });
    }

    if (planData?.status === "VALIDATED") {
      const { data: lessonsData } = await supabase
        .from("lessons")
        .select("id, lesson_number, status, scheduled_date, is_generating, plan_lesson_id")
        .eq("course_id", courseId)
        .order("lesson_number");

      if (lessonsData && lessonsData.length > 0) {
        const planLessonIds = lessonsData.map((l) => l.plan_lesson_id);
        const { data: planLessons } = await supabase
          .from("plan_lessons")
          .select("id, theme, learning_outcome")
          .in("id", planLessonIds);

        const lessonIds = lessonsData.map((l) => l.id);
        const { data: briefs } = await supabase
          .from("lesson_briefs")
          .select("lesson_id, status")
          .in("lesson_id", lessonIds);

        const planLessonMap = new Map((planLessons || []).map((pl) => [pl.id, pl]));
        const briefMap = new Map((briefs || []).map((b: any) => [b.lesson_id, b.status]));

        setLessons(
          lessonsData.map((l) => ({
            id: l.id,
            lesson_number: l.lesson_number,
            status: l.status,
            scheduled_date: l.scheduled_date,
            is_generating: l.is_generating,
            plan_lesson: planLessonMap.get(l.plan_lesson_id) || null,
            brief_status: briefMap.get(l.id) || null,
          }))
        );
      }
    }

    setLoading(false);
  }, [courseId]);

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
  const planValidated = plan?.status === "VALIDATED";

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
              <h1 className="text-lg font-semibold text-foreground">
                {course?.subject ?? "Cargando..."}
              </h1>
              {isArchived && <StatusBadge tone="archived" label="Archivado" />}
            </div>
            {course && (
              <p className="text-sm text-muted-foreground">
                {course.school_name} · {course.year_level}° año · {course.academic_year}
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
                  <AlertDialogTitle>¿Archivar este curso?</AlertDialogTitle>
                  <AlertDialogDescription>
                    No podrás editar el plan, las lecciones ni la agenda una vez archivado.
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
                  <EmptyState
                    icon={BookOpen}
                    title="No hay lecciones creadas para este curso"
                  />
                ) : (
                  <div className="space-y-3">
                    {lessons.map((lesson) => (
                      <Link key={lesson.id} to={`/lesson/${lesson.id}`}>
                        <Card className="hover:border-primary/50 transition-colors cursor-pointer">
                          <CardHeader className="pb-2">
                            <div className="flex items-center justify-between">
                              <CardTitle className="text-base">
                                Lección {lesson.lesson_number}
                                {lesson.plan_lesson?.theme ? ` — ${lesson.plan_lesson.theme}` : ""}
                              </CardTitle>
                              <div className="flex gap-2">
                                <StatusBadge tone={lessonStatusTone(lesson.status)} label={lessonStatusLabel(lesson.status)} />
                                {lesson.is_generating && (
                                  <Badge variant="outline" className="animate-pulse">Generando...</Badge>
                                )}
                                <StatusBadge tone={briefTone(lesson.brief_status)} label={briefLabel(lesson.brief_status)} />
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
        ) : null}
      </main>
    </div>
  );
}
