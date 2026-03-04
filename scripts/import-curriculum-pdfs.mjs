import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { createClient } from "@supabase/supabase-js";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");
const CURRICULUM_DIR = path.join(ROOT_DIR, "supabase", "seed_data", "curriculum", "pba");
const PDF_DIR = path.join(CURRICULUM_DIR, "pdfs");
const MANIFEST_PATH = path.join(CURRICULUM_DIR, "manifest.json");

const args = new Set(process.argv.slice(2));
const DRY_RUN = args.has("--dry-run");

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

function normalizeText(value) {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function normalizeNullable(value) {
  const normalized = normalizeText(value);
  return normalized.length > 0 ? normalized : null;
}

function parseEnvFile(content) {
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) continue;

    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

async function loadLocalEnv() {
  for (const candidate of [".env.local", ".env"]) {
    const envPath = path.join(ROOT_DIR, candidate);
    try {
      const content = await fs.readFile(envPath, "utf8");
      parseEnvFile(content);
    } catch {
      // Ignore missing env files.
    }
  }
}

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function collapseSpacedWords(value) {
  return value.replace(
    /\b(?:[A-Za-zÁÉÍÓÚáéíóúÑñÜü]\s+){2,}[A-Za-zÁÉÍÓÚáéíóúÑñÜü]\b/g,
    (match) => match.replace(/\s+/g, "")
  );
}

function cleanExtractedText(value) {
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

function lineFromItems(items) {
  const sorted = [...items].sort((a, b) => a.x - b.x);
  let line = "";
  let previousRight = null;

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

async function extractPdfText(buffer) {
  const loadingTask = getDocument({
    data: new Uint8Array(buffer),
    disableWorker: true,
    useSystemFonts: true,
    isEvalSupported: false,
  });
  const pdf = await loadingTask.promise;
  const pages = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const textContent = await page.getTextContent();
    const rows = new Map();

    for (const item of textContent.items) {
      if (!("str" in item) || !Array.isArray(item.transform)) continue;

      const x = Number(item.transform[4] || 0);
      const y = Number(item.transform[5] || 0);
      const width = Number(item.width || 0);
      const rowKey = Math.round(y * 10) / 10;

      if (!rows.has(rowKey)) rows.set(rowKey, []);
      rows.get(rowKey).push({ str: item.str, x, y, width });
    }

    const lines = [...rows.entries()]
      .sort((a, b) => b[0] - a[0])
      .map(([, items]) => lineFromItems(items))
      .filter(Boolean);

    pages.push(lines.join("\n"));
  }

  return cleanExtractedText(pages.join("\n\n"));
}

function deriveOfficialTitle(rawText, fallbackTitle) {
  const lines = rawText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 20);

  const titleLines = [];
  for (const line of lines) {
    if (/isbn|indice|índice|equipo de especialistas/i.test(line)) break;
    if (line.length < 3) continue;
    titleLines.push(line);
  }

  if (titleLines.length === 0) return fallbackTitle;

  return titleLines.slice(0, 4).join(" | ");
}

function isLikelySectionHeading(line) {
  const normalized = normalizeText(line);
  if (!normalized) return false;
  if (SECTION_HEADINGS.includes(normalized)) return true;
  return (
    line.length <= 110 &&
    !/[.:;]$/.test(line) &&
    /^[A-ZÁÉÍÓÚÑ0-9][A-Za-zÁÉÍÓÚáéíóúÑñ0-9 ,()/.-]+$/.test(line)
  );
}

function isLikelyUnitHeading(line) {
  return /^(modulo|m[oó]dulo|unidad)\s+\d+/i.test(line.trim());
}

function isLikelyContentLine(line) {
  if (line.length < 8 || line.length > 180) return false;
  if (/^[•*-]\s+/.test(line)) return true;
  if (/^\d+[\).]\s+/.test(line)) return true;
  return false;
}

function extractCurriculumNodes(rawText) {
  const lines = rawText
    .split("\n")
    .map((line) => collapseSpacedWords(line.trim()))
    .filter(Boolean);

  const nodes = [];
  const seen = new Set();
  let currentEje = null;
  let currentUnidad = null;
  let currentBloque = null;
  let orderIndex = 0;

  const pushNode = (nodeType, name, parentTempId = null) => {
    const cleanName = name.replace(/\s+/g, " ").trim();
    if (!cleanName) return null;

    const fingerprint = `${nodeType}|${parentTempId || "root"}|${normalizeText(cleanName)}`;
    if (seen.has(fingerprint)) return nodes.find((node) => node.fingerprint === fingerprint) || null;
    seen.add(fingerprint);

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
      const unitNode = pushNode("UNIDAD", line, currentEje?.tempId || null);
      currentUnidad = unitNode;
      currentBloque = null;
      continue;
    }

    if (isLikelySectionHeading(line)) {
      const ejeNode = pushNode("EJE", line, null);
      currentEje = ejeNode;
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
      const bloqueNode = pushNode("BLOQUE", line, currentUnidad?.tempId || currentEje?.tempId || null);
      currentBloque = bloqueNode;
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

  return nodes.map(({ fingerprint, ...node }) => node);
}

async function loadManifest() {
  const raw = await fs.readFile(MANIFEST_PATH, "utf8");
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error("El manifest debe ser un array JSON");
  }

  return parsed.map((entry, index) => {
    if (!entry.file_name || !entry.subject || !entry.cycle || !entry.year_level) {
      throw new Error(`Entrada invalida en manifest.json (indice ${index})`);
    }

    return {
      province: entry.province || "PBA",
      status: entry.status || "VERIFIED",
      source_provider: entry.source_provider || "ABC_PBA_MANUAL",
      school_type: entry.school_type || null,
      orientation: entry.orientation || null,
      speciality: entry.speciality || null,
      official_title: entry.official_title || "",
      official_url: entry.official_url || "",
      file_name: entry.file_name,
      subject: entry.subject,
      cycle: entry.cycle,
      year_level: entry.year_level,
    };
  });
}

function pickExistingDocument(documents, entry, contentHash) {
  const expectedOrientation = normalizeNullable(entry.orientation);
  const expectedSpeciality = normalizeNullable(entry.speciality);
  const expectedTitle = normalizeNullable(entry.official_title);
  const expectedUrl = normalizeNullable(entry.official_url);

  return (
    documents.find((document) => normalizeNullable(document.official_url) === expectedUrl && expectedUrl) ||
    documents.find((document) => normalizeNullable(document.official_title) === expectedTitle && expectedTitle) ||
    documents.find((document) => normalizeNullable(document.content_hash) === normalizeNullable(contentHash)) ||
    documents.find(
      (document) =>
        document.school_type === (entry.school_type || null) &&
        normalizeNullable(document.orientation) === expectedOrientation &&
        normalizeNullable(document.speciality) === expectedSpeciality
    ) ||
    null
  );
}

async function upsertDocument(supabase, entry, rawText, contentHash) {
  const { data, error } = await supabase
    .from("curriculum_documents")
    .select(
      "id, province, subject, cycle, year_level, content_hash, official_title, official_url, school_type, orientation, speciality"
    )
    .eq("province", entry.province)
    .eq("subject", entry.subject)
    .eq("cycle", entry.cycle)
    .eq("year_level", entry.year_level);

  if (error) {
    throw new Error(`No se pudieron consultar curriculum_documents: ${error.message}`);
  }

  const existing = pickExistingDocument(data || [], entry, contentHash);
  const payload = {
    province: entry.province,
    subject: entry.subject,
    cycle: entry.cycle,
    year_level: entry.year_level,
    status: entry.status,
    content_hash: contentHash,
    official_url: entry.official_url || null,
    official_title: entry.official_title || deriveOfficialTitle(rawText, path.parse(entry.file_name).name),
    source_provider: entry.source_provider,
    fetched_at: new Date().toISOString(),
    raw_text: rawText,
    school_type: entry.school_type || null,
    orientation: entry.orientation || null,
    speciality: entry.speciality || null,
  };

  if (existing) {
    const { data: updated, error: updateError } = await supabase
      .from("curriculum_documents")
      .update(payload)
      .eq("id", existing.id)
      .select("id, official_title")
      .single();

    if (updateError || !updated) {
      throw new Error(`No se pudo actualizar curriculum_document: ${updateError?.message || "sin detalle"}`);
    }

    return updated.id;
  }

  const { data: inserted, error: insertError } = await supabase
    .from("curriculum_documents")
    .insert(payload)
    .select("id, official_title")
    .single();

  if (insertError || !inserted) {
    throw new Error(`No se pudo insertar curriculum_document: ${insertError?.message || "sin detalle"}`);
  }

  return inserted.id;
}

async function replaceNodes(supabase, curriculumDocumentId, nodes) {
  const { error: deleteError } = await supabase
    .from("curriculum_nodes")
    .delete()
    .eq("curriculum_document_id", curriculumDocumentId);

  if (deleteError) {
    throw new Error(`No se pudieron borrar curriculum_nodes previos: ${deleteError.message}`);
  }

  const insertedIds = new Map();

  for (const node of nodes) {
    const { data, error } = await supabase
      .from("curriculum_nodes")
      .insert({
        curriculum_document_id: curriculumDocumentId,
        parent_id: node.parentTempId ? insertedIds.get(node.parentTempId) || null : null,
        node_type: node.nodeType,
        name: node.name,
        order_index: node.orderIndex,
      })
      .select("id")
      .single();

    if (error || !data) {
      throw new Error(`No se pudo insertar curriculum_node "${node.name}": ${error?.message || "sin detalle"}`);
    }

    insertedIds.set(node.tempId, data.id);
  }
}

async function ensureFolderState(manifestEntries) {
  const pdfFiles = await fs.readdir(PDF_DIR);
  const manifestFiles = new Set(manifestEntries.map((entry) => entry.file_name));

  for (const entry of manifestEntries) {
    const pdfPath = path.join(PDF_DIR, entry.file_name);
    try {
      await fs.access(pdfPath);
    } catch {
      throw new Error(`Falta el PDF declarado en manifest.json: ${entry.file_name}`);
    }
  }

  const orphanFiles = pdfFiles.filter((file) => file.toLowerCase().endsWith(".pdf") && !manifestFiles.has(file));
  if (orphanFiles.length > 0) {
    console.warn(`PDFs sin entrada en manifest.json: ${orphanFiles.join(", ")}`);
  }
}

async function main() {
  await loadLocalEnv();
  const manifestEntries = await loadManifest();
  await ensureFolderState(manifestEntries);

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  let supabase = null;
  if (!DRY_RUN) {
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Faltan SUPABASE_URL/VITE_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY para importar a la base");
    }
    supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }

  const report = [];

  for (const entry of manifestEntries) {
    const pdfPath = path.join(PDF_DIR, entry.file_name);
    const buffer = await fs.readFile(pdfPath);
    const contentHash = sha256(buffer);
    const rawText = await extractPdfText(buffer);

    if (rawText.length < 500) {
      throw new Error(`La extraccion de "${entry.file_name}" devolvio muy poco texto. Revisar el PDF.`);
    }

    const nodes = extractCurriculumNodes(rawText);

    let curriculumDocumentId = null;
    if (supabase) {
      curriculumDocumentId = await upsertDocument(supabase, entry, rawText, contentHash);
      await replaceNodes(supabase, curriculumDocumentId, nodes);
    }

    report.push({
      file_name: entry.file_name,
      subject: entry.subject,
      year_level: entry.year_level,
      raw_text_length: rawText.length,
      node_count: nodes.length,
      curriculum_document_id: curriculumDocumentId,
    });
  }

  console.table(report);
  console.log(DRY_RUN ? "Dry run completado." : "Importacion curricular completada.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
