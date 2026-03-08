import { useCallback, useEffect, useMemo, useState } from "react";

import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";

interface ContentBlock {
  id: string;
  title: string;
  term: number | null;
  order_index: number;
}

interface RubricRow {
  id: string;
  content_block_id: string;
  criterion_name: string;
  focus_note: string;
  advanced_level: string;
  expected_level: string;
  basic_level: string;
  initial_level: string;
  order_index: number;
}

interface Props {
  planId: string;
  readOnly: boolean;
  onDirty?: () => Promise<void> | void;
}

export default function PlanRubricsEditor({ planId, readOnly, onDirty }: Props) {
  const [blocks, setBlocks] = useState<ContentBlock[]>([]);
  const [rows, setRows] = useState<RubricRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    const [{ data: contentBlocks }, { data: rubricRows }, { data: mappedNodes }] = await Promise.all([
      supabase
        .from("plan_content_blocks")
        .select("id, title, term, order_index")
        .eq("plan_id", planId)
        .order("order_index"),
      supabase
        .from("plan_rubrics")
        .select(
          "id, content_block_id, criterion_name, focus_note, advanced_level, expected_level, basic_level, initial_level, order_index"
        )
        .eq("plan_id", planId)
        .order("order_index"),
      supabase
        .from("plan_content_mappings")
        .select("id, curriculum_node_id, order_index, curriculum_nodes(name, node_type)")
        .eq("plan_id", planId)
        .order("order_index"),
    ]);

    // Use plan_content_blocks if available, otherwise synthesize from mapped curriculum nodes
    let resolvedBlocks: ContentBlock[] = contentBlocks || [];
    if (resolvedBlocks.length === 0 && mappedNodes && mappedNodes.length > 0) {
      const unitNodes = mappedNodes.filter((m: any) => {
        const nt = (m.curriculum_nodes as any)?.node_type;
        return nt === "EJE" || nt === "UNIDAD" || nt === "BLOQUE";
      });
      if (unitNodes.length > 0) {
        resolvedBlocks = unitNodes.map((m: any, idx: number) => ({
          id: m.id,
          title: (m.curriculum_nodes as any)?.name || `Bloque ${idx + 1}`,
          term: null,
          order_index: m.order_index ?? idx,
        }));
      }
    }

    setBlocks(resolvedBlocks);
    setRows(rubricRows || []);
    setLoading(false);
  }, [planId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const rowsByBlock = useMemo(
    () =>
      blocks.map((block) => ({
        block,
        rows: rows.filter((row) => row.content_block_id === block.id).sort((left, right) => left.order_index - right.order_index),
      })),
    [blocks, rows]
  );

  const persistRow = async (rowId: string, payload: Partial<RubricRow>) => {
    if (readOnly) return;
    await onDirty?.();
    await supabase.from("plan_rubrics").update(payload).eq("id", rowId);
  };

  const updateRow = (rowId: string, payload: Partial<RubricRow>) => {
    setRows((current) => current.map((row) => (row.id === rowId ? { ...row, ...payload } : row)));
  };

  const handleAddRow = async (contentBlockId: string) => {
    if (readOnly) return;
    await onDirty?.();
    const orderIndex = rows.filter((row) => row.content_block_id === contentBlockId).length;
    const { data } = await supabase
      .from("plan_rubrics")
      .insert({
        plan_id: planId,
        content_block_id: contentBlockId,
        criterion_name: "",
        focus_note: "",
        advanced_level: "",
        expected_level: "",
        basic_level: "",
        initial_level: "",
        order_index: orderIndex,
      })
      .select(
        "id, content_block_id, criterion_name, focus_note, advanced_level, expected_level, basic_level, initial_level, order_index"
      )
      .single();

    if (data) setRows((current) => [...current, data]);
  };

  const handleDeleteRow = async (rowId: string) => {
    if (readOnly) return;
    await onDirty?.();
    await supabase.from("plan_rubrics").delete().eq("id", rowId);
    setRows((current) => current.filter((row) => row.id !== rowId));
  };

  if (loading) {
    return <p className="text-sm text-muted-foreground">Cargando rúbricas...</p>;
  }

  if (blocks.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-6 text-sm text-muted-foreground">
          Primero define bloques de contenido para poder articular la rúbrica anual con cada unidad o eje.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">Rúbrica por bloque</p>
        <p className="text-xs text-muted-foreground">
          Cada fila de rúbrica deja visible qué se observa en el bloque y cómo se diferencia el desempeño alcanzado.
        </p>
      </div>

      {rowsByBlock.map(({ block, rows: blockRows }) => (
        <Card key={block.id}>
          <CardContent className="space-y-4 pt-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-foreground">{block.title}</p>
                <p className="text-xs text-muted-foreground">
                  {block.term === 1 ? "Primer cuatrimestre" : block.term === 2 ? "Segundo cuatrimestre" : "Bloque anual"}
                </p>
              </div>
              {!readOnly ? (
                <Button type="button" variant="outline" size="sm" onClick={() => handleAddRow(block.id)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Agregar fila
                </Button>
              ) : null}
            </div>

            {blockRows.length === 0 ? (
              <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                Este bloque todavía no tiene filas de rúbrica cargadas.
              </div>
            ) : (
              <div className="space-y-4">
                {blockRows.map((row, index) => (
                  <Card key={row.id} className="border-l-4 border-l-primary/35">
                    <CardContent className="space-y-4 pt-4">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm font-medium text-foreground">Fila {index + 1}</p>
                        {!readOnly ? (
                          <Button type="button" variant="ghost" size="icon" onClick={() => handleDeleteRow(row.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        ) : null}
                      </div>

                      <div className="space-y-2">
                        <Label>Criterio</Label>
                        <Input
                          value={row.criterion_name}
                          disabled={readOnly}
                          onChange={(event) => updateRow(row.id, { criterion_name: event.target.value })}
                          onBlur={(event) => persistRow(row.id, { criterion_name: event.target.value })}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Foco observable</Label>
                        <Textarea
                          value={row.focus_note}
                          rows={2}
                          disabled={readOnly}
                          onChange={(event) => updateRow(row.id, { focus_note: event.target.value })}
                          onBlur={(event) => persistRow(row.id, { focus_note: event.target.value })}
                        />
                      </div>

                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label>Avanzado</Label>
                          <Textarea
                            value={row.advanced_level}
                            rows={3}
                            disabled={readOnly}
                            onChange={(event) => updateRow(row.id, { advanced_level: event.target.value })}
                            onBlur={(event) => persistRow(row.id, { advanced_level: event.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Esperado</Label>
                          <Textarea
                            value={row.expected_level}
                            rows={3}
                            disabled={readOnly}
                            onChange={(event) => updateRow(row.id, { expected_level: event.target.value })}
                            onBlur={(event) => persistRow(row.id, { expected_level: event.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Básico</Label>
                          <Textarea
                            value={row.basic_level}
                            rows={3}
                            disabled={readOnly}
                            onChange={(event) => updateRow(row.id, { basic_level: event.target.value })}
                            onBlur={(event) => persistRow(row.id, { basic_level: event.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Inicial</Label>
                          <Textarea
                            value={row.initial_level}
                            rows={3}
                            disabled={readOnly}
                            onChange={(event) => updateRow(row.id, { initial_level: event.target.value })}
                            onBlur={(event) => persistRow(row.id, { initial_level: event.target.value })}
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
