import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ReadingMaterialViewProps {
  material: {
    content_html: string;
    word_count: number;
    pdf_url: string | null;
    status: string;
  };
}

const statusLabel: Record<string, string> = {
  GENERATED: "Generado",
  VALIDATED: "Validado",
  INVALIDATED: "Invalidado",
};

const statusVariant = (s: string): "default" | "secondary" | "destructive" => {
  if (s === "VALIDATED") return "default";
  if (s === "INVALIDATED") return "destructive";
  return "secondary";
};

export default function ReadingMaterialView({ material }: ReadingMaterialViewProps) {
  // Clean markdown artifacts and remove data-ref spans for display
  const displayHtml = material.content_html
    .replace(/```(?:html|HTML)?\s*/gi, "")
    .replace(/<span\s+data-ref="[^"]*"\s*><\/span>/gi, "")
    .trim();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Material de Lectura</h3>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{material.word_count} palabras</span>
          <Badge variant={statusVariant(material.status)}>
            {statusLabel[material.status] || material.status}
          </Badge>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div
            className="prose prose-sm max-w-none text-foreground"
            dangerouslySetInnerHTML={{ __html: displayHtml }}
          />
        </CardContent>
      </Card>

      {material.pdf_url && (
        <a
          href={material.pdf_url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-primary underline"
        >
          Descargar PDF
        </a>
      )}
    </div>
  );
}
