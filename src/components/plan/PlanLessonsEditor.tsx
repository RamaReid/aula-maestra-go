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
  const [unitMap, setUnitMap] = useState<Map<string, string>>(new Map());

  const fetchLessons = useCallback(async () => {
    const { data } = await supabase
      .from("plan_lessons")
      .select(
        "id, lesson_number, term, theme, justification, learning_outcome, activities_summary, is_integrative_evaluation, is_recovery"
      )
      .eq("plan_id", planId)
      .order("lesson_number");

    const lessonsData = data || [];
    setLessons(lessonsData);

    // Fetch curriculum units linked to each lesson
    if (lessonsData.length > 0) {
      const lessonIds = lessonsData.map((l) => l.id);

      const { data: links } = await supabase
        .from("plan_lesson_content_links")
        .select("plan_lesson_id, plan_content_mapping_id")
        .in("plan_lesson_id", lessonIds);

      if (links && links.length > 0) {
        const mappingIds = [...new Set(links.map((l) => l.plan_content_mapping_id))];

        const { data: mappings } = await supabase
          .from("plan_content_mappings")
          .select("id, curriculum_node_id")
          .in("id", mappingIds);

        if (mappings && mappings.length > 0) {
          const nodeIds = [...new Set(mappings.map((m) => m.curriculum_node_id))];

          const { data: nodes } = await supabase
            .from("curriculum_nodes")
            .select("id, name, node_type, parent_id")
            .in("id", nodeIds);

          // Build nodeId -> node map
          const nodeMap = new Map((nodes || []).map((n) => [n.id, n]));

          // Build mappingId -> nodeId map
          const mappingToNode = new Map(mappings.map((m) => [m.id, m.curriculum_node_id]));

          // For each lesson, find the linked UNIDAD (or parent UNIDAD of linked CONTENIDO)
          const parentIdsToFetch = new Set<string>();
          for (const node of nodes || []) {
            if (node.node_type !== "UNIDAD" && node.parent_id) {
              parentIdsToFetch.add(node.parent_id);
            }
          }

          let parentNodes = new Map<string, { name: string; node_type: string }>();
          if (parentIdsToFetch.size > 0) {
            const { data: parents } = await supabase
              .from("curriculum_nodes")
              .select("id, name, node_type")
              .in("id", [...parentIdsToFetch]);
            parentNodes = new Map((parents || []).map((p) => [p.id, { name: p.name, node_type: p.node_type }]));
          }

          const newUnitMap = new Map<string, string>();

          for (const link of links) {
            const nodeId = mappingToNode.get(link.plan_content_mapping_id);
            if (!nodeId) continue;
            const node = nodeMap.get(nodeId);
            if (!node) continue;

            // If this node IS a UNIDAD, use it directly
            if (node.node_type === "UNIDAD" || node.node_type === "EJE" || node.node_type === "BLOQUE") {
              if (!newUnitMap.has(link.plan_lesson_id)) {
                newUnitMap.set(link.plan_lesson_id, node.name);
              }
            } else if (node.parent_id) {
              // Look up parent
              const parent = parentNodes.get(node.parent_id) || nodeMap.get(node.parent_id);
              if (parent && (parent.node_type === "UNIDAD" || parent.node_type === "EJE" || parent.node_type === "BLOQUE")) {
                if (!newUnitMap.has(link.plan_lesson_id)) {
                  newUnitMap.set(link.plan_lesson_id, parent.name);
                }
              }
            }
          }

          setUnitMap(newUnitMap);
        }
      }
    }

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

  const term1 = lessons.filter((l) => l.term === 1);
  const term2 = lessons.filter((l) => l.term === 2);

  const renderLesson = (lesson: PlanLesson) => {
    const canon = extractCanonParts(lesson.activities_summary, lesson.theme);
    const missingTheme = !lesson.theme.trim();
    const missingJustification = !lesson.justification.trim();
    const missingOutcome = !lesson.learning_outcome.trim();
    const missingOperation = !(canon.operation.length > 0 || canon.fallbackOperation.length > 0);
    const missingEvidence = canon.evidence.length === 0;
    const hasMissingFields =
      missingTheme || missingJustification || missingOutcome || !lesson.activities_summary.trim() || missingOperation || missingEvidence;

    const unitName = unitMap.get(lesson.id);

    return (
      <AccordionItem key={lesson.id} value={lesson.id}>
        <AccordionTrigger>
          <div className="flex flex-1 flex-wrap items-center gap-2 text-left">
            <span className="font-medium">Clase {lesson.lesson_number}</span>
            <Badge variant="outline">T{lesson.term}</Badge>
            {lesson.is_integrative_evaluation && <Badge variant="secondary">Integradora</Badge>}
            {lesson.is_recovery && <Badge variant="secondary">Recuperación</Badge>}
            {hasMissingFields ? (
              <Badge variant="destructive">Incompleta</Badge>
            ) : (
              <Badge variant="default">Completa</Badge>
            )}
            {unitName && (
              <span className="text-xs text-muted-foreground">
                Unidad: {unitName}
              </span>
            )}
            {lesson.theme && (
              <span className="line-clamp-1 text-sm font-normal text-muted-foreground">
                — {lesson.theme}
              </span>
            )}
          </div>
        </AccordionTrigger>
        <AccordionContent className="space-y-4 pb-4">
          {unitName && (
            <div className="rounded-md bg-muted/50 px-3 py-2">
              <p className="text-sm text-muted-foreground">
                <span className="font-medium">Unidad curricular:</span> {unitName}
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label>Tema de la clase</Label>
            <Input
              value={lesson.theme}
              disabled={readOnly}
              onChange={(event) => updateLocalLesson(lesson.id, "theme", event.target.value)}
              onBlur={(event) => persistField(lesson.id, "theme", event.target.value)}
              placeholder="Tema o recorte central de la clase"
            />
          </div>

          <div className="space-y-2">
            <Label>Justificación pedagógica</Label>
            <Textarea
              value={lesson.justification}
              disabled={readOnly}
              rows={3}
              onChange={(event) => updateLocalLesson(lesson.id, "justification", event.target.value)}
              onBlur={(event) => persistField(lesson.id, "justification", event.target.value)}
              placeholder="Fundamentación pedagógica de esta clase en la progresión anual"
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
              placeholder="Qué debería poder hacer o explicar el estudiantado al cierre"
            />
          </div>

          <div className="space-y-2">
            <Label>Operación y evidencia mínima</Label>
            <Textarea
              value={lesson.activities_summary}
              disabled={readOnly}
              rows={4}
              onChange={(event) => updateLocalLesson(lesson.id, "activities_summary", event.target.value)}
              onBlur={(event) => persistField(lesson.id, "activities_summary", event.target.value)}
              placeholder='Usa el formato: "Operación: ... Evidencia mínima: ..."'
            />
            <div className="space-y-1 text-xs text-muted-foreground">
              <p>
                Operación detectada:{" "}
                <span className={canon.operation ? "text-foreground" : "text-destructive"}>
                  {canon.operation || "Falta escribir la operación principal de la clase."}
                </span>
              </p>
              <p>
                Evidencia mínima detectada:{" "}
                <span className={canon.evidence ? "text-foreground" : "text-destructive"}>
                  {canon.evidence || "Falta explicitar la evidencia mínima que deja la clase."}
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
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
          <span>{completeLessons}/{lessons.length} clases completas</span>
          <span>{lessonsWithOperation}/{lessons.length} con operación visible</span>
          <span>{lessonsWithEvidence}/{lessons.length} con evidencia mínima visible</span>
        </div>
        <p className="text-xs text-muted-foreground">
          Edite tema, justificación, resultado y el bloque de operación más evidencia mínima para cerrar la anual.
        </p>
      </div>

      {term1.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-foreground">Primer cuatrimestre</h3>
          <Accordion type="multiple" className="w-full rounded-md border px-4">
            {term1.map(renderLesson)}
          </Accordion>
        </div>
      )}

      {term2.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-foreground">Segundo cuatrimestre</h3>
          <Accordion type="multiple" className="w-full rounded-md border px-4">
            {term2.map(renderLesson)}
          </Accordion>
        </div>
      )}
    </div>
  );
}

/** Fetches the unit map for plan lessons — used by PlanEditor for PDF export */
export async function fetchLessonUnitMap(planId: string): Promise<Map<string, string>> {
  const { data: lessonsData } = await supabase
    .from("plan_lessons")
    .select("id")
    .eq("plan_id", planId);

  if (!lessonsData || lessonsData.length === 0) return new Map();

  const lessonIds = lessonsData.map((l) => l.id);

  const { data: links } = await supabase
    .from("plan_lesson_content_links")
    .select("plan_lesson_id, plan_content_mapping_id")
    .in("plan_lesson_id", lessonIds);

  if (!links || links.length === 0) return new Map();

  const mappingIds = [...new Set(links.map((l) => l.plan_content_mapping_id))];
  const { data: mappings } = await supabase
    .from("plan_content_mappings")
    .select("id, curriculum_node_id")
    .in("id", mappingIds);

  if (!mappings || mappings.length === 0) return new Map();

  const nodeIds = [...new Set(mappings.map((m) => m.curriculum_node_id))];
  const { data: nodes } = await supabase
    .from("curriculum_nodes")
    .select("id, name, node_type, parent_id")
    .in("id", nodeIds);

  const nodeMap = new Map((nodes || []).map((n) => [n.id, n]));
  const mappingToNode = new Map(mappings.map((m) => [m.id, m.curriculum_node_id]));

  const parentIdsToFetch = new Set<string>();
  for (const node of nodes || []) {
    if (node.node_type !== "UNIDAD" && node.node_type !== "EJE" && node.node_type !== "BLOQUE" && node.parent_id) {
      parentIdsToFetch.add(node.parent_id);
    }
  }

  let parentNodes = new Map<string, { name: string; node_type: string }>();
  if (parentIdsToFetch.size > 0) {
    const { data: parents } = await supabase
      .from("curriculum_nodes")
      .select("id, name, node_type")
      .in("id", [...parentIdsToFetch]);
    parentNodes = new Map((parents || []).map((p) => [p.id, { name: p.name, node_type: p.node_type }]));
  }

  const result = new Map<string, string>();
  for (const link of links) {
    const nodeId = mappingToNode.get(link.plan_content_mapping_id);
    if (!nodeId) continue;
    const node = nodeMap.get(nodeId);
    if (!node) continue;

    if (node.node_type === "UNIDAD" || node.node_type === "EJE" || node.node_type === "BLOQUE") {
      if (!result.has(link.plan_lesson_id)) {
        result.set(link.plan_lesson_id, node.name);
      }
    } else if (node.parent_id) {
      const parent = parentNodes.get(node.parent_id) || nodeMap.get(node.parent_id);
      if (parent && (parent.node_type === "UNIDAD" || parent.node_type === "EJE" || parent.node_type === "BLOQUE")) {
        if (!result.has(link.plan_lesson_id)) {
          result.set(link.plan_lesson_id, parent.name);
        }
      }
    }
  }

  return result;
}
