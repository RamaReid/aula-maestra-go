import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

import {
  corsHeaders,
  createSupabaseClients,
  getAuthenticatedUser,
  getRequiredEnv,
  jsonResponse,
  syncMercadoPagoSubscription,
} from "../_shared/billingCommon.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Metodo no permitido" }, 405);
  }

  try {
    const { user } = await getAuthenticatedUser(req);
    const { userClient, adminClient } = createSupabaseClients(req.headers.get("Authorization"));
    if (!userClient) {
      return jsonResponse({ error: "No autorizado" }, 401);
    }

    const { data: subscription, error: subscriptionError } = await userClient
      .from("subscriptions")
      .select("provider, provider_subscription_id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (subscriptionError) throw subscriptionError;

    let providerSubscriptionId = subscription?.provider_subscription_id || null;

    if (!providerSubscriptionId) {
      const { data: recentEvent, error: eventError } = await adminClient
        .from("billing_events")
        .select("provider_subscription_id")
        .eq("user_id", user.id)
        .eq("provider", "MERCADO_PAGO")
        .not("provider_subscription_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (eventError) throw eventError;
      providerSubscriptionId = (recentEvent?.provider_subscription_id as string | null) || null;
    }

    if (!providerSubscriptionId) {
      return jsonResponse({ error: "No encontramos una suscripcion previa para sincronizar." }, 404);
    }

    const accessToken = getRequiredEnv("MERCADO_PAGO_ACCESS_TOKEN");
    const syncResult = await syncMercadoPagoSubscription(adminClient, accessToken, providerSubscriptionId);

    try {
      await adminClient.from("billing_events").insert({
        user_id: user.id,
        provider: "MERCADO_PAGO",
        event_type: "manual_reconcile",
        provider_event_id: `manual_reconcile:${providerSubscriptionId}:${Date.now()}`,
        provider_subscription_id: providerSubscriptionId,
        payload: {
          resulting_status: syncResult.preapproval.status || null,
          external_reference: syncResult.preapproval.external_reference || null,
        },
        status: "PROCESSED",
        processed_at: new Date().toISOString(),
      });
    } catch (_loggingError) {
      // Manual reconciliation should not fail because audit logging fails.
    }

    return jsonResponse({
      success: true,
      provider: "MERCADO_PAGO",
      provider_subscription_id: providerSubscriptionId,
      status: syncResult.normalizedStatus,
      raw_status: syncResult.preapproval.status || null,
      next_payment_date: syncResult.preapproval.next_payment_date || null,
    });
  } catch (error) {
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Error desconocido al reconciliar billing" },
      error instanceof Error && error.message === "No autorizado" ? 401 : 500
    );
  }
});
