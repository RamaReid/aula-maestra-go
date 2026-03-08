import { useCallback, useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

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

function isLessonComplete(lesson: PlanLesson): boolean {
  return (
    lesson.theme.trim().length > 0 &&
    lesson.justification.trim().length > 0 &&
    lesson.learning_outcome.trim().length > 0 &&
    lesson.activities_summary.trim().length > 0
  );
}

export default function PlanLessonsEditor({ planId, readOnly, onDirty }: Props) {
  const [lessons, setLessons] = useState<PlanLesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [unitMap, setUnitMap] = useState<Map<string, string>>(new Map());
  const [editingId, setEditingId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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

          const newUnitMap = new Map<string, string>();
          for (const link of links) {
            const nodeId = mappingToNode.get(link.plan_content_mapping_id);
            if (!nodeId) continue;
            const node = nodeMap.get(nodeId);
            if (!node) continue;
            if (node.node_type === "UNIDAD" || node.node_type === "EJE" || node.node_type === "BLOQUE") {
              if (!newUnitMap.has(link.plan_lesson_id)) {
                newUnitMap.set(link.plan_lesson_id, node.name);
              }
            } else if (node.parent_id) {
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

  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingId]);

  const persistTheme = async (lessonId: string, value: string) => {
    if (readOnly) return;
    await onDirty?.();
    await supabase.from("plan_lessons").update({ theme: value }).eq("id", lessonId);
    setEditingId(null);
  };

  if (loading) {
    return <p className="text-sm text-muted-foreground">Cargando clases del plan...</p>;
  }

  const completeLessons = lessons.filter(isLessonComplete).length;
  const term1 = lessons.filter((l) => l.term === 1);
  const term2 = lessons.filter((l) => l.term === 2);

  const renderRow = (lesson: PlanLesson) => {
    const complete = isLessonComplete(lesson);
    const unitName = unitMap.get(lesson.id);
    const isEditing = editingId === lesson.id;

    return (
      <div
        key={lesson.id}
        className={cn(
          "grid grid-cols-[2.5rem_2rem_1fr_auto] sm:grid-cols-[2.5rem_2rem_minmax(8rem,1fr)_minmax(6rem,1fr)_auto] items-center gap-2 rounded-lg px-3 py-2 text-sm",
          complete ? "bg-background/60" : "bg-destructive/5 border border-destructive/20"
        )}
      >
        {/* Nro */}
        <span className="font-medium text-foreground">{lesson.lesson_number}</span>
        {/* Cuatrimestre */}
        <span className="text-muted-foreground text-xs">T{lesson.term}</span>
        {/* Tema (editable inline) */}
        <div className="min-w-0">
          {isEditing && !readOnly ? (
            <Input
              ref={inputRef}
              value={lesson.theme}
              onChange={(e) =>
                setLessons((prev) =>
                  prev.map((l) => (l.id === lesson.id ? { ...l, theme: e.target.value } : l))
                )
              }
              onBlur={(e) => persistTheme(lesson.id, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") persistTheme(lesson.id, lesson.theme);
                if (e.key === "Escape") setEditingId(null);
              }}
              className="h-7 text-sm"
              placeholder="Tema de la clase..."
            />
          ) : (
            <span
              className={cn(
                "block truncate cursor-pointer hover:text-primary transition-colors",
                lesson.theme.trim() ? "text-foreground" : "text-muted-foreground italic"
              )}
              onClick={() => !readOnly && setEditingId(lesson.id)}
              title={lesson.theme || "Click para editar tema"}
            >
              {lesson.theme.trim() || "Sin tema"}
            </span>
          )}
        </div>
        {/* Unidad (hidden on mobile) */}
        <span className="hidden sm:block truncate text-xs text-muted-foreground" title={unitName}>
          {unitName || "—"}
        </span>
        {/* Badges */}
        <div className="flex items-center gap-1 shrink-0">
          {lesson.is_integrative_evaluation && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Integ.</Badge>}
          {lesson.is_recovery && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Recup.</Badge>}
          {complete ? (
            <Badge variant="default" className="text-[10px] px-1.5 py-0">✓</Badge>
          ) : (
            <Badge variant="destructive" className="text-[10px] px-1.5 py-0">—</Badge>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm text-muted-foreground">
          {completeLessons}/{lessons.length} clases completas
        </span>
        <p className="text-xs text-muted-foreground">
          Click en el tema para editar. Los demás campos se completan en la vista individual de cada clase post-validación.
        </p>
      </div>

      {/* Header row */}
      <div className="grid grid-cols-[2.5rem_2rem_1fr_auto] sm:grid-cols-[2.5rem_2rem_minmax(8rem,1fr)_minmax(6rem,1fr)_auto] gap-2 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        <span>#</span>
        <span>T</span>
        <span>Tema</span>
        <span className="hidden sm:block">Unidad</span>
        <span>Estado</span>
      </div>

      {term1.length > 0 && (
        <div className="space-y-1">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-3">1er cuatrimestre</h3>
          <div className="space-y-0.5">
            {term1.map(renderRow)}
          </div>
        </div>
      )}

      {term2.length > 0 && (
        <div className="space-y-1">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-3">2do cuatrimestre</h3>
          <div className="space-y-0.5">
            {term2.map(renderRow)}
          </div>
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
