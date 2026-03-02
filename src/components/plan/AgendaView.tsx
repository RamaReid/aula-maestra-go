import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Eye } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { StatusBadge, lessonStatusLabel, lessonStatusTone } from "@/components/ui/StatusBadge";

interface LessonRow {
  id: string;
  lesson_number: number;
  theme: string;
  scheduled_date: string | null;
  status: string;
}

interface Props {
  courseId: string;
  readOnly?: boolean;
}

export default function AgendaView({ courseId, readOnly = false }: Props) {
  const [lessons, setLessons] = useState<LessonRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("lessons")
        .select("id, lesson_number, scheduled_date, status, plan_lesson_id")
        .eq("course_id", courseId)
        .order("lesson_number");

      if (data && data.length > 0) {
        const plIds = data.map((l) => l.plan_lesson_id);
        const { data: pls } = await supabase
          .from("plan_lessons")
          .select("id, theme")
          .in("id", plIds);

        const plMap = new Map((pls || []).map((p) => [p.id, p.theme]));

        setLessons(
          data.map((l) => ({
            id: l.id,
            lesson_number: l.lesson_number,
            theme: plMap.get(l.plan_lesson_id) || "",
            scheduled_date: l.scheduled_date,
            status: l.status,
          }))
        );
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

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-muted-foreground">Cargando agenda...</p>
        </CardContent>
      </Card>
    );
  }

  if (lessons.length === 0) return null;

  return (
    <Card>
      <CardContent className="pt-6">
        {/* Header row */}
        <div className="grid grid-cols-[2rem_1fr_auto_auto_auto] gap-3 items-center pb-2 border-b mb-1">
          <span className="text-xs font-medium text-muted-foreground">N°</span>
          <span className="text-xs font-medium text-muted-foreground">Tema</span>
          <span className="text-xs font-medium text-muted-foreground">Fecha</span>
          <span className="text-xs font-medium text-muted-foreground">Estado</span>
          <span className="text-xs font-medium text-muted-foreground">Acción</span>
        </div>
        {lessons.map((lesson) => (
          <div
            key={lesson.id}
            className="grid grid-cols-[2rem_1fr_auto_auto_auto] gap-3 items-center py-2 border-b last:border-0"
          >
            <span className="text-sm font-medium">{lesson.lesson_number}</span>
            <span className="text-sm text-muted-foreground">{lesson.theme || "—"}</span>
            <Input
              type="date"
              value={lesson.scheduled_date || ""}
              onChange={(e) => handleDateChange(lesson.id, e.target.value)}
              disabled={readOnly}
              className="w-36"
            />
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
        ))}
      </CardContent>
    </Card>
  );
}
