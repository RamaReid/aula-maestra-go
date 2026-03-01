import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { ChevronDown, RefreshCw } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface PlanLesson {
  id: string;
  lesson_number: number;
  term: number;
  theme: string;
  activities_summary: string;
  learning_outcome: string;
  justification: string;
}

interface Props {
  planId: string;
  readOnly: boolean;
}

export default function PlanLessonsEditor({ planId, readOnly }: Props) {
  const [lessons, setLessons] = useState<PlanLesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [recreating, setRecreating] = useState(false);

  const fetchLessons = useCallback(async () => {
    const { data } = await supabase
      .from("plan_lessons")
      .select("id, lesson_number, term, theme, activities_summary, learning_outcome, justification")
      .eq("plan_id", planId)
      .order("lesson_number");
    if (data) setLessons(data);
    setLoading(false);
  }, [planId]);

  useEffect(() => {
    fetchLessons();
  }, [fetchLessons]);

  const handleRecreate = async () => {
    setRecreating(true);
    try {
      await supabase.from("plan_lessons").delete().eq("plan_id", planId);
      const rows = Array.from({ length: 28 }, (_, i) => ({
        plan_id: planId,
        lesson_number: i + 1,
        term: i < 14 ? 1 : 2,
        theme: "",
        activities_summary: "",
        learning_outcome: "",
        justification: "",
      }));
      const { error } = await supabase.from("plan_lessons").insert(rows);
      if (error) throw error;
      toast({ title: "Cronograma recreado", description: "28 clases creadas." });
      await fetchLessons();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setRecreating(false);
    }
  };

  const saveField = async (id: string, field: string, value: string) => {
    if (readOnly) return;
    const { error } = await supabase.from("plan_lessons").update({ [field]: value }).eq("id", id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
  };

  const updateLocal = (id: string, field: string, value: string) => {
    setLessons((prev) =>
      prev.map((l) => (l.id === id ? { ...l, [field]: value } : l))
    );
  };

  if (loading) return <p className="text-sm text-muted-foreground">Cargando cronograma...</p>;

  if (lessons.length < 28) {
    return (
      <div className="space-y-3 text-center py-4">
        <p className="text-sm text-muted-foreground">
          El cronograma tiene {lessons.length} clases (se requieren 28).
        </p>
        {!readOnly && (
          <Button onClick={handleRecreate} disabled={recreating} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            {recreating ? "Recreando..." : "Recrear cronograma (1..28)"}
          </Button>
        )}
      </div>
    );
  }

  const term1 = lessons.filter((l) => l.term === 1);
  const term2 = lessons.filter((l) => l.term === 2);

  const renderGroup = (title: string, items: PlanLesson[]) => (
    <div className="space-y-2">
      <h4 className="text-sm font-semibold text-muted-foreground border-b pb-1">{title}</h4>
      {items.map((lesson) => (
        <Collapsible key={lesson.id}>
          <div className="border rounded-md p-2 space-y-2">
            <div className="grid grid-cols-[2.5rem_1fr_1fr_3rem] gap-2 items-start">
              <span className="text-sm font-medium pt-2 text-center">{lesson.lesson_number}</span>
              <Input
                value={lesson.theme}
                onChange={(e) => updateLocal(lesson.id, "theme", e.target.value)}
                onBlur={() => saveField(lesson.id, "theme", lesson.theme)}
                placeholder="Tema..."
                disabled={readOnly}
                className="text-sm"
              />
              <Textarea
                value={lesson.activities_summary}
                onChange={(e) => updateLocal(lesson.id, "activities_summary", e.target.value)}
                onBlur={() => saveField(lesson.id, "activities_summary", lesson.activities_summary)}
                placeholder="Actividades..."
                disabled={readOnly}
                rows={2}
                className="text-sm min-h-[2.5rem]"
              />
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="icon" className="mt-1">
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </CollapsibleTrigger>
            </div>
            <CollapsibleContent className="space-y-2 pl-10 pr-10">
              <div>
                <label className="text-xs text-muted-foreground">Aprendizaje esperado</label>
                <Textarea
                  value={lesson.learning_outcome}
                  onChange={(e) => updateLocal(lesson.id, "learning_outcome", e.target.value)}
                  onBlur={() => saveField(lesson.id, "learning_outcome", lesson.learning_outcome)}
                  placeholder="Aprendizaje esperado..."
                  disabled={readOnly}
                  rows={2}
                  className="text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Justificación</label>
                <Textarea
                  value={lesson.justification}
                  onChange={(e) => updateLocal(lesson.id, "justification", e.target.value)}
                  onBlur={() => saveField(lesson.id, "justification", lesson.justification)}
                  placeholder="Justificación pedagógica..."
                  disabled={readOnly}
                  rows={2}
                  className="text-sm"
                />
              </div>
            </CollapsibleContent>
          </div>
        </Collapsible>
      ))}
    </div>
  );

  return (
    <div className="space-y-4">
      {renderGroup("Cuatrimestre 1 (clases 1–14)", term1)}
      {renderGroup("Cuatrimestre 2 (clases 15–28)", term2)}
    </div>
  );
}
