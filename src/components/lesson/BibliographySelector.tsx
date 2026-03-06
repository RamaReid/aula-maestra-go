import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import type { PlanType } from "@/hooks/useEntitlements";

interface Node {
  id: string;
  name: string;
  node_type: string;
}

interface AuthorizedSource {
  id: string;
  title: string;
  media_type: string;
  origin_type: string;
  status: string;
}

interface BibliographySelectorProps {
  courseId: string;
  lessonId?: string;
  selected: string[];
  onChange: (ids: string[]) => void;
  selectedAuthorized?: string[];
  onAuthorizedChange?: (ids: string[]) => void;
  disabled?: boolean;
  planType?: PlanType;
}

const MAX_SOURCES = 5;

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

function mapMediaLabel(mediaType: string): string {
  const normalized = (mediaType || "").toUpperCase();
  if (normalized === "DOC") return "DOC/DOCX";
  if (normalized === "SHEET") return "XLS/XLSX";
  return normalized || "ARCHIVO";
}

export default function BibliographySelector({
  courseId,
  lessonId,
  selected,
  onChange,
  selectedAuthorized = [],
  onAuthorizedChange,
  disabled,
  planType = "FREE",
}: BibliographySelectorProps) {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [authorizedSources, setAuthorizedSources] = useState<AuthorizedSource[]>([]);
  const [loading, setLoading] = useState(true);
  const totalSelected = selected.length + selectedAuthorized.length;
  const canUseAuthorizedSources = planType === "BASICO" || planType === "PREMIUM";

  useEffect(() => {
    const fetchNodes = async () => {
      setLoading(true);

      const cleanCandidates = (rawNodes: Array<Node & { order_index?: number }>): Node[] => {
        const contentFirst = rawNodes.filter((node) => ["CONTENIDO", "BLOQUE", "UNIDAD"].includes(node.node_type));
        const candidates = contentFirst.length > 0 ? contentFirst : rawNodes;
        const bibliographyOnly = candidates.filter((node) => isLikelyBibliographyEntry(node.name));
        const filtered = bibliographyOnly.filter((node) => !shouldHideNode(node.name));
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
          setAuthorizedSources([]);
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

        let resolvedCurriculumNodes: Node[] = [];
        for (const sourceIds of nodeIdSources) {
          const resolved = await fetchNodesByIds(sourceIds);
          if (resolved.length > 0) {
            resolvedCurriculumNodes = resolved;
            break;
          }
        }

        if (resolvedCurriculumNodes.length === 0) {
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

            resolvedCurriculumNodes = cleanCandidates((documentNodes || []) as Array<Node & { order_index?: number }>);
          }
        }

        setNodes(resolvedCurriculumNodes);

        if (canUseAuthorizedSources && lessonId) {
          const { data: targets, error: targetsError } = await supabase
            .from("authorized_source_targets" as any)
            .select("source_id")
            .eq("lesson_id", lessonId);

          if (targetsError) {
            setAuthorizedSources([]);
          } else {
            const sourceIds = Array.from(
              new Set(((targets || []) as Array<{ source_id: string }>).map((target) => target.source_id))
            );
            if (sourceIds.length === 0) {
              setAuthorizedSources([]);
            } else {
              const { data: sourcesData } = await supabase
                .from("authorized_sources" as any)
                .select("id, title, media_type, origin_type, status")
                .eq("course_id", courseId)
                .in("id", sourceIds)
                .order("created_at", { ascending: false });

              const processed = ((sourcesData || []) as AuthorizedSource[]).filter(
                (source) => source.status === "PROCESSED" || source.status === "APPROVED"
              );
              setAuthorizedSources(processed);
            }
          }
        } else {
          setAuthorizedSources([]);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchNodes();
  }, [courseId, lessonId, canUseAuthorizedSources]);

  const toggleCurriculum = (nodeId: string) => {
    if (disabled) return;

    if (selected.includes(nodeId)) {
      onChange(selected.filter((id) => id !== nodeId));
      return;
    }

    if (totalSelected >= MAX_SOURCES) return;
    onChange([...selected, nodeId]);
  };

  const toggleAuthorized = (sourceId: string) => {
    if (disabled || !onAuthorizedChange) return;

    if (selectedAuthorized.includes(sourceId)) {
      onAuthorizedChange(selectedAuthorized.filter((id) => id !== sourceId));
      return;
    }

    if (totalSelected >= MAX_SOURCES) return;
    onAuthorizedChange([...selectedAuthorized, sourceId]);
  };

  if (loading) {
    return <p className="text-sm text-muted-foreground">Cargando fuentes...</p>;
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Fuentes curriculares y del docente - selecciona 1 a 5</Label>
        <div className="max-h-60 space-y-2 overflow-y-auto rounded-md border p-3">
          {nodes.length > 0 ? (
            nodes.map((node) => (
              <div key={node.id} className="flex items-start gap-2">
                <Checkbox
                  checked={selected.includes(node.id)}
                  onCheckedChange={() => toggleCurriculum(node.id)}
                  disabled={disabled || (!selected.includes(node.id) && totalSelected >= MAX_SOURCES)}
                />
                <div className="text-sm">
                  <span className="font-medium text-muted-foreground">[CURRICULAR]</span> {node.name}
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">
              No hay fuentes curriculares limpias para esta clase. Revisa mapeos de contenidos en la anual.
            </p>
          )}
        </div>
      </div>

      {canUseAuthorizedSources && (
        <div className="space-y-2">
          <Label>Fuentes del docente disponibles para esta clase</Label>
          <div className="max-h-60 space-y-2 overflow-y-auto rounded-md border p-3">
            {authorizedSources.length > 0 ? (
              authorizedSources.map((source) => (
                <div key={source.id} className="flex items-start gap-2">
                  <Checkbox
                    checked={selectedAuthorized.includes(source.id)}
                    onCheckedChange={() => toggleAuthorized(source.id)}
                    disabled={disabled || (!selectedAuthorized.includes(source.id) && totalSelected >= MAX_SOURCES)}
                  />
                  <div className="text-sm">
                    <span className="font-medium text-muted-foreground">
                      [DOCENTE/{mapMediaLabel(source.media_type)}]
                    </span>{" "}
                    {source.title}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">
                Todavia no hay fuentes del docente procesadas para esta clase.
              </p>
            )}
          </div>
        </div>
      )}

      <p className="text-xs text-muted-foreground">{totalSelected}/{MAX_SOURCES} seleccionadas</p>
    </div>
  );
}
