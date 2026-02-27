import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, BookOpen } from "lucide-react";

interface LessonWithPlanLesson {
  id: string;
  lesson_number: number;
  status: string;
  scheduled_date: string | null;
  is_generating: boolean;
  plan_lesson: {
    theme: string;
    learning_outcome: string;
  } | null;
  brief_status: string | null;
}

interface CourseInfo {
  id: string;
  subject: string;
  year_level: number;
  academic_year: number;
  school_name: string;
}

export default function Course() {
  const { courseId } = useParams<{ courseId: string }>();
  const [course, setCourse] = useState<CourseInfo | null>(null);
  const [lessons, setLessons] = useState<LessonWithPlanLesson[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!courseId) return;

    const fetchData = async () => {
      // Fetch course info
      const { data: courseData } = await supabase
        .from("courses")
        .select("id, subject, year_level, academic_year, schools(official_name)")
        .eq("id", courseId)
        .single();

      if (courseData) {
        setCourse({
          id: courseData.id,
          subject: courseData.subject,
          year_level: courseData.year_level,
          academic_year: courseData.academic_year,
          school_name: (courseData as any).schools?.official_name ?? "Sin escuela",
        });
      }

      // Fetch lessons with plan_lesson data
      const { data: lessonsData } = await supabase
        .from("lessons")
        .select("id, lesson_number, status, scheduled_date, is_generating, plan_lesson_id")
        .eq("course_id", courseId)
        .order("lesson_number");

      if (lessonsData && lessonsData.length > 0) {
        // Fetch plan_lessons for each lesson
        const planLessonIds = lessonsData.map((l) => l.plan_lesson_id);
        const { data: planLessons } = await supabase
          .from("plan_lessons")
          .select("id, theme, learning_outcome")
          .in("id", planLessonIds);

        // Fetch briefs
        const lessonIds = lessonsData.map((l) => l.id);
        const { data: briefs } = await supabase
          .from("lesson_briefs")
          .select("lesson_id, status")
          .in("lesson_id", lessonIds);

        const planLessonMap = new Map(
          (planLessons || []).map((pl) => [pl.id, pl])
        );
        const briefMap = new Map(
          (briefs || []).map((b: any) => [b.lesson_id, b.status])
        );

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

      setLoading(false);
    };

    fetchData();
  }, [courseId]);

  const statusLabel = (status: string) => {
    const map: Record<string, string> = {
      PLANNED: "Planificada",
      TAUGHT: "Dictada",
      RESCHEDULED: "Reprogramada",
      LOCKED: "Bloqueada",
    };
    return map[status] || status;
  };

  const statusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
    if (status === "TAUGHT") return "default";
    if (status === "LOCKED") return "destructive";
    return "secondary";
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-4xl items-center gap-4 px-4 py-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/dashboard">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-lg font-semibold text-foreground">
              {course?.subject ?? "Cargando..."}
            </h1>
            {course && (
              <p className="text-sm text-muted-foreground">
                {course.school_name} · {course.year_level}° año · {course.academic_year}
              </p>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8">
        <h2 className="text-xl font-semibold text-foreground mb-4">Lecciones</h2>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : lessons.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <BookOpen className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No hay lecciones creadas para este curso.</p>
            </CardContent>
          </Card>
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
                        <Badge variant={statusVariant(lesson.status)}>
                          {statusLabel(lesson.status)}
                        </Badge>
                        {lesson.is_generating && (
                          <Badge variant="outline" className="animate-pulse">
                            Generando...
                          </Badge>
                        )}
                        {lesson.brief_status && (
                          <Badge variant="outline">
                            {lesson.brief_status === "PRODUCED"
                              ? "Producida"
                              : lesson.brief_status === "READY_FOR_PRODUCTION"
                              ? "Lista"
                              : "En progreso"}
                          </Badge>
                        )}
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
      </main>
    </div>
  );
}
