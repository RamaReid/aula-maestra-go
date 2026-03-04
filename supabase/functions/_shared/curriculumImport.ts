import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getDocument } from "npm:pdfjs-dist@4.10.38/legacy/build/pdf.mjs";

import {
  CurriculumCycle,
  CurriculumNodeType,
  isAllowedOfficialUrl,
  normalizeText,
  SchoolType,
} from "./curriculumCommon.ts";

export type { CurriculumCycle, SchoolType } from "./curriculumCommon.ts";

export type CurriculumImportPayload = {
  file_name?: string | null;
  file_base64?: string | null;
  province?: string | null;
  subject: string;
  cycle: CurriculumCycle;
  year_level: number;
  school_type?: SchoolType | null;
  orientation?: string | null;
  speciality?: string | null;
  official_title?: string | null;
  official_url?: string | null;
  allow_external_url?: boolean;
  source_provider?: string | null;
};

type DraftNode = {
  tempId: string;
  parentTempId: string | null;
  nodeType: CurriculumNodeType;
  name: string;
  orderIndex: number;
};

const SECTION_HEADINGS = [
  "presentacion",
  "filosofia y su ensenanza en el ciclo superior de la escuela secundaria",
  "filosofia e historia de la ciencia y la tecnologia y su ensenanza en el ciclo superior de la escuela secundaria",
  "historia y su ensenanza en el ciclo superior de la escuela secundaria",
  "matematica y su ensenanza en el ciclo superior de la escuela secundaria",
  "mapa curricular",
  "carga horaria",
  "objetivos de ensenanza",
  "objetivos de aprendizaje",
  "contenidos",
  "organizacion de los contenidos",
  "orientaciones didacticas",
  "orientaciones para la evaluacion",
  "criterios de evaluacion",
  "bibliografia",
];

function normalizeNullable(value: string | null | undefined): string | null {
  const normalized = normalizeText(value);
  return normalized.length > 0 ? normalized : null;
}

function bytesToSha256(buffer: Uint8Array): Promise<string> {
  return crypto.subtle.digest("SHA-256", buffer.buffer as ArrayBuffer).then((hashBuffer) => {
    return Array.from(new Uint8Array(hashBuffer))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  });
}

function decodeBase64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function collapseSpacedWords(value: string): string {
  return value.replace(
    /\b(?:[A-Za-zÁÉÍÓÚáéíóúÑñÜü]\s+){2,}[A-Za-zÁÉÍÓÚáéíóúÑñÜü]\b/g,
    (match) => match.replace(/\s+/g, "")
  );
}

function cleanExtractedText(value: string): string {
  return collapseSpacedWords(
    value
      .replace(/\r/g, "")
      .replace(/\u0000/g, "")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .replace(/([A-Za-zÁÉÍÓÚáéíóúÑñ])-\n(?=[a-záéíóúñ])/g, "$1")
      .trim()
  );
}

function lineFromItems(items: Array<{ str: string; x: number; width: number }>): string {
  const sorted = [...items].sort((a, b) => a.x - b.x);
  let line = "";
  let previousRight: number | null = null;

  for (const item of sorted) {
    const token = `${item.str || ""}`.replace(/\s+/g, " ").trim();
    if (!token) continue;

    if (line && previousRight !== null && item.x - previousRight > 4) {
      line += " ";
    }

    line += token;
    previousRight = item.x + item.width;
  }

  return line.trim();
}

async function extractPdfText(bytes: Uint8Array): Promise<string> {
  const loadingTask = getDocument({
    data: bytes,
    disableWorker: true,
    useSystemFonts: true,
    isEvalSupported: false,
  } as any);
  const pdf = await loadingTask.promise;
  const pages: string[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const textContent = await page.getTextContent();
    const rows = new Map<number, Array<{ str: string; x: number; width: number }>>();

    for (const item of textContent.items) {
      if (!("str" in item) || !Array.isArray(item.transform)) continue;

      const x = Number(item.transform[4] || 0);
      const y = Number(item.transform[5] || 0);
      const width = Number(item.width || 0);
      const rowKey = Math.round(Number(y) * 10) / 10;

      if (!rows.has(rowKey)) rows.set(rowKey, []);
      rows.get(rowKey)!.push({ str: item.str, x, width });
    }

    const lines = [...rows.entries()]
      .sort((a, b) => b[0] - a[0])
      .map(([, items]) => lineFromItems(items))
      .filter(Boolean);

    pages.push(lines.join("\n"));
  }

  return cleanExtractedText(pages.join("\n\n"));
}

function deriveOfficialTitle(rawText: string, fallbackTitle: string): string {
  const lines = rawText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 20);

  const titleLines: string[] = [];
  for (const line of lines) {
    if (/isbn|indice|índice|equipo de especialistas/i.test(line)) break;
    if (line.length < 3) continue;
    titleLines.push(line);
  }

  if (titleLines.length === 0) return fallbackTitle;
  return titleLines.slice(0, 4).join(" | ");
}

function isLikelySectionHeading(line: string): boolean {
  const normalized = normalizeText(line);
  if (!normalized) return false;
  if (SECTION_HEADINGS.includes(normalized)) return true;
  return (
    line.length <= 110 &&
    !/[.:;]$/.test(line) &&
    /^[A-ZÁÉÍÓÚÑ0-9][A-Za-zÁÉÍÓÚáéíóúÑñ0-9 ,()/.-]+$/.test(line)
  );
}

function isLikelyUnitHeading(line: string): boolean {
  return /^(modulo|m[oó]dulo|unidad)\s+\d+/i.test(line.trim());
}

function isLikelyContentLine(line: string): boolean {
  if (line.length < 8 || line.length > 180) return false;
  if (/^[•*-]\s+/.test(line)) return true;
  if (/^\d+[\).]\s+/.test(line)) return true;
  return false;
}

function extractCurriculumNodes(rawText: string): DraftNode[] {
  const lines = rawText
    .split("\n")
    .map((line) => collapseSpacedWords(line.trim()))
    .filter(Boolean);

  const nodes: Array<DraftNode & { fingerprint: string }> = [];
  let currentEje: (DraftNode & { fingerprint: string }) | null = null;
  let currentUnidad: (DraftNode & { fingerprint: string }) | null = null;
  let currentBloque: (DraftNode & { fingerprint: string }) | null = null;
  let orderIndex = 0;

  const pushNode = (
    nodeType: CurriculumNodeType,
    name: string,
    parentTempId: string | null = null
  ): (DraftNode & { fingerprint: string }) | null => {
    const cleanName = name.replace(/\s+/g, " ").trim();
    if (!cleanName) return null;

    const fingerprint = `${nodeType}|${parentTempId || "root"}|${normalizeText(cleanName)}`;
    const existing = nodes.find((node) => node.fingerprint === fingerprint);
    if (existing) return existing;

    const node = {
      tempId: `node_${nodes.length + 1}`,
      parentTempId,
      nodeType,
      name: cleanName,
      orderIndex,
      fingerprint,
    };
    orderIndex += 1;
    nodes.push(node);
    return node;
  };

  for (const line of lines) {
    if (isLikelyUnitHeading(line)) {
      currentUnidad = pushNode("UNIDAD", line, currentEje?.tempId || null);
      currentBloque = null;
      continue;
    }

    if (isLikelySectionHeading(line)) {
      currentEje = pushNode("EJE", line, null);
      currentUnidad = null;
      currentBloque = null;
      continue;
    }

    if (
      line.length <= 120 &&
      !/[.:;]$/.test(line) &&
      /^[A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚáéíóúÑñ0-9 ,()/.-]+$/.test(line) &&
      (currentUnidad || currentEje)
    ) {
      currentBloque = pushNode("BLOQUE", line, currentUnidad?.tempId || currentEje?.tempId || null);
      continue;
    }

    if (isLikelyContentLine(line) && (currentBloque || currentUnidad || currentEje)) {
      pushNode(
        "CONTENIDO",
        line.replace(/^[•*-]\s+/, "").replace(/^\d+[\).]\s+/, ""),
        currentBloque?.tempId || currentUnidad?.tempId || currentEje?.tempId || null
      );
    }
  }

  return nodes.map(({ fingerprint: _fingerprint, ...node }) => node);
}

async function replaceNodes(
  adminClient: any,
  curriculumDocumentId: string,
  nodes: DraftNode[]
) {
  const { error: deleteError } = await adminClient
    .from("curriculum_nodes")
    .delete()
    .eq("curriculum_document_id", curriculumDocumentId);

  if (deleteError) {
    throw new Error(deleteError.message);
  }

  const tempToInsertedId = new Map<string, string>();

  for (const node of nodes) {
    const { data, error } = await adminClient
      .from("curriculum_nodes")
      .insert({
        curriculum_document_id: curriculumDocumentId,
        parent_id: node.parentTempId ? tempToInsertedId.get(node.parentTempId) || null : null,
        node_type: node.nodeType,
        name: node.name,
        order_index: node.orderIndex,
      })
      .select("id")
      .single();

    if (error || !data) {
      throw new Error(error?.message || `No se pudo insertar curriculum_node ${node.name}`);
    }

    tempToInsertedId.set(node.tempId, data.id);
  }
}

function resolveSourceProvider(payload: CurriculumImportPayload): string {
  if (payload.source_provider && payload.source_provider.trim().length > 0) {
    return payload.source_provider.trim();
  }

  if (payload.file_base64) return "ABC_PBA_UPLOAD";
  if (payload.official_url && isAllowedOfficialUrl(payload.official_url)) return "ABC_PBA_UPLOAD";
  if (payload.official_url) return "MANUAL_URL";
  return "ABC_PBA_UPLOAD";
}

async function upsertDocument(
  adminClient: any,
  payload: Required<Omit<CurriculumImportPayload, "file_base64">>,
  rawText: string,
  contentHash: string
): Promise<string> {
  const { data, error } = await adminClient
    .from("curriculum_documents")
    .select("id, content_hash, official_title, official_url, school_type, orientation, speciality")
    .eq("province", payload.province)
    .eq("subject", payload.subject)
    .eq("cycle", payload.cycle)
    .eq("year_level", payload.year_level);

  if (error) throw new Error(error.message);

  const existing =
    (data || []).find(
      (document: any) =>
        normalizeNullable(document.official_url) === normalizeNullable(payload.official_url) &&
        normalizeNullable(payload.official_url)
    ) ||
    (data || []).find(
      (document: any) =>
        normalizeNullable(document.official_title) === normalizeNullable(payload.official_title) &&
        normalizeNullable(payload.official_title)
    ) ||
    (data || []).find((document: any) => normalizeNullable(document.content_hash) === normalizeNullable(contentHash)) ||
    (data || []).find(
      (document: any) =>
        document.school_type === (payload.school_type || null) &&
        normalizeNullable(document.orientation) === normalizeNullable(payload.orientation) &&
        normalizeNullable(document.speciality) === normalizeNullable(payload.speciality)
    ) ||
    null;

  const upsertPayload = {
    province: payload.province,
    subject: payload.subject,
    cycle: payload.cycle,
    year_level: payload.year_level,
    status: "VERIFIED" as const,
    content_hash: contentHash,
    official_url: payload.official_url || null,
    official_title: payload.official_title || deriveOfficialTitle(rawText, payload.file_name ?? "programa_oficial.pdf"),
    source_provider: resolveSourceProvider(payload),
    fetched_at: new Date().toISOString(),
    raw_text: rawText,
    school_type: payload.school_type || null,
    orientation: payload.orientation || null,
    speciality: payload.speciality || null,
  };

  if (existing) {
    const { data: updated, error: updateError } = await adminClient
      .from("curriculum_documents")
      .update(upsertPayload)
      .eq("id", existing.id)
      .select("id")
      .single();
    if (updateError || !updated) {
      throw new Error(updateError?.message || "No se pudo actualizar curriculum_documents");
    }
    return updated.id;
  }

  const { data: inserted, error: insertError } = await adminClient
    .from("curriculum_documents")
    .insert(upsertPayload)
    .select("id")
    .single();
  if (insertError || !inserted) {
    throw new Error(insertError?.message || "No se pudo insertar curriculum_documents");
  }
  return inserted.id;
}

async function downloadPdfBytesFromUrl(
  url: string,
  options?: { allowExternalUrl?: boolean }
): Promise<{ bytes: Uint8Array; fileName: string }> {
  if (!options?.allowExternalUrl && !isAllowedOfficialUrl(url)) {
    throw new Error("La URL oficial no pertenece a un dominio permitido.");
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`No se pudo descargar el PDF remoto (${response.status})`);
  }

  const contentType = response.headers.get("content-type")?.toLowerCase() || "";
  const arrayBuffer = await response.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);

  if (!contentType.includes("pdf") && !url.toLowerCase().endsWith(".pdf")) {
    throw new Error("La URL no devolvio un PDF.");
  }

  const pathname = new URL(url).pathname;
  const fileName = pathname.split("/").pop() || "programa_oficial.pdf";

  return { bytes, fileName };
}

export async function ingestCurriculumDocument(
  adminClient: any,
  payload: CurriculumImportPayload
): Promise<{
  curriculum_document_id: string;
  raw_text_length: number;
  node_count: number;
  content_hash: string;
}> {
  if (!payload.subject || !payload.cycle || !payload.year_level) {
    throw new Error("subject, cycle y year_level son obligatorios");
  }

  let bytes: Uint8Array;
  let fileName: string;

  if (payload.file_base64) {
    bytes = decodeBase64ToBytes(payload.file_base64);
    fileName = payload.file_name || "programa_oficial.pdf";
  } else if (payload.official_url) {
    const downloaded = await downloadPdfBytesFromUrl(payload.official_url, {
      allowExternalUrl: payload.allow_external_url === true,
    });
    bytes = downloaded.bytes;
    fileName = payload.file_name || downloaded.fileName;
  } else {
    throw new Error("Debe enviar file_base64 u official_url");
  }

  const contentHash = await bytesToSha256(bytes);
  const rawText = await extractPdfText(bytes);

  if (rawText.length < 500) {
    throw new Error("La extraccion devolvio muy poco texto. El PDF puede ser una imagen escaneada o estar dañado.");
  }

  const nodes = extractCurriculumNodes(rawText);
  const curriculumDocumentId = await upsertDocument(
    adminClient,
    {
      file_name: fileName,
      province: payload.province || "PBA",
      subject: payload.subject,
      cycle: payload.cycle,
      year_level: payload.year_level,
      school_type: payload.school_type ?? null,
      orientation: payload.orientation ?? null,
      speciality: payload.speciality ?? null,
      official_title: payload.official_title ?? "",
      official_url: payload.official_url ?? "",
      allow_external_url: payload.allow_external_url ?? false,
      source_provider: resolveSourceProvider(payload),
    },
    rawText,
    contentHash
  );

  await replaceNodes(adminClient, curriculumDocumentId, nodes);

  return {
    curriculum_document_id: curriculumDocumentId,
    raw_text_length: rawText.length,
    node_count: nodes.length,
    content_hash: contentHash,
  };
}
