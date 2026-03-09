import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { LoadingState } from "@/components/ui/LoadingState";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Eye, RefreshCw } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { StatusBadge, lessonStatusLabel, lessonStatusTone } from "@/components/ui/StatusBadge";
import {
  CourseScheduleSlot,
  getSchedulePreviewForLesson,
  formatScheduleSlot,
} from "@/lib/annualPlan";

interface LessonRow {
  id: string;
  lesson_number: number;
  term: number;
  theme: string;
  scheduled_date: string | null;
  computed_date: string | null;
  status: string;
}

interface Props {
  courseId: string;
  readOnly?: boolean;
}

export default function AgendaView({ courseId, readOnly = false }: Props) {
  const [lessons, setLessons] = useState<LessonRow[]>([]);
  const [scheduleSlots, setScheduleSlots] = useState<CourseScheduleSlot[]>([]);
  const [academicYear, setAcademicYear] = useState<number>(new Date().getFullYear());
  const [loading, setLoading] = useState(true);
  

  useEffect(() => {
    const fetch = async () => {
      const [{ data: lessonsData }, { data: courseData }, { data: slotsData }] = await Promise.all([
        supabase
          .from("lessons")
          .select("id, lesson_number, scheduled_date, status, plan_lesson_id")
          .eq("course_id", courseId)
          .order("lesson_number"),
        supabase.from("courses").select("academic_year").eq("id", courseId).single(),
        supabase
          .from("course_schedule_slots")
          .select("id, day_of_week, start_time, end_time, module_count, order_index")
          .eq("course_id", courseId)
          .order("order_index"),
      ]);

      const year = courseData?.academic_year || new Date().getFullYear();
      setAcademicYear(year);
      const slots = slotsData || [];
      setScheduleSlots(slots);

      if (lessonsData && lessonsData.length > 0) {
        const plIds = lessonsData.map((l) => l.plan_lesson_id);
        const { data: pls } = await supabase
          .from("plan_lessons")
          .select("id, theme, term")
          .in("id", plIds);

        const plMap = new Map((pls || []).map((p) => [p.id, { theme: p.theme, term: p.term }]));

        const mapped = lessonsData.map((l) => {
          const plData = plMap.get(l.plan_lesson_id) || { theme: "", term: 1 };
          const preview = getSchedulePreviewForLesson(year, slots, l.lesson_number, plData.term);
          return {
            id: l.id,
            lesson_number: l.lesson_number,
            term: plData.term,
            theme: plData.theme,
            scheduled_date: l.scheduled_date,
            computed_date: preview.scheduledDate,
            status: l.status,
          };
        });

        // Auto-sync: update any lesson whose date doesn't match the computed one
        if (slots.length > 0) {
          const toSync = mapped.filter(
            (l) => l.computed_date && l.scheduled_date !== l.computed_date
          );
          if (toSync.length > 0) {
            const promises = toSync.map((l) =>
              supabase
                .from("lessons")
                .update({ scheduled_date: l.computed_date })
                .eq("id", l.id)
            );
            await Promise.all(promises);
            // Reflect synced dates locally
            for (const l of toSync) {
              l.scheduled_date = l.computed_date;
            }
          }
        }

        setLessons(mapped);
      }
      setLoading(false);
    };
    fetch();
  }, [courseId]);

  const handleDateChange = async (lessonId: string, date: string) => {
    setLessons((prev) =>
      prev.map((l) => (l.id === lessonId ? { ...l, scheduled_date: date || null } : l))
    );
    const { error } = await supabase
      .from("lessons")
      .update({ scheduled_date: date || null })
      .eq("id", lessonId);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleSyncAll = async () => {
    if (scheduleSlots.length === 0) {
      toast({
        title: "Sin horarios configurados",
        description: "Configurá los días y horarios del curso antes de sincronizar.",
        variant: "destructive",
      });
      return;
    }

    setSyncing(true);
    const updates = lessons
      .filter((l) => l.computed_date && l.scheduled_date !== l.computed_date)
      .map((l) => ({ id: l.id, scheduled_date: l.computed_date }));

    if (updates.length === 0) {
      toast({ title: "Todo sincronizado", description: "Las fechas ya están al día." });
      setSyncing(false);
      return;
    }

    let errorCount = 0;
    for (const upd of updates) {
      const { error } = await supabase
        .from("lessons")
        .update({ scheduled_date: upd.scheduled_date })
        .eq("id", upd.id);
      if (error) errorCount++;
    }

    if (errorCount > 0) {
      toast({
        title: "Sincronización parcial",
        description: `${updates.length - errorCount} de ${updates.length} fechas actualizadas.`,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Agenda sincronizada",
        description: `${updates.length} fechas actualizadas según la planificación.`,
      });
    }

    setLessons((prev) =>
      prev.map((l) => {
        const upd = updates.find((u) => u.id === l.id);
        return upd ? { ...l, scheduled_date: upd.scheduled_date } : l;
      })
    );
    setSyncing(false);
  };

  if (loading) {
    return (
      <Card>
        <CardContent>
          <LoadingState
            tips={[
              "Cargando la agenda del curso...",
              "Organizando las clases...",
              "Preparando el calendario...",
            ]}
          />
        </CardContent>
      </Card>
    );
  }

  if (lessons.length === 0) return null;

  const outOfSync = lessons.filter(
    (l) => l.computed_date && l.scheduled_date !== l.computed_date
  ).length;

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        {/* Sync header */}
        {scheduleSlots.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/30 p-3">
            <div className="space-y-0.5">
              <p className="text-sm font-medium">
                Cursada: {scheduleSlots.map((s) => formatScheduleSlot(s)).join(" · ")}
              </p>
              {outOfSync > 0 ? (
                <p className="text-xs text-amber-600">
                  {outOfSync} clase{outOfSync > 1 ? "s" : ""} con fecha distinta a la planificación.
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Todas las fechas coinciden con la planificación.
                </p>
              )}
            </div>
            {!readOnly && outOfSync > 0 && (
              <Button size="sm" variant="outline" onClick={handleSyncAll} disabled={syncing}>
                <RefreshCw className={`h-3.5 w-3.5 mr-1 ${syncing ? "animate-spin" : ""}`} />
                Sincronizar fechas
              </Button>
            )}
          </div>
        )}

        {/* Header row */}
        <div className="grid grid-cols-[2rem_1fr_auto_auto_auto] gap-3 items-center pb-2 border-b">
          <span className="text-xs font-medium text-muted-foreground">N°</span>
          <span className="text-xs font-medium text-muted-foreground">Tema</span>
          <span className="text-xs font-medium text-muted-foreground">Fecha</span>
          <span className="text-xs font-medium text-muted-foreground">Estado</span>
          <span className="text-xs font-medium text-muted-foreground">Acción</span>
        </div>
        {lessons.map((lesson) => {
          const mismatch =
            lesson.computed_date && lesson.scheduled_date !== lesson.computed_date;
          return (
            <div
              key={lesson.id}
              className={`grid grid-cols-[2rem_1fr_auto_auto_auto] gap-3 items-center py-2 border-b last:border-0 ${
                mismatch ? "bg-amber-50 dark:bg-amber-950/20" : ""
              }`}
            >
              <span className="text-sm font-medium">{lesson.lesson_number}</span>
              <span className="text-sm text-muted-foreground">{lesson.theme || "—"}</span>
              <div className="flex flex-col gap-0.5">
                <Input
                  type="date"
                  value={lesson.scheduled_date || ""}
                  onChange={(e) => handleDateChange(lesson.id, e.target.value)}
                  disabled={readOnly}
                  className={`w-36 ${mismatch ? "border-amber-400" : ""}`}
                />
                {mismatch && (
                  <span className="text-[10px] text-amber-600">
                    Planificada: {lesson.computed_date}
                  </span>
                )}
              </div>
              <StatusBadge
                tone={lessonStatusTone(lesson.status)}
                label={lessonStatusLabel(lesson.status)}
              />
              <Button size="sm" variant="ghost" asChild className="gap-1">
                <Link to={`/lesson/${lesson.id}`}>
                  <Eye className="h-3.5 w-3.5" />
                  Ver clase
                </Link>
              </Button>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}