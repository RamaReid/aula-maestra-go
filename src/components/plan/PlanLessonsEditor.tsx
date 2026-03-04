import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

interface PlanLesson {
  id: string;
  lesson_number: number;
  term: number;
  theme: string;
  justification: string;
  learning_outcome: string;
  activities_summary: string;
  is_integrative_evaluation: boolean;
  is_recovery: boolean;
}

interface Props {
  planId: string;
  readOnly: boolean;
  onDirty?: () => Promise<void> | void;
}

type EditableField = "theme" | "justification" | "learning_outcome" | "activities_summary";

function extractCanonParts(summary: string, theme: string) {
  const raw = summary.trim();
  if (!raw) {
    return {
      operation: "",
      evidence: "",
      fallbackOperation: `Desarrollo guiado sobre ${theme || "la clase"}.`,
      fallbackEvidence: `Produccion breve verificable alineada con ${theme || "la clase"}.`,
    };
  }

  const operationMatch = raw.match(/operacion\s*:\s*([\s\S]*?)(?=evidencia minima\s*:|$)/i);
  const evidenceMatch = raw.match(/evidencia minima\s*:\s*([\s\S]*)$/i);

  return {
    operation: (operationMatch?.[1] || "").replace(/\s+/g, " ").trim(),
    evidence: (evidenceMatch?.[1] || "").replace(/\s+/g, " ").trim(),
    fallbackOperation: raw.replace(/\s+/g, " ").trim(),
    fallbackEvidence: "",
  };
}

export default function PlanLessonsEditor({ planId, readOnly, onDirty }: Props) {
  const [lessons, setLessons] = useState<PlanLesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const fetchLessons = useCallback(async () => {
    const { data } = await supabase
      .from("plan_lessons")
      .select(
        "id, lesson_number, term, theme, justification, learning_outcome, activities_summary, is_integrative_evaluation, is_recovery"
      )
      .eq("plan_id", planId)
      .order("lesson_number");

    if (data) setLessons(data);
    setLoading(false);
  }, [planId]);

  useEffect(() => {
    fetchLessons();
  }, [fetchLessons]);

  const updateLocalLesson = (lessonId: string, field: EditableField, value: string) => {
    setLessons((prev) =>
      prev.map((lesson) => (lesson.id === lessonId ? { ...lesson, [field]: value } : lesson))
    );
  };

  const persistField = async (lessonId: string, field: EditableField, value: string) => {
    if (readOnly) return;

    setSavingKey(`${lessonId}:${field}`);
    await onDirty?.();
    await supabase.from("plan_lessons").update({ [field]: value }).eq("id", lessonId);
    setSavingKey(null);
  };

  if (loading) {
    return <p className="text-sm text-muted-foreground">Cargando clases del plan...</p>;
  }

  const completeLessons = lessons.filter((lesson) => {
    const canon = extractCanonParts(lesson.activities_summary, lesson.theme);
    return (
      lesson.theme.trim().length > 0 &&
      lesson.justification.trim().length > 0 &&
      lesson.learning_outcome.trim().length > 0 &&
      lesson.activities_summary.trim().length > 0 &&
      (canon.operation.length > 0 || canon.fallbackOperation.length > 0) &&
      canon.evidence.length > 0
    );
  }).length;

  const lessonsWithOperation = lessons.filter((lesson) => {
    const canon = extractCanonParts(lesson.activities_summary, lesson.theme);
    return canon.operation.length > 0 || canon.fallbackOperation.length > 0;
  }).length;

  const lessonsWithEvidence = lessons.filter((lesson) => {
    const canon = extractCanonParts(lesson.activities_summary, lesson.theme);
    return canon.evidence.length > 0;
  }).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
          <span>{completeLessons}/{lessons.length} clases completas</span>
          <span>{lessonsWithOperation}/{lessons.length} con operacion visible</span>
          <span>{lessonsWithEvidence}/{lessons.length} con evidencia minima visible</span>
        </div>
        <p className="text-xs text-muted-foreground">
          Edite foco, justificacion, resultado y el bloque de operacion mas evidencia minima para cerrar la anual.
        </p>
      </div>

      <Accordion type="multiple" className="w-full rounded-md border px-4">
        {lessons.map((lesson) => {
          const canon = extractCanonParts(lesson.activities_summary, lesson.theme);
          const missingFocus = !lesson.theme.trim();
          const missingJustification = !lesson.justification.trim();
          const missingOutcome = !lesson.learning_outcome.trim();
          const missingOperation = !(canon.operation.length > 0 || canon.fallbackOperation.length > 0);
          const missingEvidence = canon.evidence.length === 0;
          const hasMissingFields =
            missingFocus || missingJustification || missingOutcome || !lesson.activities_summary.trim() || missingOperation || missingEvidence;
          const issueLabels = [
            missingFocus ? "Falta foco" : null,
            missingJustification ? "Falta justificacion" : null,
            missingOutcome ? "Falta resultado" : null,
            missingOperation ? "Falta operacion" : null,
            missingEvidence ? "Falta evidencia" : null,
          ].filter(Boolean) as string[];

          return (
            <AccordionItem key={lesson.id} value={lesson.id}>
              <AccordionTrigger>
                <div className="flex flex-1 flex-wrap items-center gap-2 text-left">
                  <span className="font-medium">Clase {lesson.lesson_number}</span>
                  <Badge variant="outline">T{lesson.term}</Badge>
                  {lesson.is_integrative_evaluation && <Badge variant="secondary">Integradora</Badge>}
                  {lesson.is_recovery && <Badge variant="secondary">Recuperacion</Badge>}
                  {hasMissingFields ? (
                    <Badge variant="destructive">Incompleta</Badge>
                  ) : (
                    <Badge variant="default">Completa</Badge>
                  )}
                  {issueLabels.slice(0, 3).map((label) => (
                    <Badge key={label} variant="outline">
                      {label}
                    </Badge>
                  ))}
                  {lesson.theme && (
                    <span className="line-clamp-1 text-sm font-normal text-muted-foreground">{lesson.theme}</span>
                  )}
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-4 pb-4">
                <div className="space-y-2">
                  <Label>Foco de la clase</Label>
                  <Input
                    value={lesson.theme}
                    disabled={readOnly}
                    onChange={(event) => updateLocalLesson(lesson.id, "theme", event.target.value)}
                    onBlur={(event) => persistField(lesson.id, "theme", event.target.value)}
                    placeholder="Tema o recorte central de la clase"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Justificacion</Label>
                  <Textarea
                    value={lesson.justification}
                    disabled={readOnly}
                    rows={3}
                    onChange={(event) => updateLocalLesson(lesson.id, "justification", event.target.value)}
                    onBlur={(event) => persistField(lesson.id, "justification", event.target.value)}
                    placeholder="Por que esta clase importa dentro de la progresion anual"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Resultado de aprendizaje</Label>
                  <Textarea
                    value={lesson.learning_outcome}
                    disabled={readOnly}
                    rows={3}
                    onChange={(event) => updateLocalLesson(lesson.id, "learning_outcome", event.target.value)}
                    onBlur={(event) => persistField(lesson.id, "learning_outcome", event.target.value)}
                    placeholder="Que deberia poder hacer o explicar el estudiantado al cierre"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Operacion y evidencia minima</Label>
                  <Textarea
                    value={lesson.activities_summary}
                    disabled={readOnly}
                    rows={4}
                    onChange={(event) => updateLocalLesson(lesson.id, "activities_summary", event.target.value)}
                    onBlur={(event) => persistField(lesson.id, "activities_summary", event.target.value)}
                    placeholder='Usa el formato: "Operacion: ... Evidencia minima: ..."'
                  />
                  <div className="space-y-1 text-xs text-muted-foreground">
                    <p>
                      Operacion detectada:{" "}
                      <span className={canon.operation ? "text-foreground" : "text-destructive"}>
                        {canon.operation || "Falta escribir la operacion principal de la clase."}
                      </span>
                    </p>
                    <p>
                      Evidencia minima detectada:{" "}
                      <span className={canon.evidence ? "text-foreground" : "text-destructive"}>
                        {canon.evidence || "Falta explicitar la evidencia minima que deja la clase."}
                      </span>
                    </p>
                  </div>
                </div>

                {savingKey?.startsWith(lesson.id) && (
                  <p className="text-xs text-muted-foreground">Guardando cambios...</p>
                )}
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
}
