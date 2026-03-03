import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const QA_EMAIL = "rgarciareid@gmail.com";
const ALLOWED_PLANS = new Set(["FREE", "BASICO", "PREMIUM"]);

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "No autorizado" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  const { data: userData, error: userError } = await userClient.auth.getUser(
    authHeader.replace("Bearer ", "")
  );
  if (userError || !userData?.user) {
    return new Response(JSON.stringify({ error: "No autorizado" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if ((userData.user.email || "").toLowerCase() !== QA_EMAIL) {
    return new Response(JSON.stringify({ error: "No autorizado para cambiar planes de prueba" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: { plan_type?: "FREE" | "BASICO" | "PREMIUM" };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Body invalido" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!body.plan_type || !ALLOWED_PLANS.has(body.plan_type)) {
    return new Response(JSON.stringify({ error: "plan_type invalido" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const currentMonday = new Date();
  const day = currentMonday.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  currentMonday.setUTCDate(currentMonday.getUTCDate() + diff);
  currentMonday.setUTCHours(0, 0, 0, 0);
  const weekStartDate = currentMonday.toISOString().slice(0, 10);

  try {
    const { error: upsertSubscriptionError } = await adminClient
      .from("subscriptions")
      .upsert(
        {
          user_id: userData.user.id,
          plan_type: body.plan_type,
          status: "ACTIVE",
        },
        { onConflict: "user_id" }
      );
    if (upsertSubscriptionError) throw upsertSubscriptionError;

    const { error: entitlementsError } = await adminClient.rpc("recalculate_entitlements", {
      p_user_id: userData.user.id,
      p_plan: body.plan_type,
    });
    if (entitlementsError) throw entitlementsError;

    const { error: usageError } = await adminClient
      .from("usage_counters")
      .upsert(
        {
          user_id: userData.user.id,
          week_start_date: weekStartDate,
          sessions_used_this_week: 0,
        },
        { onConflict: "user_id" }
      );
    if (usageError) throw usageError;

    return new Response(
      JSON.stringify({
        success: true,
        plan_type: body.plan_type,
        week_start_date: weekStartDate,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Error desconocido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
