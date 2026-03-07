import { useEffect, useState } from "react";

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import type { PlanType } from "@/hooks/useEntitlements";
import { supabase } from "@/integrations/supabase/client";
import { extractBibliographyProtocolNodes, type BibliographyProtocolNode } from "@/lib/bibliographyProtocol";

interface Node extends BibliographyProtocolNode {
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

const AUTHORIZED_SOURCE_TARGETS_TABLE = "authorized_source_targets" as never;
const AUTHORIZED_SOURCES_TABLE = "authorized_sources" as never;
const MAX_SOURCES = 5;

interface BibliographySelectorProps {
  courseId: string;
  lessonId?: string;
  selected: string[];
  onChange: (ids: string[]) => void;
  selectedAuthorized?: string[];
  onAuthorizedChange?: (ids: string[]) => void;
  onSelectionAudit?: (audit: { invalidCurricularIds: string[]; invalidAuthorizedIds: string[] }) => void;
  disabled?: boolean;
  planType?: PlanType;
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
  onSelectionAudit,
  disabled,
  planType = "FREE",
}: BibliographySelectorProps) {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [authorizedSources, setAuthorizedSources] = useState<AuthorizedSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [repairAttempted, setRepairAttempted] = useState(false);
  const totalSelected = selected.length + selectedAuthorized.length;
  const canUseAuthorizedSources = planType === "BASICO" || planType === "PREMIUM";

  useEffect(() => {
    const fetchNodes = async () => {
      setLoading(true);

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

        const bibliographyNodes = extractBibliographyProtocolNodes((documentNodes || []) as Node[]);

        if (bibliographyNodes.length === 0 && !repairAttempted) {
          setRepairAttempted(true);
          const { error: repairError } = await supabase.functions.invoke("repair-curriculum-bibliography", {
            body: { course_id: courseId },
          });

          if (!repairError) {
            const { data: repairedNodes } = await supabase
              .from("curriculum_nodes")
              .select("id, name, node_type, parent_id, order_index")
              .eq("curriculum_document_id", course.curriculum_document_id)
              .order("order_index");

            setNodes(extractBibliographyProtocolNodes((repairedNodes || []) as Node[]));
          } else {
            setNodes([]);
          }
        } else {
          setNodes(bibliographyNodes);
        }

        if (canUseAuthorizedSources && lessonId) {
          const { data: targets, error: targetsError } = await supabase
            .from(AUTHORIZED_SOURCE_TARGETS_TABLE)
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
                .from(AUTHORIZED_SOURCES_TABLE)
                .select("id, title, media_type, origin_type, status")
                .eq("course_id", courseId)
                .in("id", sourceIds)
                .order("created_at", { ascending: false });

              setAuthorizedSources(
                ((sourcesData || []) as AuthorizedSource[]).filter(
                  (source) => source.status === "PROCESSED" || source.status === "APPROVED"
                )
              );
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
  }, [canUseAuthorizedSources, courseId, lessonId, repairAttempted]);

  useEffect(() => {
    onSelectionAudit?.({
      invalidCurricularIds: selected.filter((id) => !nodes.some((node) => node.id === id)),
      invalidAuthorizedIds: selectedAuthorized.filter((id) => !authorizedSources.some((source) => source.id === id)),
    });
  }, [authorizedSources, nodes, onSelectionAudit, selected, selectedAuthorized]);

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
              <p className="text-sm text-muted-foreground">Todavia no hay fuentes del docente procesadas para esta clase.</p>
            )}
          </div>
        </div>
      )}

      <p className="text-xs text-muted-foreground">{totalSelected}/{MAX_SOURCES} seleccionadas</p>
    </div>
  );
}
