import { useCallback, useEffect, useState } from "react";

import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";

interface Entry {
  id: string;
  citation: string;
  usage_notes: string;
  order_index: number;
}

interface Props {
  planId: string;
  readOnly: boolean;
  onDirty?: () => Promise<void> | void;
}

export default function PlanTeacherBibliographyEditor({ planId, readOnly, onDirty }: Props) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEntries = useCallback(async () => {
    const { data } = await supabase
      .from("plan_teacher_bibliography_entries")
      .select("id, citation, usage_notes, order_index")
      .eq("plan_id", planId)
      .order("order_index");

    if (data) setEntries(data);
    setLoading(false);
  }, [planId]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const persistEntry = async (entryId: string, payload: Partial<Entry>) => {
    if (readOnly) return;
    await onDirty?.();
    await supabase.from("plan_teacher_bibliography_entries").update(payload).eq("id", entryId);
  };

  const updateEntry = (entryId: string, payload: Partial<Entry>) => {
    setEntries((current) => current.map((entry) => (entry.id === entryId ? { ...entry, ...payload } : entry)));
  };

  const handleAdd = async () => {
    if (readOnly) return;
    await onDirty?.();
    const { data } = await supabase
      .from("plan_teacher_bibliography_entries")
      .insert({
        plan_id: planId,
        citation: "",
        usage_notes: "",
        order_index: entries.length,
      })
      .select("id, citation, usage_notes, order_index")
      .single();

    if (data) setEntries((current) => [...current, data]);
  };

  const handleDelete = async (entryId: string) => {
    if (readOnly) return;
    await onDirty?.();
    await supabase.from("plan_teacher_bibliography_entries").delete().eq("id", entryId);
    setEntries((current) => current.filter((entry) => entry.id !== entryId));
  };

  if (loading) {
    return <p className="text-sm text-muted-foreground">Cargando bibliografía del curso...</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">Bibliografía del curso</p>
          <p className="text-xs text-muted-foreground">
            Registra las obras, autores o materiales que el docente incorpora como base propia para sostener la anual.
          </p>
        </div>
        {!readOnly ? (
          <Button type="button" variant="outline" size="sm" onClick={handleAdd}>
            <Plus className="mr-2 h-4 w-4" />
            Agregar referencia
          </Button>
        ) : null}
      </div>

      {entries.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-6 text-sm text-muted-foreground">
            Todavía no hay bibliografía propia cargada para este curso.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {entries.map((entry, index) => (
            <Card key={entry.id}>
              <CardContent className="space-y-4 pt-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-medium text-foreground">Referencia {index + 1}</p>
                  {!readOnly ? (
                    <Button type="button" variant="ghost" size="icon" onClick={() => handleDelete(entry.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <Label>Cita o referencia</Label>
                  <Input
                    value={entry.citation}
                    disabled={readOnly}
                    onChange={(event) => updateEntry(entry.id, { citation: event.target.value })}
                    onBlur={(event) => persistEntry(entry.id, { citation: event.target.value })}
                    placeholder="Autor, título, editorial o fuente"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Cómo se usará en el curso</Label>
                  <Textarea
                    value={entry.usage_notes}
                    rows={3}
                    disabled={readOnly}
                    onChange={(event) => updateEntry(entry.id, { usage_notes: event.target.value })}
                    onBlur={(event) => persistEntry(entry.id, { usage_notes: event.target.value })}
                    placeholder="Indica para qué unidad, bloque o tipo de trabajo servirá esta referencia."
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
