import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getDocument } from "npm:pdfjs-dist@4.10.38/legacy/build/pdf.mjs";
import mammoth from "npm:mammoth@1.8.0";
import * as XLSX from "https://esm.sh/xlsx@0.18.5";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type RequestBody = {
  source_id?: string;
};

type ExtractResult = {
  text: string;
  extractor: string;
};

const MAX_OCR_IMAGE_BYTES = 4 * 1024 * 1024;

function normalizeSpaces(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function cleanExtractedText(value: string): string {
  return value
    .replace(/\r/g, "")
    .replace(/\u0000/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/([A-Za-zÁÉÍÓÚáéíóúÑñ])-\n(?=[a-záéíóúñ])/g, "$1")
    .trim();
}

function getFileExtension(fileName: string): string {
  const parts = (fileName || "").split(".");
  if (parts.length < 2) return "";
  return parts.pop()!.toLowerCase().trim();
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

function lineFromItems(items: Array<{ str: string; x: number; width: number }>): string {
  const sorted = [...items].sort((a, b) => a.x - b.x);
  let line = "";
  let previousRight: number | null = null;

  for (const item of sorted) {
    const token = `${item.str || ""}`.replace(/\s+/g, " ").trim();
    if (!token) continue;
    if (line && previousRight !== null && item.x - previousRight > 4) line += " ";
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

async function extractDocxText(bytes: Uint8Array): Promise<string> {
  const result = await mammoth.extractRawText({ arrayBuffer: bytes.buffer.slice(0) as ArrayBuffer });
  return cleanExtractedText(result.value || "");
}

async function extractSpreadsheetText(bytes: Uint8Array): Promise<string> {
  const workbook = XLSX.read(bytes, { type: "array" });
  const sections: string[] = [];

  for (const sheetName of workbook.SheetNames.slice(0, 3)) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;
    const csv = XLSX.utils.sheet_to_csv(sheet, { blankrows: false });
    const cleaned = cleanExtractedText(csv);
    if (cleaned.length === 0) continue;
    sections.push(`Hoja: ${sheetName}\n${cleaned}`);
  }

  return sections.join("\n\n").trim();
}

async function extractImageTextWithAI(
  bytes: Uint8Array,
  mimeType: string,
  lovableApiKey: string
): Promise<string> {
  if (!lovableApiKey) {
    throw new Error("Falta LOVABLE_API_KEY para OCR de imagen.");
  }
  if (bytes.length > MAX_OCR_IMAGE_BYTES) {
    throw new Error("La imagen supera el limite de OCR automatico (4 MB).");
  }

  const base64 = bytesToBase64(bytes);
  const body = {
    model: "google/gemini-2.5-flash",
    temperature: 0.1,
    max_tokens: 1200,
    messages: [
      {
        role: "system",
        content:
          "Extrae texto visible de imagenes de material educativo. Devuelve solo texto plano y preserva encabezados y parrafos.",
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Transcribe el texto legible de esta imagen en espanol. Si no hay texto util, responde SOLO: SIN_TEXTO_UTIL",
          },
          {
            type: "image_url",
            image_url: {
              url: `data:${mimeType};base64,${base64}`,
            },
          },
        ],
      },
    ],
  };

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${lovableApiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OCR IA fallo: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content || "";
  const normalized = cleanExtractedText(content);
  if (!normalized || normalized === "SIN_TEXTO_UTIL") {
    throw new Error("No se detecto texto util en la imagen.");
  }
  return normalized;
}

async function extractTextForSource(
  bytes: Uint8Array,
  mediaType: string,
  fileName: string,
  mimeType: string | null,
  lovableApiKey: string
): Promise<ExtractResult> {
  const extension = getFileExtension(fileName);
  const media = (mediaType || "").toUpperCase();

  if (media === "TEXT" || extension === "txt") {
    const decoder = new TextDecoder();
    return { text: cleanExtractedText(decoder.decode(bytes)), extractor: "TEXT_DECODER" };
  }

  if (media === "PDF" || extension === "pdf") {
    return { text: await extractPdfText(bytes), extractor: "PDFJS" };
  }

  if (media === "DOC" || extension === "docx") {
    if (extension === "doc") {
      throw new Error("Formato .doc no soportado en extraccion automatica. Usa .docx.");
    }
    return { text: await extractDocxText(bytes), extractor: "MAMMOTH" };
  }

  if (media === "SHEET" || extension === "xlsx" || extension === "xls") {
    return { text: await extractSpreadsheetText(bytes), extractor: "XLSX" };
  }

  if (media === "IMAGE" || ["jpg", "jpeg", "png"].includes(extension)) {
    const resolvedMime = mimeType && mimeType.length > 0 ? mimeType : "image/jpeg";
    return {
      text: await extractImageTextWithAI(bytes, resolvedMime, lovableApiKey),
      extractor: "AI_OCR",
    };
  }

  throw new Error(`Formato no soportado para extraccion automatica (${media || extension || "desconocido"}).`);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const authHeader = req.headers.get("Authorization");
  const lovableApiKey = Deno.env.get("LOVABLE_API_KEY") || "";

  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "No autorizado" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  const { data: userData, error: userError } = await userClient.auth.getUser(authHeader.replace("Bearer ", ""));
  if (userError || !userData?.user?.id) {
    return new Response(JSON.stringify({ error: "No autorizado" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Body invalido" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const sourceId = (body.source_id || "").trim();
  if (!sourceId) {
    return new Response(JSON.stringify({ error: "source_id es requerido" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: source, error: sourceError } = await userClient
    .from("authorized_sources" as any)
    .select("id, course_id, title, storage_path, media_type, mime_type, status")
    .eq("id", sourceId)
    .single();

  if (sourceError || !source) {
    return new Response(JSON.stringify({ error: "Fuente no encontrada o sin permisos" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!source.storage_path || typeof source.storage_path !== "string") {
    await adminClient
      .from("authorized_sources")
      .update({ status: "FAILED", processing_error: "No hay archivo asociado para procesar." })
      .eq("id", sourceId);

    return new Response(JSON.stringify({ error: "No hay archivo asociado para procesar." }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  await adminClient
    .from("authorized_sources")
    .update({ status: "PROCESSING", processing_error: null })
    .eq("id", sourceId);

  try {
    const { data: fileBlob, error: downloadError } = await adminClient.storage
      .from("authorized-sources")
      .download(source.storage_path);

    if (downloadError || !fileBlob) {
      throw new Error(downloadError?.message || "No se pudo descargar el archivo.");
    }

    const fileBuffer = await fileBlob.arrayBuffer();
    const bytes = new Uint8Array(fileBuffer);
    const extraction = await extractTextForSource(
      bytes,
      source.media_type,
      source.title || "",
      source.mime_type || null,
      lovableApiKey
    );

    const cleaned = cleanExtractedText(extraction.text);
    if (cleaned.length < 80) {
      throw new Error("El texto extraido es demasiado corto para usar como fuente.");
    }

    const summary = normalizeSpaces(cleaned).slice(0, 600);

    await adminClient
      .from("authorized_sources")
      .update({
        status: "PROCESSED",
        extracted_text: cleaned,
        summary_text: summary,
        processing_error: null,
        metadata: {
          processed_at: new Date().toISOString(),
          extractor: extraction.extractor,
        },
      })
      .eq("id", sourceId);

    return new Response(
      JSON.stringify({
        success: true,
        source_id: sourceId,
        extractor: extraction.extractor,
        extracted_characters: cleaned.length,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    await adminClient
      .from("authorized_sources")
      .update({ status: "FAILED", processing_error: message })
      .eq("id", sourceId);

    return new Response(JSON.stringify({ error: message, source_id: sourceId }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
