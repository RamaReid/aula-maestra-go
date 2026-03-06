import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, Copy, Download, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { downloadStructuredPdf } from "@/lib/pdfExport";

interface ReadingMaterialViewProps {
  material: {
    content_html: string;
    word_count: number;
    pdf_url: string | null;
    status: string;
    validation_reasons?: string[];
  };
  pdfBase64?: string | null;
  canExportPdf?: boolean;
  exportFileName?: string;
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

function decodePdfBase64(pdfBase64: string): Blob {
  const byteCharacters = atob(pdfBase64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: "application/pdf" });
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default function ReadingMaterialView({
  material,
  pdfBase64,
  canExportPdf = false,
  exportFileName = "material-lectura.pdf",
}: ReadingMaterialViewProps) {
  const [downloadError, setDownloadError] = useState("");

  const displayHtml = material.content_html
    .replace(/```(?:html|HTML)?\s*/gi, "")
    .replace(/<span\s+data-ref="[^"]*"\s*><\/span>/gi, "")
    .trim();

  const showReasons =
    material.status === "INVALIDATED" &&
    material.validation_reasons &&
    material.validation_reasons.length > 0;
  const exportEnabled = canExportPdf && material.status === "VALIDATED";

  const handleViewTempPdf = () => {
    if (!pdfBase64) return;
    const blob = decodePdfBase64(pdfBase64);
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
  };

  const handleDownloadTempPdf = () => {
    if (!pdfBase64) return;
    downloadBlob(decodePdfBase64(pdfBase64), exportFileName);
  };

  const handleExportHtmlFallback = () => {
    const paragraphs = displayHtml
      .split(/<\/p>/i)
      .map((part) => part.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim())
      .filter(Boolean);

    downloadStructuredPdf({
      title: "Material de Lectura",
      filename: exportFileName,
      sections: [{ body: paragraphs }],
    });
  };

  const extractStoragePath = (url: string): string | null => {
    try {
      const parsed = new URL(url);
      const marker = "/storage/v1/object/public/reading-materials-pdf/";
      const markerIndex = parsed.pathname.indexOf(marker);
      if (markerIndex === -1) return null;
      return decodeURIComponent(parsed.pathname.slice(markerIndex + marker.length));
    } catch {
      return null;
    }
  };

  const downloadFromStorageApi = async () => {
    if (!material.pdf_url) return;
    setDownloadError("");

    const path = extractStoragePath(material.pdf_url);
    if (!path) {
      setDownloadError("No se pudo resolver la ruta del PDF para descarga alternativa.");
      return;
    }

    const { data, error } = await supabase.storage.from("reading-materials-pdf").download(path);
    if (error || !data) {
      setDownloadError(error?.message || "No se pudo descargar el PDF desde la API.");
      return;
    }

    downloadBlob(data, exportFileName);
  };

  const copyPdfLink = async () => {
    if (!material.pdf_url) return;
    setDownloadError("");
    try {
      await navigator.clipboard.writeText(material.pdf_url);
    } catch {
      setDownloadError("No se pudo copiar el enlace al portapapeles.");
    }
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
            <p className="mb-1">El material no paso la validacion despues de 3 intentos:</p>
            <ul className="list-disc pl-4 text-xs space-y-0.5">
              {material.validation_reasons!.map((reason, index) => (
                <li key={index}>{reason}</li>
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

      {exportEnabled && material.pdf_url && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Si tu navegador bloquea el dominio de Supabase (ERR_BLOCKED_BY_CLIENT), usa la descarga alternativa.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline" size="sm" className="text-xs" asChild>
              <a href={material.pdf_url} target="_blank" rel="noopener noreferrer" download>
                <Download className="mr-1 h-3 w-3" />
                Exportar PDF
              </a>
            </Button>
            <Button variant="outline" size="sm" className="text-xs" onClick={downloadFromStorageApi}>
              <Download className="mr-1 h-3 w-3" />
              Descarga alternativa
            </Button>
            <Button variant="outline" size="sm" className="text-xs" onClick={copyPdfLink}>
              <Copy className="mr-1 h-3 w-3" />
              Copiar enlace
            </Button>
          </div>
          {downloadError && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-xs">{downloadError}</AlertDescription>
            </Alert>
          )}
        </div>
      )}

      {exportEnabled && !material.pdf_url && pdfBase64 && (
        <div className="space-y-2">
          <Button variant="outline" size="sm" className="text-xs" onClick={handleDownloadTempPdf}>
            <Download className="mr-1 h-3 w-3" />
            Exportar PDF
          </Button>
        </div>
      )}

      {exportEnabled && !material.pdf_url && !pdfBase64 && (
        <div className="space-y-2">
          <Button variant="outline" size="sm" className="text-xs" onClick={handleExportHtmlFallback}>
            <Download className="mr-1 h-3 w-3" />
            Exportar PDF
          </Button>
        </div>
      )}

      {!exportEnabled && !material.pdf_url && pdfBase64 && (
        <div className="space-y-2">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              Este PDF no se guarda. Actualiza tu plan para almacenamiento permanente.
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
