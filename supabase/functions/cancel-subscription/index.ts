import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

import {
  corsHeaders,
  createSupabaseClients,
  fetchMercadoPagoJson,
  getAuthenticatedUser,
  getRequiredEnv,
  jsonResponse,
  syncMercadoPagoSubscription,
} from "../_shared/billingCommon.ts";

type MercadoPagoCancelResponse = {
  id: string;
  status?: string | null;
};

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
      .select("plan_type, status, provider, provider_subscription_id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (subscriptionError) throw subscriptionError;

    if (!subscription?.provider_subscription_id || subscription.provider !== "MERCADO_PAGO") {
      return jsonResponse({ error: "No hay una suscripcion automatica gestionable para esta cuenta." }, 409);
    }

    if (subscription.status !== "ACTIVE") {
      return jsonResponse({ error: "La suscripcion ya no esta activa." }, 409);
    }

    const accessToken = getRequiredEnv("MERCADO_PAGO_ACCESS_TOKEN");
    const providerSubscriptionId = subscription.provider_subscription_id;

    await fetchMercadoPagoJson<MercadoPagoCancelResponse>(accessToken, `/preapproval/${providerSubscriptionId}`, {
      method: "PUT",
      body: JSON.stringify({ status: "cancelled" }),
    });

    const syncResult = await syncMercadoPagoSubscription(adminClient as any, accessToken, providerSubscriptionId);

    try {
      await adminClient.from("billing_events").insert({
        user_id: user.id,
        provider: "MERCADO_PAGO",
        event_type: "manual_cancel",
        provider_event_id: `manual_cancel:${providerSubscriptionId}:${Date.now()}`,
        provider_subscription_id: providerSubscriptionId,
        payload: {
          plan_type: subscription.plan_type,
          resulting_status: syncResult.preapproval.status || null,
        },
        status: "PROCESSED",
        processed_at: new Date().toISOString(),
      });
    } catch (_loggingError) {
      // Manual cancellation should not fail because audit logging fails.
    }

    return jsonResponse({
      success: true,
      provider: "MERCADO_PAGO",
      provider_subscription_id: providerSubscriptionId,
      status: syncResult.normalizedStatus,
      raw_status: syncResult.preapproval.status || null,
      effective_immediately: true,
    });
  } catch (error) {
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Error desconocido al cancelar la suscripcion" },
      error instanceof Error && error.message === "No autorizado" ? 401 : 500
    );
  }
});
