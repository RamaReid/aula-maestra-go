import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import type { PlanType } from "@/hooks/useEntitlements";

interface Node {
  id: string;
  name: string;
  node_type: string;
  parent_id: string | null;
  order_index?: number;
}

interface AuthorizedSource {
  id: string;
  title: string;
  media_type: string;
  origin_type: string;
  status: string;
}

type AuthorizedSourceTarget = {
  source_id: string;
};

const AUTHORIZED_SOURCE_TARGETS_TABLE = "authorized_source_targets" as never;
const AUTHORIZED_SOURCES_TABLE = "authorized_sources" as never;

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

function isBibliographyHeading(name: string): boolean {
  const normalized = normalizeName(name);
  return (
    normalized.includes("bibliografia") ||
    normalized.includes("bibliografica") ||
    normalized.includes("fuentes bibliograficas")
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

      const cleanCandidates = (rawNodes: Node[]): Node[] => {
        const childrenByParent = new Map<string, Node[]>();
        rawNodes.forEach((node) => {
          if (!node.parent_id) return;
          const current = childrenByParent.get(node.parent_id) || [];
          current.push(node);
          childrenByParent.set(node.parent_id, current);
        });

        const bibliographyRootIds = rawNodes
          .filter((node) => isBibliographyHeading(node.name))
          .map((node) => node.id);

        const bibliographyDescendantIds = new Set<string>();
        const queue = [...bibliographyRootIds];
        while (queue.length > 0) {
          const parentId = queue.shift()!;
          const children = childrenByParent.get(parentId) || [];
          children.forEach((child) => {
            bibliographyDescendantIds.add(child.id);
            queue.push(child.id);
          });
        }

        const subtreeBibliography = rawNodes.filter(
          (node) =>
            bibliographyDescendantIds.has(node.id) &&
            node.node_type === "CONTENIDO" &&
            !shouldHideNode(node.name)
        );
        const bibliographyOnly =
          subtreeBibliography.length > 0
            ? subtreeBibliography
            : rawNodes.filter(
                (node) =>
                  node.node_type === "CONTENIDO" &&
                  isLikelyBibliographyEntry(node.name) &&
                  !shouldHideNode(node.name)
              );

        const dedupMap = new Map<string, Node>();
        bibliographyOnly.forEach((node) => {
          const key = normalizeName(node.name);
          if (!dedupMap.has(key)) dedupMap.set(key, node);
        });
        return Array.from(dedupMap.values()).sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
      };

      try {
        const { data: course } = await supabase
          .from("courses")
          .select("curriculum_document_id")
          .eq("id", courseId)
          .maybeSingle();

        if (!course?.curriculum_document_id) {
          setNodes([]);
          setAuthorizedSources([]);
          return;
        }

        const { data: documentNodes } = await supabase
          .from("curriculum_nodes")
          .select("id, name, node_type, parent_id, order_index")
          .eq("curriculum_document_id", course.curriculum_document_id)
          .order("order_index");

        const resolvedCurriculumNodes = cleanCandidates((documentNodes || []) as Node[]);

        setNodes(resolvedCurriculumNodes);

        if (canUseAuthorizedSources && lessonId) {
          const { data: targets, error: targetsError } = await supabase
            .from(AUTHORIZED_SOURCE_TARGETS_TABLE)
            .select("source_id")
            .eq("lesson_id", lessonId);

          if (targetsError) {
            setAuthorizedSources([]);
          } else {
            const sourceIds = Array.from(
              new Set(((targets || []) as unknown as Array<{ source_id: string }>).map((target) => target.source_id))
            );
            if (sourceIds.length === 0) {
              setAuthorizedSources([]);
            } else {
              const { data: sourcesData } = await supabase
                .from(AUTHORIZED_SOURCES_TABLE)
                .select("id, title, media_type, origin_type, status")
                .eq("course_id", courseId)
                .in("id", sourceIds)
                .order("created_at", { ascending: false });

              const processed = ((sourcesData || []) as unknown as AuthorizedSource[]).filter(
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
                  <span className="font-medium text-muted-foreground">[BIBLIOGRAFIA]</span> {node.name}
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">
              No se encontro bibliografia extraida del diseno curricular. Revisa la importacion del documento o vuelve a sincronizar el programa.
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
