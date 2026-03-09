import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import {
  ingestCurriculumDocument,
  repairCurriculumDocumentNodes,
} from "../_shared/curriculumImport.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type RequestBody = {
  course_id?: string;
  curriculum_document_id?: string;
};

/**
 * Known official PDF URLs for PBA curriculum documents that may have been
 * seeded without raw_text.  Keyed by `subject|cycle|year_level`.
 */
const KNOWN_OFFICIAL_URLS: Record<string, string> = {
  "Historia|UPPER|5": "https://abc.gob.ar/secretarias/sites/default/files/2021-05/Historia%20%281%29.pdf",
  "Matemática|UPPER|5": "https://abc.gob.ar/secretarias/sites/default/files/2021-05/Matem%C3%A1tica%20%281%29.pdf",
  "Matemática|UPPER|6": "https://abc.gob.ar/secretarias/sites/default/files/2021-05/Matem%C3%A1tica%20%282%29.pdf",
  "Filosofía|UPPER|6": "https://abc.gob.ar/secretarias/sites/default/files/2021-05/Filosof%C3%ADa.pdf",
  "Filosofía e Historia de la Ciencia y la Tecnología|UPPER|6":
    "https://abc.gob.ar/secretarias/sites/default/files/2021-05/Filosof%C3%ADa%20e%20Histria%20de%20la%20Ciencia%20y%20la%20Tecnolog%C3%ADa.pdf",
};

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

  const { data: userData, error: userError } = await userClient.auth.getUser(
    authHeader.replace("Bearer ", "")
  );
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

  const courseId = body.course_id?.trim();
  if (!courseId) {
    return new Response(JSON.stringify({ error: "course_id es obligatorio" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: course, error: courseError } = await userClient
    .from("courses")
    .select("id, curriculum_document_id")
    .eq("id", courseId)
    .eq("user_id", userData.user.id)
    .maybeSingle();

  if (courseError) {
    return new Response(JSON.stringify({ error: courseError.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (!course?.curriculum_document_id) {
    return new Response(JSON.stringify({ error: "El curso no tiene curriculum_document_id asociado." }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // Check if document has raw_text
    const { data: doc } = await adminClient
      .from("curriculum_documents")
      .select("id, raw_text, subject, cycle, year_level")
      .eq("id", course.curriculum_document_id)
      .maybeSingle();

    const hasRawText = doc?.raw_text && doc.raw_text.trim().length >= 500;

    if (!hasRawText && doc) {
      // Try to re-ingest from known official URL
      const key = `${doc.subject}|${doc.cycle}|${doc.year_level}`;
      const officialUrl = KNOWN_OFFICIAL_URLS[key];

      if (officialUrl) {
        console.log(`[repair-bibliography] Re-ingesting from official URL: ${key}`);
        const ingestResult = await ingestCurriculumDocument(adminClient, {
          subject: doc.subject,
          cycle: doc.cycle,
          year_level: doc.year_level,
          official_url: officialUrl,
          source_provider: "ABC_PBA_WEB",
          allow_external_url: false,
        });

        return new Response(
          JSON.stringify({
            success: true,
            re_ingested: true,
            node_count: ingestResult.node_count,
            bibliography_count: 0,
            raw_text_length: ingestResult.raw_text_length,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          success: false,
          error: "El documento curricular no tiene raw_text y no se encontro URL oficial conocida para re-importar.",
        }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const result = await repairCurriculumDocumentNodes(adminClient, course.curriculum_document_id);
    return new Response(JSON.stringify({ success: true, ...result }), {
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
