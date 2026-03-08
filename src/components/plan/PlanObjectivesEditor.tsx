import { useCallback, useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";

import { StructuredListEditor } from "./StructuredListEditor";

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

    if (data) setObjectives((current) => [...current, data]);
  };

  const handleDelete = async (id: string) => {
    await onDirty?.();
    await supabase.from("plan_objectives").delete().eq("id", id);
    setObjectives((current) => current.filter((objective) => objective.id !== id));
  };

  const handleBlur = async (id: string, description: string) => {
    await onDirty?.();
    await supabase.from("plan_objectives").update({ description }).eq("id", id);
  };

  const handleChange = (id: string, value: string) => {
    setObjectives((current) =>
      current.map((objective) => (objective.id === id ? { ...objective, description: value } : objective))
    );
  };

  if (loading) {
    return <p className="text-sm text-muted-foreground">Cargando objetivos...</p>;
  }

  const count = objectives.length;
  const valid = count >= 6 && count <= 8;

  return (
    <StructuredListEditor
      items={objectives.map((objective) => ({ id: objective.id, value: objective.description }))}
      label="Objetivos del curso"
      itemLabel="Objetivo"
      helper={
        valid
          ? `${count}/8 objetivos cargados. La anual pide entre 6 y 8 objetivos observables.`
          : `${count}/8 objetivos cargados. La anual requiere entre 6 y 8 objetivos observables.`
      }
      addLabel="Agregar objetivo"
      emptyLabel="Todavía no hay objetivos definidos para el curso."
      readOnly={readOnly}
      minItems={6}
      maxItems={8}
      onAdd={handleAdd}
      onDelete={handleDelete}
      onChange={handleChange}
      onBlur={handleBlur}
    />
  );
}
