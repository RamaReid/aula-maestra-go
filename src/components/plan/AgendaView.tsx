import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";

interface LessonRow {
  id: string;
  lesson_number: number;
  theme: string;
  scheduled_date: string | null;
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
        .select("id, lesson_number, scheduled_date, plan_lesson_id")
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
      <CardHeader>
        <CardTitle className="text-lg">Agenda</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">#</TableHead>
              <TableHead>Tema</TableHead>
              <TableHead className="w-44">Fecha</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lessons.map((lesson) => (
              <TableRow key={lesson.id}>
                <TableCell className="font-medium">{lesson.lesson_number}</TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {lesson.theme || "—"}
                </TableCell>
                <TableCell>
                  <Input
                    type="date"
                    value={lesson.scheduled_date || ""}
                    onChange={(e) => handleDateChange(lesson.id, e.target.value)}
                    disabled={readOnly}
                    className="w-full"
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
