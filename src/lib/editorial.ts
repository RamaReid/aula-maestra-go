export interface DocumentMetaItem {
  label: string;
  value?: string | number | null;
}

export function formatDocumentDate(value?: string | Date | null) {
  const date =
    value instanceof Date
      ? value
      : value
        ? new Date(value)
        : new Date();

  if (Number.isNaN(date.getTime())) {
    return "Fecha no disponible";
  }

  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}

export function filterDocumentMeta(items: DocumentMetaItem[]) {
  return items.filter((item) => {
    const value = item.value;
    if (value === null || value === undefined) return false;
    if (typeof value === "string" && value.trim().length === 0) return false;
    return true;
  });
}

export function stripHtmlToParagraphs(html: string) {
  return html
    .split(/<\/p>|<br\s*\/?>/i)
    .map((part) => part.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim())
    .filter(Boolean);
}
