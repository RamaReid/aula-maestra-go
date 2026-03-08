import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, Copy, Download, Eye } from "lucide-react";
import { DocumentSheet } from "@/components/editorial/DocumentSheet";
import { supabase } from "@/integrations/supabase/client";
import { downloadStructuredPdf } from "@/lib/pdfExport";
import { formatDocumentDate, stripHtmlToParagraphs, type DocumentMetaItem } from "@/lib/editorial";

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
  documentTitle?: string;
  documentSummary?: string;
  documentMeta?: DocumentMetaItem[];
  generatedAt?: string | null;
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
  documentTitle = "Material de lectura",
  documentSummary = "Texto de apoyo preparado para lectura real, con jerarquía de lectura y formato de documento listo para compartir.",
  documentMeta = [],
  generatedAt,
}: ReadingMaterialViewProps) {
  const [downloadError, setDownloadError] = useState("");

  const displayHtml = material.content_html
    .replace(/```(?:html|HTML)?\s*/gi, "")
    .replace(/<span\s+data-ref="[^"]*"\s*><\/span>/gi, "")
    .trim();
  const paragraphs = stripHtmlToParagraphs(displayHtml);

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
    downloadStructuredPdf({
      title: documentTitle,
      subtitle: documentSummary,
      filename: exportFileName,
      generatedAt: formatDocumentDate(generatedAt),
      meta: [
        ...documentMeta,
        { label: "Estado", value: statusLabel[material.status] || material.status },
        { label: "Extension", value: `${material.word_count} palabras` },
      ]
        .filter((item) => item.value)
        .map((item) => ({ label: item.label, value: String(item.value) })),
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

  const exportActions = (
    <>
      {exportEnabled && material.pdf_url ? (
        <>
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
        </>
      ) : null}
      {exportEnabled && !material.pdf_url && pdfBase64 ? (
        <Button variant="outline" size="sm" className="text-xs" onClick={handleDownloadTempPdf}>
          <Download className="mr-1 h-3 w-3" />
          Exportar PDF
        </Button>
      ) : null}
      {exportEnabled && !material.pdf_url && !pdfBase64 ? (
        <Button variant="outline" size="sm" className="text-xs" onClick={handleExportHtmlFallback}>
          <Download className="mr-1 h-3 w-3" />
          Exportar PDF
        </Button>
      ) : null}
      {!exportEnabled && !material.pdf_url && pdfBase64 ? (
        <Button variant="outline" size="sm" className="text-xs" onClick={handleViewTempPdf}>
          <Eye className="mr-1 h-3 w-3" />
          Ver PDF temporal
        </Button>
      ) : null}
    </>
  );

  return (
    <DocumentSheet
      eyebrow="Lectura"
      title={documentTitle}
      summary={documentSummary}
      status={<Badge variant={statusVariant(material.status)}>{statusLabel[material.status] || material.status}</Badge>}
      actions={exportActions}
      meta={[
        ...documentMeta,
        { label: "Extension", value: `${material.word_count} palabras` },
        { label: "Fecha", value: formatDocumentDate(generatedAt) },
      ]}
    >
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

      <section className="document-section">
        <p className="document-section-label">Vista previa editorial</p>
        <div
          className="editorial-prose"
          dangerouslySetInnerHTML={{ __html: displayHtml }}
        />
      </section>

      {exportEnabled && material.pdf_url && (
        <p className="helper-note">
          Si tu navegador bloquea el dominio de Supabase (`ERR_BLOCKED_BY_CLIENT`), usa la descarga alternativa.
        </p>
      )}

      {downloadError && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="text-xs">{downloadError}</AlertDescription>
        </Alert>
      )}

      {!exportEnabled && !material.pdf_url && pdfBase64 && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="text-xs">
            Este PDF no se guarda. Actualiza tu plan para almacenamiento permanente.
          </AlertDescription>
        </Alert>
      )}

      {paragraphs.length === 0 && (
        <div className="helper-note">
          El sistema no pudo componer una vista legible del texto. Usa la exportación PDF para revisar la salida completa.
        </div>
      )}

    </DocumentSheet>
  );
}
