import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import {
  CurriculumCycle,
  ingestCurriculumDocument,
  SchoolType,
} from "../_shared/curriculumImport.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type RequestBody = {
  file_name?: string;
  file_base64?: string;
  province?: string;
  subject?: string;
  cycle?: CurriculumCycle;
  year_level?: number;
  school_type?: SchoolType | null;
  orientation?: string | null;
  speciality?: string | null;
  official_title?: string | null;
  official_url?: string | null;
  source_provider?: string | null;
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

  if ((!body.file_base64 && !body.official_url) || !body.subject || !body.cycle || !body.year_level) {
    return new Response(
      JSON.stringify({ error: "Debe enviar file_base64 u official_url, ademas de subject, cycle y year_level" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  try {
    const result = await ingestCurriculumDocument(adminClient, {
      file_name: body.file_name ?? null,
      file_base64: body.file_base64 ?? null,
      province: body.province || "PBA",
      subject: body.subject,
      cycle: body.cycle,
      year_level: body.year_level,
      school_type: body.school_type ?? null,
      orientation: body.orientation ?? null,
      speciality: body.speciality ?? null,
      official_title: body.official_title ?? null,
      official_url: body.official_url ?? null,
      allow_external_url: true,
      source_provider: body.source_provider ?? null,
    });

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
