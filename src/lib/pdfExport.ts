type PdfLine = {
  text: string;
  fontSize: number;
  bold?: boolean;
};

type PdfSection = {
  title?: string;
  body: string[];
};

type PdfMetaItem = {
  label: string;
  value: string;
};

interface ExportPdfOptions {
  title: string;
  filename: string;
  sections: PdfSection[];
  subtitle?: string;
  meta?: PdfMetaItem[];
  generatedAt?: string;
  footerNote?: string;
}

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 54;
const BODY_FONT_SIZE = 11.5;
const TITLE_FONT_SIZE = 22;
const SUBTITLE_FONT_SIZE = 12.5;
const META_LABEL_FONT_SIZE = 8.5;
const META_VALUE_FONT_SIZE = 10;
const SECTION_TITLE_FONT_SIZE = 13.5;
const FOOTER_FONT_SIZE = 8.5;
const LINE_HEIGHT_FACTOR = 1.48;
const MAX_TEXT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const CHAR_WIDTH_FACTOR = 0.52;

function escapePdfText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, " ")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/\r?\n/g, " ");
}

function chunkText(text: string, fontSize: number): string[] {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return [];

  const words = normalized.split(" ");
  const lines: string[] = [];
  let current = "";
  const maxCharsPerLine = Math.max(24, Math.floor(MAX_TEXT_WIDTH / (fontSize * CHAR_WIDTH_FACTOR)));

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxCharsPerLine && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }

  if (current) lines.push(current);
  return lines;
}

function pushWrappedLine(lines: PdfLine[], text: string, fontSize: number, bold = false) {
  for (const chunk of chunkText(text, fontSize)) {
    lines.push({ text: chunk, fontSize, bold });
  }
}

function buildLines({ title, subtitle, meta = [], generatedAt, footerNote, sections }: ExportPdfOptions): PdfLine[] {
  const lines: PdfLine[] = [];

  pushWrappedLine(lines, title, TITLE_FONT_SIZE, true);
  if (subtitle) {
    pushWrappedLine(lines, subtitle, SUBTITLE_FONT_SIZE);
  }

  const createdAtLabel = generatedAt ? `Emitido: ${generatedAt}` : "";
  if (createdAtLabel) {
    pushWrappedLine(lines, createdAtLabel, META_VALUE_FONT_SIZE);
  }

  if (meta.length > 0) {
    lines.push({ text: "", fontSize: BODY_FONT_SIZE });
    for (const item of meta) {
      pushWrappedLine(lines, item.label.toUpperCase(), META_LABEL_FONT_SIZE, true);
      pushWrappedLine(lines, item.value, META_VALUE_FONT_SIZE);
    }
  }

  if (footerNote) {
    lines.push({ text: "", fontSize: BODY_FONT_SIZE });
    pushWrappedLine(lines, footerNote, BODY_FONT_SIZE);
  }

  lines.push({ text: "", fontSize: BODY_FONT_SIZE });

  for (const section of sections) {
    if (section.title) {
      pushWrappedLine(lines, section.title, SECTION_TITLE_FONT_SIZE, true);
    }

    for (const paragraph of section.body) {
      pushWrappedLine(lines, paragraph, BODY_FONT_SIZE, false);
      lines.push({ text: "", fontSize: BODY_FONT_SIZE });
    }
  }

  return lines;
}

function paginateLines(lines: PdfLine[]): PdfLine[][] {
  const pages: PdfLine[][] = [];
  let currentPage: PdfLine[] = [];
  let cursorY = PAGE_HEIGHT - MARGIN;

  for (const line of lines) {
    const lineHeight = (line.fontSize || BODY_FONT_SIZE) * LINE_HEIGHT_FACTOR;

    if (cursorY - lineHeight < MARGIN) {
      pages.push(currentPage);
      currentPage = [];
      cursorY = PAGE_HEIGHT - MARGIN;
    }

    currentPage.push(line);
    cursorY -= lineHeight;
  }

  if (currentPage.length > 0) {
    pages.push(currentPage);
  }

  return pages;
}

function buildPdfBytes(pages: PdfLine[][], footerLabel?: string): Uint8Array {
  const objects: string[] = [];
  const addObject = (content: string) => {
    objects.push(content);
    return objects.length;
  };

  const catalogId = addObject("");
  const pagesId = addObject("");
  const fontRegularId = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  const fontBoldId = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");

  const pageObjectIds: number[] = [];

  const totalPages = pages.length;

  for (const [pageIndex, pageLines] of pages.entries()) {
    let y = PAGE_HEIGHT - MARGIN;
    const operations: string[] = [];

    for (const line of pageLines) {
      const fontSize = line.fontSize || BODY_FONT_SIZE;
      const lineHeight = fontSize * LINE_HEIGHT_FACTOR;

      if (line.text.trim().length > 0) {
        const fontName = line.bold ? "/F2" : "/F1";
        operations.push(
          `BT ${fontName} ${fontSize} Tf 1 0 0 1 ${MARGIN} ${y.toFixed(2)} Tm (${escapePdfText(line.text)}) Tj ET`
        );
      }

      y -= lineHeight;
    }

    const footerText = `${footerLabel || ""}${footerLabel ? "  |  " : ""}Pagina ${pageIndex + 1} de ${totalPages}`;
    operations.push(
      `BT /F1 ${FOOTER_FONT_SIZE} Tf 1 0 0 1 ${MARGIN} ${MARGIN - 14} Tm (${escapePdfText(footerText)}) Tj ET`
    );

    const stream = operations.join("\n");
    const streamLength = new TextEncoder().encode(stream).length;
    const contentId = addObject(`<< /Length ${streamLength} >>\nstream\n${stream}\nendstream`);
    const pageId = addObject(
      `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 ${fontRegularId} 0 R /F2 ${fontBoldId} 0 R >> >> /Contents ${contentId} 0 R >>`
    );
    pageObjectIds.push(pageId);
  }

  objects[catalogId - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
  objects[pagesId - 1] = `<< /Type /Pages /Count ${pageObjectIds.length} /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(" ")}] >>`;

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [0];

  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xrefStart = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";

  for (let i = 1; i <= objects.length; i++) {
    pdf += `${offsets[i].toString().padStart(10, "0")} 00000 n \n`;
  }

  pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

  return new TextEncoder().encode(pdf);
}

export function downloadStructuredPdf(options: ExportPdfOptions) {
  const lines = buildLines(options);
  const pages = paginateLines(lines);
  const bytes = buildPdfBytes(pages, options.generatedAt);
  const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = options.filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
