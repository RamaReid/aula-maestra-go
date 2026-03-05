import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

interface Node {
  id: string;
  name: string;
  node_type: string;
}

interface BibliographySelectorProps {
  courseId: string;
  lessonId?: string;
  selected: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
}

function normalizeName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function shouldHideNode(name: string): boolean {
  const normalized = normalizeName(name);
  return (
    normalized.startsWith("isbn ") ||
    normalized.startsWith("cdd ") ||
    normalized === "equipo de especialistas" ||
    normalized.startsWith("diseno curricular para") ||
    normalized.startsWith("educacion secundaria") ||
    /^lic\.\s+/.test(normalized)
  );
}

function isLikelyBibliographyEntry(name: string): boolean {
  if (shouldHideNode(name)) return false;

  const normalized = normalizeName(name);
  const commaCount = (name.match(/,/g) || []).length;
  const hasYear = /\b(1[89]\d{2}|20\d{2})\b/.test(name);
  const hasEditionFallback = /\bvarias\s+ediciones\b/i.test(name);
  const hasAuthorPrefix = /^[A-ZÁÉÍÓÚÑ][^,]{1,90},/.test(name.trim());

  if (normalized.includes("dgcye | diseno curricular")) return false;
  if (!hasAuthorPrefix) return false;
  if (commaCount < 3) return false;
  if (!hasYear && !hasEditionFallback && commaCount < 4) return false;

  return true;
}

export default function BibliographySelector({
  courseId,
  lessonId,
  selected,
  onChange,
  disabled,
}: BibliographySelectorProps) {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchNodes = async () => {
      setLoading(true);

      const cleanCandidates = (rawNodes: Array<Node & { order_index?: number }>): Node[] => {
        const contentFirst = rawNodes.filter((node) =>
          ["CONTENIDO", "BLOQUE", "UNIDAD"].includes(node.node_type)
        );
        const candidates = contentFirst.length > 0 ? contentFirst : rawNodes;
        const bibliographyOnly = candidates.filter((node) => isLikelyBibliographyEntry(node.name));
        const filtered = (bibliographyOnly.length > 0 ? bibliographyOnly : candidates).filter(
          (node) => !shouldHideNode(node.name)
        );
        const dedupMap = new Map<string, Node>();
        filtered.forEach((node) => {
          const key = `${node.node_type}:${normalizeName(node.name)}`;
          if (!dedupMap.has(key)) dedupMap.set(key, node);
        });
        return Array.from(dedupMap.values());
      };

      const fetchNodesByIds = async (ids: string[]): Promise<Node[]> => {
        const dedupedIds = Array.from(new Set(ids.filter(Boolean)));
        if (dedupedIds.length === 0) return [];

        const { data: nodesData } = await supabase
          .from("curriculum_nodes")
          .select("id, name, node_type, order_index")
          .in("id", dedupedIds)
          .order("order_index");

        return cleanCandidates((nodesData || []) as Array<Node & { order_index?: number }>);
      };

      try {
        const { data: plan } = await supabase.from("plans").select("id").eq("course_id", courseId).single();
        if (!plan) {
          setNodes([]);
          return;
        }

        const nodeIdSources: string[][] = [];

        if (lessonId) {
          const { data: lesson } = await supabase
            .from("lessons")
            .select("plan_lesson_id")
            .eq("id", lessonId)
            .maybeSingle();

          if (lesson?.plan_lesson_id) {
            const { data: links } = await supabase
              .from("plan_lesson_content_links")
              .select("plan_content_mapping_id")
              .eq("plan_lesson_id", lesson.plan_lesson_id);

            const mappingIds = (links || []).map((link) => link.plan_content_mapping_id);
            if (mappingIds.length > 0) {
              const { data: lessonMappings } = await supabase
                .from("plan_content_mappings")
                .select("curriculum_node_id")
                .in("id", mappingIds);

              nodeIdSources.push((lessonMappings || []).map((mapping) => mapping.curriculum_node_id));
            }
          }
        }

        const { data: planMappings } = await supabase
          .from("plan_content_mappings")
          .select("curriculum_node_id")
          .eq("plan_id", plan.id);

        if ((planMappings || []).length > 0) {
          nodeIdSources.push((planMappings || []).map((mapping) => mapping.curriculum_node_id));
        }

        for (const sourceIds of nodeIdSources) {
          const resolved = await fetchNodesByIds(sourceIds);
          if (resolved.length > 0) {
            setNodes(resolved);
            return;
          }
        }

        const { data: courseData, error: courseError } = await supabase
          .from("courses")
          .select("curriculum_document_id")
          .eq("id", courseId)
          .maybeSingle();

        if (!courseError && courseData?.curriculum_document_id) {
          const { data: documentNodes } = await supabase
            .from("curriculum_nodes")
            .select("id, name, node_type, order_index")
            .eq("curriculum_document_id", courseData.curriculum_document_id)
            .order("order_index");

          const fromDocument = cleanCandidates((documentNodes || []) as Array<Node & { order_index?: number }>);
          if (fromDocument.length > 0) {
            setNodes(fromDocument);
            return;
          }
        }

        setNodes([]);
      } finally {
        setLoading(false);
      }
    };

    fetchNodes();
  }, [courseId, lessonId]);

  const toggle = (nodeId: string) => {
    if (disabled) return;

    if (selected.includes(nodeId)) {
      onChange(selected.filter((id) => id !== nodeId));
      return;
    }

    if (selected.length >= 5) return;
    onChange([...selected, nodeId]);
  };

  if (loading) {
    return <p className="text-sm text-muted-foreground">Cargando bibliografia...</p>;
  }

  if (nodes.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No hay fuentes curriculares limpias para esta clase. Revisa mapeos de contenidos en la anual.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <Label>Bibliografia (Modo C) - selecciona 1 a 5 fuentes</Label>
      <div className="max-h-60 space-y-2 overflow-y-auto rounded-md border p-3">
        {nodes.map((node) => (
          <div key={node.id} className="flex items-start gap-2">
            <Checkbox
              checked={selected.includes(node.id)}
              onCheckedChange={() => toggle(node.id)}
              disabled={disabled || (!selected.includes(node.id) && selected.length >= 5)}
            />
            <div className="text-sm">
              <span className="font-medium text-muted-foreground">[{node.node_type}]</span> {node.name}
            </div>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">{selected.length}/5 seleccionadas</p>
    </div>
  );
}
