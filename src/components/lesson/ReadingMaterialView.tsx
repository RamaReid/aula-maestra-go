import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, Printer } from "lucide-react";

interface ReadingMaterialViewProps {
  material: {
    content_html: string;
    word_count: number;
    pdf_url: string | null;
    status: string;
    validation_reasons?: string[];
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

function handlePrintPDF(html: string) {
  const printWindow = window.open("", "_blank");
  if (!printWindow) return;

  printWindow.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Material de Lectura</title>
  <style>
    @media print {
      body { margin: 2cm; }
    }
    body {
      font-family: Georgia, "Times New Roman", serif;
      font-size: 12pt;
      line-height: 1.8;
      max-width: 700px;
      margin: 2rem auto;
      color: #1a1a1a;
    }
    p { margin-bottom: 1em; text-align: justify; }
    span[data-ref] { display: none; }
  </style>
</head>
<body>${html}</body>
</html>`);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => printWindow.print(), 300);
}

export default function ReadingMaterialView({ material }: ReadingMaterialViewProps) {
  const displayHtml = material.content_html
    .replace(/```(?:html|HTML)?\s*/gi, "")
    .replace(/<span\s+data-ref="[^"]*"\s*><\/span>/gi, "")
    .trim();

  const showReasons =
    material.status === "INVALIDATED" &&
    material.validation_reasons &&
    material.validation_reasons.length > 0;

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

      {showReasons && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Material invalidado</AlertTitle>
          <AlertDescription>
            <p className="mb-1">El material no pasó la validación después de 3 intentos:</p>
            <ul className="list-disc pl-4 text-xs space-y-0.5">
              {material.validation_reasons!.map((reason, i) => (
                <li key={i}>{reason}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardContent className="pt-6">
          <div
            className="prose prose-sm max-w-none text-foreground"
            dangerouslySetInnerHTML={{ __html: displayHtml }}
          />
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          onClick={() => handlePrintPDF(material.content_html)}
          className="text-xs"
        >
          <Printer className="mr-1 h-3 w-3" />
          Descargar como PDF
        </Button>

        {material.pdf_url && (
          <a
            href={material.pdf_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-primary underline"
          >
            Ver PDF generado
          </a>
        )}
      </div>
    </div>
  );
}
