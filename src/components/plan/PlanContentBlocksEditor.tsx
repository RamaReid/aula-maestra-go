import { useCallback, useEffect, useState } from "react";

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
  description: string;
  topics: string[];
  term: number | null;
  order_index: number;
}

interface Props {
  planId: string;
  readOnly: boolean;
  onDirty?: () => Promise<void> | void;
}

function termLabel(term: number | null) {
  if (term === 1) return "Primer cuatrimestre";
  if (term === 2) return "Segundo cuatrimestre";
  return "Anual";
}

export default function PlanContentBlocksEditor({ planId, readOnly, onDirty }: Props) {
  const [blocks, setBlocks] = useState<ContentBlock[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchBlocks = useCallback(async () => {
    const { data } = await supabase
      .from("plan_content_blocks")
      .select("id, title, description, topics, term, order_index")
      .eq("plan_id", planId)
      .order("order_index");

    if (data) setBlocks(data);
    setLoading(false);
  }, [planId]);

  useEffect(() => {
    fetchBlocks();
  }, [fetchBlocks]);

  const persistBlock = async (blockId: string, payload: Partial<ContentBlock>) => {
    if (readOnly) return;
    await onDirty?.();
    await supabase.from("plan_content_blocks").update(payload).eq("id", blockId);
  };

  const updateBlock = (blockId: string, payload: Partial<ContentBlock>) => {
    setBlocks((current) => current.map((block) => (block.id === blockId ? { ...block, ...payload } : block)));
  };

  const handleAddBlock = async () => {
    if (readOnly) return;
    await onDirty?.();
    const { data } = await supabase
      .from("plan_content_blocks")
      .insert({
        plan_id: planId,
        title: `Unidad ${blocks.length + 1}`,
        description: "",
        topics: [""],
        term: blocks.length < 2 ? 1 : 2,
        order_index: blocks.length,
      })
      .select("id, title, description, topics, term, order_index")
      .single();

    if (data) setBlocks((current) => [...current, data]);
  };

  const handleDeleteBlock = async (blockId: string) => {
    if (readOnly) return;
    await onDirty?.();
    await supabase.from("plan_content_blocks").delete().eq("id", blockId);
    setBlocks((current) => current.filter((block) => block.id !== blockId));
  };

  const handleAddTopic = (blockId: string) => {
    const block = blocks.find((item) => item.id === blockId);
    if (!block) return;
    const topics = [...block.topics, ""];
    updateBlock(blockId, { topics });
    void persistBlock(blockId, { topics });
  };

  const handleRemoveTopic = (blockId: string, topicIndex: number) => {
    const block = blocks.find((item) => item.id === blockId);
    if (!block) return;
    const topics = block.topics.filter((_, index) => index !== topicIndex);
    updateBlock(blockId, { topics });
    void persistBlock(blockId, { topics });
  };

  const handleTopicChange = (blockId: string, topicIndex: number, value: string) => {
    const block = blocks.find((item) => item.id === blockId);
    if (!block) return;
    const topics = [...block.topics];
    topics[topicIndex] = value;
    updateBlock(blockId, { topics });
  };

  const handleTopicBlur = async (blockId: string) => {
    const block = blocks.find((item) => item.id === blockId);
    if (!block) return;
    await persistBlock(blockId, { topics: block.topics });
  };

  if (loading) {
    return <p className="text-sm text-muted-foreground">Cargando bloques de contenido...</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">Bloques, unidades o ejes del año</p>
          <p className="text-xs text-muted-foreground">
            Cada bloque organiza un tramo de la anual con una breve descripción y un punteo de temas que luego bajan a clases.
          </p>
        </div>
        {!readOnly ? (
          <Button type="button" variant="outline" size="sm" onClick={handleAddBlock}>
            <Plus className="mr-2 h-4 w-4" />
            Agregar bloque
          </Button>
        ) : null}
      </div>

      {blocks.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-6 text-sm text-muted-foreground">
            Todavía no hay bloques cargados. Revisa el borrador curricular o agrega una unidad manualmente.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {blocks.map((block, index) => (
            <Card key={block.id}>
              <CardContent className="space-y-4 pt-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {index + 1}. {termLabel(block.term)}
                    </p>
                    <p className="text-xs text-muted-foreground">Este bloque estructura el contenido anual antes de bajar a clases.</p>
                  </div>
                  {!readOnly ? (
                    <Button type="button" variant="ghost" size="icon" onClick={() => handleDeleteBlock(block.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <Label>Título del bloque</Label>
                  <Input
                    value={block.title}
                    disabled={readOnly}
                    onChange={(event) => updateBlock(block.id, { title: event.target.value })}
                    onBlur={(event) => persistBlock(block.id, { title: event.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Descripción breve</Label>
                  <Textarea
                    value={block.description}
                    rows={3}
                    disabled={readOnly}
                    onChange={(event) => updateBlock(block.id, { description: event.target.value })}
                    onBlur={(event) => persistBlock(block.id, { description: event.target.value })}
                  />
                </div>

                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Label>Temas a tratar en este bloque</Label>
                    {!readOnly ? (
                      <Button type="button" variant="ghost" size="sm" onClick={() => handleAddTopic(block.id)}>
                        <Plus className="mr-2 h-4 w-4" />
                        Agregar tema
                      </Button>
                    ) : null}
                  </div>
                  <div className="space-y-2">
                    {block.topics.map((topic, topicIndex) => (
                      <div key={`${block.id}-${topicIndex}`} className="flex items-center gap-2">
                        <Input
                          value={topic}
                          disabled={readOnly}
                          onChange={(event) => handleTopicChange(block.id, topicIndex, event.target.value)}
                          onBlur={() => handleTopicBlur(block.id)}
                          placeholder={`Tema ${topicIndex + 1}`}
                        />
                        {!readOnly && block.topics.length > 1 ? (
                          <Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveTopic(block.id, topicIndex)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
