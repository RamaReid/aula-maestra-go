import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/** Detect table-of-contents lines: contain 3+ dots followed by a page number */
function isTocLine(text: string): boolean {
  return /\.{3,}\s*\d+/.test(text);
}

interface ParsedModule {
  moduleName: string;
  children: string[];
}

/**
 * Parse real modules from raw_text.
 * Looks for patterns like "Módulo N", "MÓDULO N", "Módulo N:" followed by content lines.
 * Also handles "Unidad N" patterns.
 * Continuation lines (no bullet, following a bullet) are merged into the previous child.
 */
function parseModulesFromRawText(rawText: string): ParsedModule[] {
  const lines = rawText.split(/\n/);
  const modules: ParsedModule[] = [];
  let currentModule: ParsedModule | null = null;
  let inToc = false;
  let lastChildWasBullet = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      lastChildWasBullet = false;
      continue;
    }

    // Detect TOC section start
    const upperLine = line.toUpperCase();
    if (upperLine === "ÍNDICE" || upperLine === "INDICE" || upperLine === "TABLA DE CONTENIDOS") {
      inToc = true;
      lastChildWasBullet = false;
      continue;
    }

    // Skip TOC lines
    if (isTocLine(line)) {
      inToc = true;
      lastChildWasBullet = false;
      continue;
    }

    // Detect end of TOC: a real heading (Módulo, Unidad, Presentación, etc.)
    const moduleMatch = line.match(/^(M[OÓ]DULO|UNIDAD|BLOQUE)\s+(\d+)\s*[:.–\-]?\s*(.*)/i);
    if (moduleMatch) {
      inToc = false;
      lastChildWasBullet = false;
      const label = `${moduleMatch[1]} ${moduleMatch[2]}`;
      const subtitle = moduleMatch[3]?.trim() || "";
      const fullName = subtitle ? `${label}: ${subtitle}` : label;
      currentModule = { moduleName: fullName, children: [] };
      modules.push(currentModule);
      continue;
    }

    // If we're in TOC or haven't found any module yet, skip
    if (inToc || !currentModule) {
      lastChildWasBullet = false;
      continue;
    }

    // Skip section headers that aren't content
    if (/^(PRESENTACI[OÓ]N|INTRODUCCI[OÓ]N|BIBLIOGRAF[IÍ]A|CRITERIOS DE EVALUACI[OÓ]N|EXPECTATIVAS DE LOGRO)/i.test(line)) {
      lastChildWasBullet = false;
      continue;
    }

    // Detect bullet content lines
    const bulletMatch = line.match(/^[•\-–—]\s*(.+)/);
    if (bulletMatch) {
      const content = bulletMatch[1].trim();
      if (content.length > 5 && !isTocLine(content)) {
        // Si empieza con minúscula → es continuación del bullet anterior (PDF cortó la línea)
        const startsLowercase = /^[a-záéíóúñ]/.test(content);
        if (startsLowercase && lastChildWasBullet && currentModule.children.length > 0) {
          const lastIdx = currentModule.children.length - 1;
          currentModule.children[lastIdx] += " " + content;
        } else {
          currentModule.children.push(content);
          lastChildWasBullet = true;
        }
      }
      continue;
    }

    // Detect numbered content lines (e.g. "1. Something")
    const numberedMatch = line.match(/^\d+[.)]\s+(.+)/);
    if (numberedMatch) {
      const content = numberedMatch[1].trim();
      if (content.length > 5 && !isTocLine(content)) {
        currentModule.children.push(content);
        lastChildWasBullet = true;
      }
      continue;
    }

    // Continuation line: no bullet, follows a bullet child — merge into last child
    if (lastChildWasBullet && currentModule.children.length > 0 && line.length > 3 && !isTocLine(line) && /[a-záéíóúñ]{3,}/i.test(line)) {
      const lastIdx = currentModule.children.length - 1;
      currentModule.children[lastIdx] += " " + line;
      continue;
    }

    // Longer lines that look like content descriptions (not short noise)
    if (line.length > 20 && !isTocLine(line) && !/^(pág|página|\d+$)/i.test(line)) {
      if (/[a-záéíóúñ]{4,}/i.test(line)) {
        currentModule.children.push(line);
        lastChildWasBullet = false;
      }
    }
  }

  return modules.filter(m => m.children.length > 0 || m.moduleName);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const authHeader = req.headers.get("Authorization");

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

  const token = authHeader.replace("Bearer ", "");
  const { data: userData, error: userError } = await userClient.auth.getUser(token);
  if (userError || !userData?.user?.id) {
    return new Response(JSON.stringify({ error: "No autorizado" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: { curriculum_document_id?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Body inválido" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const docId = body.curriculum_document_id?.trim();
  if (!docId) {
    return new Response(JSON.stringify({ error: "curriculum_document_id es obligatorio" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Verify user owns a course linked to this document
  const { data: course } = await userClient
    .from("courses")
    .select("id")
    .eq("curriculum_document_id", docId)
    .eq("user_id", userData.user.id)
    .limit(1)
    .maybeSingle();

  if (!course) {
    return new Response(JSON.stringify({ error: "No se encontró un curso propio con ese documento curricular" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Fetch the document's raw_text
  const { data: doc, error: docError } = await adminClient
    .from("curriculum_documents")
    .select("id, raw_text")
    .eq("id", docId)
    .single();

  if (docError || !doc) {
    return new Response(JSON.stringify({ error: "Documento curricular no encontrado" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!doc.raw_text || doc.raw_text.trim().length < 100) {
    return new Response(JSON.stringify({ error: "El documento no tiene texto extraído suficiente (raw_text vacío o muy corto)" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // Parse modules from raw_text
    const modules = parseModulesFromRawText(doc.raw_text);

    if (modules.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        error: "No se encontraron módulos reales en el texto del documento. El formato del PDF puede no ser compatible con la extracción automática.",
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Delete existing nodes for this document
    await adminClient
      .from("curriculum_nodes")
      .delete()
      .eq("curriculum_document_id", docId);

    // Insert new nodes: one UNIDAD per module, CONTENIDO children
    let orderIndex = 0;
    let totalNodes = 0;

    for (const mod of modules) {
      // Insert module as UNIDAD
      const { data: unitNode, error: unitError } = await adminClient
        .from("curriculum_nodes")
        .insert({
          curriculum_document_id: docId,
          name: mod.moduleName,
          node_type: "UNIDAD",
          parent_id: null,
          order_index: orderIndex++,
        })
        .select("id")
        .single();

      if (unitError || !unitNode) {
        console.error("Error inserting unit:", unitError);
        continue;
      }
      totalNodes++;

      // Insert children as CONTENIDO
      for (const child of mod.children) {
        const { error: childError } = await adminClient
          .from("curriculum_nodes")
          .insert({
            curriculum_document_id: docId,
            name: child,
            node_type: "CONTENIDO",
            parent_id: unitNode.id,
            order_index: orderIndex++,
          });

        if (childError) {
          console.error("Error inserting content:", childError);
          continue;
        }
        totalNodes++;
      }
    }

    return new Response(JSON.stringify({
      success: true,
      modules_found: modules.length,
      total_nodes_created: totalNodes,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Error desconocido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
