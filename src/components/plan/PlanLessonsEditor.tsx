import { useCallback, useEffect, useMemo, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  CourseScheduleSlot,
  formatScheduledDate,
  formatScheduleSlot,
  getSchedulePreviewForLesson,
} from "@/lib/annualPlan";

interface PlanLesson {
  id: string;
  lesson_number: number;
  term: number;
  content_block_id: string | null;
  theme: string;
  subtitle: string;
  justification: string;
  learning_outcome: string;
  activities_summary: string;
  is_integrative_evaluation: boolean;
  is_recovery: boolean;
}

interface ContentBlock {
  id: string;
  title: string;
}

interface Props {
  planId: string;
  courseId: string;
  readOnly: boolean;
  onDirty?: () => Promise<void> | void;
}

type EditableField = "content_block_id" | "theme" | "subtitle" | "justification" | "learning_outcome" | "activities_summary";

function extractCanonParts(summary: string, theme: string) {
  const raw = summary.trim();
  if (!raw) {
    return {
      operation: "",
      evidence: "",
      fallbackOperation: `Desarrollo guiado sobre ${theme || "la clase"}.`,
      fallbackEvidence: `Producción breve verificable alineada con ${theme || "la clase"}.`,
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

export default function PlanLessonsEditor({ planId, courseId, readOnly, onDirty }: Props) {
  const [lessons, setLessons] = useState<PlanLesson[]>([]);
  const [blocks, setBlocks] = useState<ContentBlock[]>([]);
  const [scheduleSlots, setScheduleSlots] = useState<CourseScheduleSlot[]>([]);
  const [academicYear, setAcademicYear] = useState<number>(new Date().getFullYear());
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const fetchLessons = useCallback(async () => {
    const [{ data: lessonRows }, { data: contentBlocks }, { data: courseRow }, { data: slots }] = await Promise.all([
      supabase
        .from("plan_lessons")
        .select(
          "id, lesson_number, term, content_block_id, theme, subtitle, justification, learning_outcome, activities_summary, is_integrative_evaluation, is_recovery"
        )
        .eq("plan_id", planId)
        .order("lesson_number"),
      supabase.from("plan_content_blocks").select("id, title").eq("plan_id", planId).order("order_index"),
      supabase.from("courses").select("academic_year").eq("id", courseId).single(),
      supabase
        .from("course_schedule_slots")
        .select("id, day_of_week, start_time, end_time, module_count, order_index")
        .eq("course_id", courseId)
        .order("order_index"),
    ]);

    if (lessonRows) setLessons(lessonRows);
    if (contentBlocks) setBlocks(contentBlocks);
    if (courseRow?.academic_year) setAcademicYear(courseRow.academic_year);
    if (slots) setScheduleSlots(slots);
    setLoading(false);
  }, [courseId, planId]);

  useEffect(() => {
    fetchLessons();
  }, [fetchLessons]);

  const updateLocalLesson = (lessonId: string, field: EditableField, value: string | null) => {
    setLessons((current) =>
      current.map((lesson) => (lesson.id === lessonId ? { ...lesson, [field]: value } : lesson))
    );
  };

  const persistField = async (lessonId: string, field: EditableField, value: string | null) => {
    if (readOnly) return;

    setSavingKey(`${lessonId}:${field}`);
    await onDirty?.();
    await supabase.from("plan_lessons").update({ [field]: value }).eq("id", lessonId);
    setSavingKey(null);
  };

  const lessonsByTerm = useMemo(
    () => [
      { term: 1, title: "Primer cuatrimestre", lessons: lessons.filter((lesson) => lesson.term === 1) },
      { term: 2, title: "Segundo cuatrimestre", lessons: lessons.filter((lesson) => lesson.term === 2) },
    ],
    [lessons]
  );

  const completeLessons = lessons.filter((lesson) => {
    const canon = extractCanonParts(lesson.activities_summary, lesson.theme);
    return (
      lesson.theme.trim().length > 0 &&
      lesson.subtitle.trim().length > 0 &&
      lesson.justification.trim().length > 0 &&
      lesson.learning_outcome.trim().length > 0 &&
      lesson.activities_summary.trim().length > 0 &&
      (canon.operation.length > 0 || canon.fallbackOperation.length > 0) &&
      canon.evidence.length > 0
    );
  }).length;

  if (loading) {
    return <p className="text-sm text-muted-foreground">Cargando clases del plan...</p>;
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border bg-muted/20 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">{completeLessons}/28 clases con estructura completa</p>
            <p className="text-xs text-muted-foreground">
              La anual se organiza como clases reales: unidad, tema, modo de trabajo, evidencia y cronograma semanal.
            </p>
          </div>
          <div className="text-xs text-muted-foreground">
            {scheduleSlots.length > 0
              ? `Cursada configurada: ${scheduleSlots.map((slot) => formatScheduleSlot(slot)).join(" · ")}`
              : "Todavía no hay días y horarios configurados para este curso."}
          </div>
        </div>
      </div>

      {lessonsByTerm.map((termGroup) => (
        <section key={termGroup.term} className="space-y-3">
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-foreground">{termGroup.title}</h3>
            <p className="text-sm text-muted-foreground">{termGroup.lessons.length} clases previstas para este tramo.</p>
          </div>

          <Accordion type="multiple" className="space-y-3">
            {termGroup.lessons.map((lesson) => {
              const block = blocks.find((item) => item.id === lesson.content_block_id);
              const canon = extractCanonParts(lesson.activities_summary, lesson.theme);
              const schedulePreview = getSchedulePreviewForLesson(academicYear, scheduleSlots, lesson.lesson_number, lesson.term);
              const issueLabels = [
                !lesson.content_block_id ? "Falta unidad" : null,
                !lesson.theme.trim() ? "Falta tema" : null,
                !lesson.subtitle.trim() ? "Falta modo de trabajo" : null,
                !lesson.learning_outcome.trim() ? "Falta evidencia esperada" : null,
                !canon.evidence.trim() ? "Falta evidencia mínima" : null,
              ].filter(Boolean) as string[];

              return (
                <AccordionItem key={lesson.id} value={lesson.id} className="rounded-xl border bg-card px-4">
                  <AccordionTrigger className="py-4">
                    <div className="flex flex-1 flex-col gap-2 text-left">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-foreground">Clase {lesson.lesson_number}</span>
                        {lesson.is_integrative_evaluation ? <Badge variant="secondary">Integradora</Badge> : null}
                        {lesson.is_recovery ? <Badge variant="secondary">Recuperación</Badge> : null}
                        {issueLabels.length === 0 ? <Badge variant="default">Completa</Badge> : <Badge variant="destructive">En revisión</Badge>}
                      </div>
                      <p className="text-sm text-foreground">
                        <span className="font-medium">Unidad:</span> {block?.title || "Sin unidad asignada"}{" "}
                        <span className="font-medium">· Tema:</span> {lesson.theme || "Sin tema definido"}
                      </p>
                      <p className="text-sm text-muted-foreground">{lesson.subtitle || canon.operation || "Define cómo se va a trabajar el tema."}</p>
                      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                        <span>{schedulePreview.slot ? formatScheduleSlot(schedulePreview.slot) : "Sin día y horario"}</span>
                        <span>{formatScheduledDate(schedulePreview.scheduledDate)}</span>
                      </div>
                    </div>
                  </AccordionTrigger>

                  <AccordionContent className="space-y-4 pb-5">
                    <div className="space-y-2">
                      <Label>Unidad o bloque</Label>
                      <Select
                        value={lesson.content_block_id || ""}
                        disabled={readOnly}
                        onValueChange={(value) => {
                          updateLocalLesson(lesson.id, "content_block_id", value);
                          void persistField(lesson.id, "content_block_id", value);
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona una unidad" />
                        </SelectTrigger>
                        <SelectContent>
                          {blocks.map((blockOption) => (
                            <SelectItem key={blockOption.id} value={blockOption.id}>
                              {blockOption.title}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Tema de la clase</Label>
                      <Input
                        value={lesson.theme}
                        disabled={readOnly}
                        onChange={(event) => updateLocalLesson(lesson.id, "theme", event.target.value)}
                        onBlur={(event) => void persistField(lesson.id, "theme", event.target.value)}
                        placeholder="Recorte central de la clase"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Cómo se va a trabajar el tema</Label>
                      <Textarea
                        value={lesson.subtitle}
                        rows={2}
                        disabled={readOnly}
                        onChange={(event) => updateLocalLesson(lesson.id, "subtitle", event.target.value)}
                        onBlur={(event) => void persistField(lesson.id, "subtitle", event.target.value)}
                        placeholder="Subtítulo operativo de la clase"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Justificación pedagógica</Label>
                      <Textarea
                        value={lesson.justification}
                        rows={3}
                        disabled={readOnly}
                        onChange={(event) => updateLocalLesson(lesson.id, "justification", event.target.value)}
                        onBlur={(event) => void persistField(lesson.id, "justification", event.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Resultado o evidencia esperada</Label>
                      <Textarea
                        value={lesson.learning_outcome}
                        rows={3}
                        disabled={readOnly}
                        onChange={(event) => updateLocalLesson(lesson.id, "learning_outcome", event.target.value)}
                        onBlur={(event) => void persistField(lesson.id, "learning_outcome", event.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Operación y evidencia mínima</Label>
                      <Textarea
                        value={lesson.activities_summary}
                        rows={4}
                        disabled={readOnly}
                        onChange={(event) => updateLocalLesson(lesson.id, "activities_summary", event.target.value)}
                        onBlur={(event) => void persistField(lesson.id, "activities_summary", event.target.value)}
                        placeholder='Usa el formato: "Operacion: ... Evidencia minima: ..."'
                      />
                      <div className="space-y-1 rounded-lg bg-muted/30 p-3 text-xs text-muted-foreground">
                        <p>
                          <span className="font-medium text-foreground">Operación detectada:</span>{" "}
                          {canon.operation || canon.fallbackOperation || "Todavía no se detecta una operación principal."}
                        </p>
                        <p>
                          <span className="font-medium text-foreground">Evidencia mínima detectada:</span>{" "}
                          {canon.evidence || "Todavía no se explicitó la evidencia mínima."}
                        </p>
                      </div>
                    </div>

                    {savingKey?.startsWith(lesson.id) ? (
                      <p className="text-xs text-muted-foreground">Guardando cambios...</p>
                    ) : null}
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        </section>
      ))}
    </div>
  );
}
