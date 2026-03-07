import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getDocument } from "https://esm.sh/pdfjs-dist@4.10.38/legacy/build/pdf.mjs";

import {
  CurriculumCycle,
  CurriculumNodeType,
  isAllowedOfficialUrl,
  normalizeText,
  SchoolType,
} from "./curriculumCommon.ts";

export type { CurriculumCycle, SchoolType } from "./curriculumCommon.ts";

type SupabaseClientLike = ReturnType<typeof createClient>;

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

type ExistingCurriculumDocument = {
  id: string;
  content_hash: string | null;
  official_title: string | null;
  official_url: string | null;
  school_type: SchoolType | null;
  orientation: string | null;
  speciality: string | null;
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
      .replaceAll("\u0000", "")
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
  } as Parameters<typeof getDocument>[0]);
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
  if (/^\d+[).]\s+/.test(line)) return true;
  return false;
}

function isBibliographyHeading(line: string): boolean {
  const normalized = normalizeText(line);
  return normalized === "bibliografia" || normalized.startsWith("bibliografia ");
}

function isLikelyPageArtifactLine(line: string): boolean {
  const compact = line.trim();
  if (!compact) return true;
  if (/^\d+$/.test(compact)) return true;
  if (/^\d+\s*\|/.test(compact)) return true;
  if (/\|\s*DGCyE\s*\|/i.test(compact)) return true;
  if (/^pagina\s+\d+/i.test(compact)) return true;
  return false;
}

function isLikelyBibliographyNoise(line: string): boolean {
  const normalized = normalizeText(line);
  if (!normalized) return true;
  if (isLikelyPageArtifactLine(line)) return true;

  return (
    normalized.startsWith("isbn") ||
    normalized.startsWith("cdd") ||
    normalized.startsWith("indice") ||
    normalized.startsWith("equipo de especialistas") ||
    normalized.startsWith("diseno curricular para") ||
    normalized.startsWith("educacion secundaria")
  );
}

function isRepeatedAuthorMarker(raw: string): boolean {
  const value = raw.replace(/[,:.;]+$/g, "").replace(/\s+/g, "");
  if (!value || value.length < 2) return false;
  return value.replace(/\p{Pd}/gu, "").length === 0;
}

function cleanBibliographyCandidate(line: string): string {
  return line
    .replace(/^[\u2022*-]\s+/u, "")
    .replace(/^\d+[).]\s+/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isLikelyBibliographyEntryStart(line: string, hasLastAuthor: boolean): boolean {
  const candidate = cleanBibliographyCandidate(line);
  if (!candidate || candidate.length < 14) return false;
  if (isLikelyBibliographyNoise(candidate)) return false;

  const commaCount = (candidate.match(/,/g) || []).length;
  const hasYear = /\b(1[89]\d{2}|20\d{2})\b/.test(candidate);
  const hasEditionFallback = /\bvarias\s+ediciones\b/i.test(candidate);
  const firstToken = candidate.split(",")[0] || "";
  const repeatedAuthor = isRepeatedAuthorMarker(firstToken);
  const authorLike = /^[\p{Lu}][^,]{1,90},/u.test(candidate);

  if (!authorLike && !(repeatedAuthor && hasLastAuthor)) return false;
  if (commaCount < 3) return false;
  if (!hasYear && !hasEditionFallback && commaCount < 4) return false;

  return true;
}

function buildAuthorCarry(parts: string[]): string | null {
  if (parts.length === 0) return null;

  const surname = parts[0].trim();
  if (!surname) return null;
  if (parts.length === 1) return surname;

  const maybeGivenName = parts[1].trim();
  if (
    maybeGivenName &&
    maybeGivenName.length <= 48 &&
    /^[\p{L}.'\- ]+$/u.test(maybeGivenName) &&
    !/\b(en|vol\.?|libro|trad\.?|edicion|ediciones)\b/i.test(maybeGivenName) &&
    !/\d/.test(maybeGivenName)
  ) {
    return `${surname}, ${maybeGivenName}`.replace(/\s+/g, " ").trim();
  }

  return surname;
}

function normalizeBibliographyEntry(
  rawEntry: string,
  lastAuthor: string | null
): { citation: string; carryAuthor: string | null } | null {
  const cleaned = cleanBibliographyCandidate(rawEntry);
  if (!cleaned || isLikelyBibliographyNoise(cleaned)) return null;

  const commaCount = (cleaned.match(/,/g) || []).length;
  const hasYear = /\b(1[89]\d{2}|20\d{2})\b/.test(cleaned);
  const hasEditionFallback = /\bvarias\s+ediciones\b/i.test(cleaned);
  const parts = cleaned.split(",").map((part) => part.trim()).filter(Boolean);
  if (parts.length < 2) return null;

  const firstToken = parts[0];
  const repeatedAuthor = isRepeatedAuthorMarker(firstToken);
  const authorLike = /^[\p{Lu}][^,]{1,90}$/u.test(firstToken);
  if (!authorLike && !(repeatedAuthor && lastAuthor)) return null;
  if (commaCount < 3) return null;
  if (!hasYear && !hasEditionFallback && commaCount < 4) return null;

  if (repeatedAuthor) {
    if (!lastAuthor) return null;
    const rest = parts.slice(1).join(", ").trim();
    if (!rest) return null;
    return {
      citation: `${lastAuthor}, ${rest}`.replace(/\s+/g, " ").trim(),
      carryAuthor: lastAuthor,
    };
  }

  return {
    citation: cleaned.replace(/\s+/g, " ").trim(),
    carryAuthor: buildAuthorCarry(parts),
  };
}

function isLikelyAuthorityLine(line: string): boolean {
  const cleaned = cleanBibliographyCandidate(line);
  if (!cleaned) return false;
  if (isLikelyBibliographyNoise(cleaned)) return true;

  const normalized = normalizeText(cleaned);
  const commaCount = (cleaned.match(/,/g) || []).length;
  const hasYear = /\b(1[89]\d{2}|20\d{2})\b/.test(cleaned);
  if (hasYear && commaCount >= 2) return false;

  const institutionalTokens = [
    "autoridades",
    "direccion general",
    "dgcye",
    "ministerio",
    "subsecretaria",
    "gobernacion",
    "consejo general",
    "equipo de especialistas",
    "equipo tecnico",
    "provincia de buenos aires",
  ];

  if (institutionalTokens.some((token) => normalized.includes(token))) return true;

  if (
    /\b(ministro|subsecretari[oa]|director(?:a)?(?:\s+general|\s+provincial)?|gobernador|presidente|vicepresidente|secretari[oa]|coordinador(?:a)?|jef[ea]|inspector(?:a)?)\b/i.test(
      cleaned
    )
  ) {
    return true;
  }

  if (
    /^(lic\.|prof\.|dr\.|dra\.)\s+[\p{Lu}][\p{L}'-]+(?:\s+[\p{Lu}][\p{L}'-]+){1,4}$/u.test(cleaned) &&
    commaCount <= 1 &&
    !hasYear
  ) {
    return true;
  }

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
  let bibliographyParent: (DraftNode & { fingerprint: string }) | null = null;
  let inBibliographySection = false;
  let bibliographyDraft = "";
  let lastBibliographyAuthor: string | null = null;
  let authorityLineStreak = 0;
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

  const flushBibliographyDraft = () => {
    const parsed = normalizeBibliographyEntry(bibliographyDraft, lastBibliographyAuthor);
    bibliographyDraft = "";
    if (!parsed) return;

    pushNode(
      "CONTENIDO",
      parsed.citation,
      bibliographyParent?.tempId || currentEje?.tempId || null
    );
    lastBibliographyAuthor = parsed.carryAuthor || lastBibliographyAuthor;
  };

  for (const line of lines) {
    if (isBibliographyHeading(line)) {
      flushBibliographyDraft();
      currentEje = pushNode("EJE", line, null);
      currentUnidad = null;
      currentBloque = pushNode("BLOQUE", "Fuentes bibliograficas", currentEje?.tempId || null);
      bibliographyParent = currentBloque || currentEje;
      inBibliographySection = true;
      lastBibliographyAuthor = null;
      authorityLineStreak = 0;
      continue;
    }

    if (inBibliographySection) {
      const startsBibliographyEntry = isLikelyBibliographyEntryStart(
        line,
        Boolean(lastBibliographyAuthor)
      );
      const likelyAuthorityLine = isLikelyAuthorityLine(line);
      const exitsBibliography =
        isLikelySectionHeading(line) &&
        !isBibliographyHeading(line) &&
        !startsBibliographyEntry;

      if (exitsBibliography) {
        flushBibliographyDraft();
        inBibliographySection = false;
        bibliographyParent = null;
        lastBibliographyAuthor = null;
        authorityLineStreak = 0;
      } else {
        if (likelyAuthorityLine && !startsBibliographyEntry) {
          authorityLineStreak += 1;
          if (authorityLineStreak >= 3) {
            flushBibliographyDraft();
            inBibliographySection = false;
            bibliographyParent = null;
            lastBibliographyAuthor = null;
            authorityLineStreak = 0;
          }
          continue;
        }

        authorityLineStreak = 0;

        if (isLikelyBibliographyNoise(line)) {
          continue;
        }

        const candidate = cleanBibliographyCandidate(line);
        if (!candidate) continue;

        if (startsBibliographyEntry) {
          flushBibliographyDraft();
          bibliographyDraft = candidate;
        } else if (bibliographyDraft.length > 0) {
          bibliographyDraft = `${bibliographyDraft} ${candidate}`.replace(/\s+/g, " ").trim();
        }

        continue;
      }
    }

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
        line.replace(/^[•*-]\s+/, "").replace(/^\d+[).]\s+/, ""),
        currentBloque?.tempId || currentUnidad?.tempId || currentEje?.tempId || null
      );
    }
  }

  flushBibliographyDraft();
  return nodes.map(({ fingerprint: _fingerprint, ...node }) => node);
}

async function replaceNodes(
  adminClient: SupabaseClientLike,
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

export async function repairCurriculumDocumentNodes(
  adminClient: SupabaseClientLike,
  curriculumDocumentId: string
): Promise<{ node_count: number; bibliography_count: number }> {
  const { data: document, error } = await adminClient
    .from("curriculum_documents")
    .select("id, raw_text")
    .eq("id", curriculumDocumentId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  if (!document?.raw_text || document.raw_text.trim().length < 500) {
    throw new Error("El documento curricular no tiene raw_text suficiente para repararse.");
  }

  const nodes = extractCurriculumNodes(document.raw_text);
  await replaceNodes(adminClient, curriculumDocumentId, nodes);

  const bibliographyCount = nodes.filter((node) => node.nodeType === "CONTENIDO" && isLikelyBibliographyEntryStart(node.name, true)).length;
  return {
    node_count: nodes.length,
    bibliography_count: bibliographyCount,
  };
}

function resolveSourceProvider(payload: CurriculumImportPayload): string {
  if (payload.source_provider && payload.source_provider.trim().length > 0) {
    return payload.source_provider.trim();
  }

  if (payload.file_base64) return "MANUAL_UPLOAD";
  if (payload.official_url && isAllowedOfficialUrl(payload.official_url)) return "ABC_PBA_WEB";
  return "ABC_PBA_WEB";
}

async function upsertDocument(
  adminClient: SupabaseClientLike,
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
    ((data || []) as ExistingCurriculumDocument[]).find(
      (document) =>
        normalizeNullable(document.official_url) === normalizeNullable(payload.official_url) &&
        normalizeNullable(payload.official_url)
    ) ||
    ((data || []) as ExistingCurriculumDocument[]).find(
      (document) =>
        normalizeNullable(document.official_title) === normalizeNullable(payload.official_title) &&
        normalizeNullable(payload.official_title)
    ) ||
    ((data || []) as ExistingCurriculumDocument[]).find(
      (document) => normalizeNullable(document.content_hash) === normalizeNullable(contentHash)
    ) ||
    ((data || []) as ExistingCurriculumDocument[]).find(
      (document) =>
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
  adminClient: SupabaseClientLike,
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
