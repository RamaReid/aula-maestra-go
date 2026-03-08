import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Trash2 } from "lucide-react";

interface StructuredListEditorProps {
  items: Array<{ id: string; value: string }>;
  label: string;
  itemLabel: string;
  helper?: string;
  addLabel: string;
  emptyLabel: string;
  readOnly: boolean;
  maxItems?: number;
  minItems?: number;
  onAdd: () => void;
  onDelete: (id: string) => void;
  onChange: (id: string, value: string) => void;
  onBlur: (id: string, value: string) => void;
}

export function StructuredListEditor({
  items,
  label,
  itemLabel,
  helper,
  addLabel,
  emptyLabel,
  readOnly,
  maxItems = 8,
  minItems = 0,
  onAdd,
  onDelete,
  onChange,
  onBlur,
}: StructuredListEditorProps) {
  const count = items.length;
  const countTone = count < minItems || count > maxItems ? "text-destructive" : "text-muted-foreground";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">{label}</p>
          {helper ? <p className={`text-xs ${countTone}`}>{helper}</p> : null}
        </div>
        {!readOnly ? (
          <Button type="button" variant="outline" size="sm" onClick={onAdd} disabled={count >= maxItems}>
            <Plus className="mr-2 h-4 w-4" />
            {addLabel}
          </Button>
        ) : null}
      </div>

      {items.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-6 text-sm text-muted-foreground">{emptyLabel}</CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map((item, index) => (
            <Card key={item.id}>
              <CardContent className="space-y-3 pt-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-medium text-foreground">
                    {index + 1}. {itemLabel}
                  </p>
                  {!readOnly ? (
                    <Button type="button" variant="ghost" size="icon" onClick={() => onDelete(item.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  ) : null}
                </div>
                <Textarea
                  value={item.value}
                  rows={3}
                  disabled={readOnly}
                  onChange={(event) => onChange(item.id, event.target.value)}
                  onBlur={(event) => onBlur(item.id, event.target.value)}
                />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
