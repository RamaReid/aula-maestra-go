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
  selected: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
}

export default function BibliographySelector({
  courseId,
  selected,
  onChange,
  disabled,
}: BibliographySelectorProps) {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchNodes = async () => {
      const { data: plan } = await supabase.from("plans").select("id").eq("course_id", courseId).single();

      if (!plan) {
        setLoading(false);
        return;
      }

      const { data: mappings } = await supabase
        .from("plan_content_mappings")
        .select("curriculum_node_id")
        .eq("plan_id", plan.id);

      if (!mappings || mappings.length === 0) {
        setLoading(false);
        return;
      }

      const nodeIds = mappings.map((mapping) => mapping.curriculum_node_id);
      const { data: nodesData } = await supabase
        .from("curriculum_nodes")
        .select("id, name, node_type")
        .in("id", nodeIds)
        .order("order_index");

      setNodes(nodesData || []);
      setLoading(false);
    };

    fetchNodes();
  }, [courseId]);

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
    return <p className="text-sm text-muted-foreground">No hay contenidos curriculares mapeados en el plan.</p>;
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
