import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { X, Plus } from "lucide-react";

interface Objective {
  id: string;
  description: string;
  order_index: number;
}

interface Props {
  planId: string;
  readOnly: boolean;
  onDirty?: () => Promise<void> | void;
}

export default function PlanObjectivesEditor({ planId, readOnly, onDirty }: Props) {
  const [objectives, setObjectives] = useState<Objective[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchObjectives = useCallback(async () => {
    const { data } = await supabase
      .from("plan_objectives")
      .select("id, description, order_index")
      .eq("plan_id", planId)
      .order("order_index");
    if (data) setObjectives(data);
    setLoading(false);
  }, [planId]);

  useEffect(() => {
    fetchObjectives();
  }, [fetchObjectives]);

  const handleAdd = async () => {
    if (objectives.length >= 8) return;
    await onDirty?.();
    const { data } = await supabase
      .from("plan_objectives")
      .insert({ plan_id: planId, description: "", order_index: objectives.length })
      .select("id, description, order_index")
      .single();
    if (data) setObjectives((prev) => [...prev, data]);
  };

  const handleDelete = async (id: string) => {
    await onDirty?.();
    await supabase.from("plan_objectives").delete().eq("id", id);
    setObjectives((prev) => prev.filter((o) => o.id !== id));
  };

  const handleBlur = async (id: string, description: string) => {
    await onDirty?.();
    await supabase.from("plan_objectives").update({ description }).eq("id", id);
  };

  const handleChange = (id: string, value: string) => {
    setObjectives((prev) =>
      prev.map((o) => (o.id === id ? { ...o, description: value } : o))
    );
  };

  if (loading) return <p className="text-sm text-muted-foreground">Cargando propósitos...</p>;

  const count = objectives.length;
  const valid = count >= 4 && count <= 8;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className={`text-sm font-medium ${valid ? "text-muted-foreground" : "text-destructive"}`}>
          {count}/8 propósitos {count < 4 && "(mínimo 4)"}
        </p>
      </div>

      {objectives.map((obj) => (
        <div key={obj.id} className="flex items-center gap-2">
          <Input
            value={obj.description}
            onChange={(e) => handleChange(obj.id, e.target.value)}
            onBlur={() => handleBlur(obj.id, obj.description)}
            placeholder="Describir propósito..."
            disabled={readOnly}
          />
          {!readOnly && (
            <Button variant="ghost" size="icon" onClick={() => handleDelete(obj.id)}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      ))}

      {!readOnly && (
        <Button variant="outline" size="sm" onClick={handleAdd} disabled={count >= 8}>
          <Plus className="h-4 w-4 mr-1" /> Agregar propósito
        </Button>
      )}
    </div>
  );
}
