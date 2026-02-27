import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, Download, Eye } from "lucide-react";

interface ReadingMaterialViewProps {
  material: {
    content_html: string;
    word_count: number;
    pdf_url: string | null;
    status: string;
    validation_reasons?: string[];
  };
  pdfBase64?: string | null;
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

export default function ReadingMaterialView({ material, pdfBase64 }: ReadingMaterialViewProps) {
  const displayHtml = material.content_html
    .replace(/```(?:html|HTML)?\s*/gi, "")
    .replace(/<span\s+data-ref="[^"]*"\s*><\/span>/gi, "")
    .trim();

  const showReasons =
    material.status === "INVALIDATED" &&
    material.validation_reasons &&
    material.validation_reasons.length > 0;

  const handleViewTempPdf = () => {
    if (!pdfBase64) return;
    const byteCharacters = atob(pdfBase64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
  };

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

      {material.pdf_url && (
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" className="text-xs" asChild>
            <a href={material.pdf_url} target="_blank" rel="noopener noreferrer" download>
              <Download className="mr-1 h-3 w-3" />
              Descargar PDF
            </a>
          </Button>
        </div>
      )}

      {!material.pdf_url && pdfBase64 && (
        <div className="space-y-2">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              Este PDF no se guarda. Actualizá tu plan para almacenamiento permanente.
            </AlertDescription>
          </Alert>
          <Button variant="outline" size="sm" className="text-xs" onClick={handleViewTempPdf}>
            <Eye className="mr-1 h-3 w-3" />
            Ver PDF (temporal)
          </Button>
        </div>
      )}
    </div>
  );
}
