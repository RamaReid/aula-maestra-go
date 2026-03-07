import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

import {
  buildCheckoutBackUrl,
  buildExternalReference,
  corsHeaders,
  createSupabaseClients,
  deriveAppBaseUrl,
  deriveFunctionsBaseUrl,
  fetchMercadoPagoJson,
  getAuthenticatedUser,
  getMercadoPagoPlanConfig,
  getRequiredEnv,
  jsonResponse,
  parsePlanType,
} from "../_shared/billingCommon.ts";

type RequestBody = {
  plan_type?: "BASICO" | "PREMIUM";
};

type MercadoPagoPreapprovalResponse = {
  id: string;
  init_point?: string | null;
  sandbox_init_point?: string | null;
  payer_email?: string | null;
  status?: string | null;
  external_reference?: string | null;
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

    let body: RequestBody;
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: "Body invalido" }, 400);
    }

    const planType = parsePlanType(body.plan_type);
    if (!planType) {
      return jsonResponse({ error: "plan_type invalido" }, 400);
    }

    const { data: currentSubscription, error: currentSubscriptionError } = await userClient
      .from("subscriptions")
      .select("plan_type, status")
      .eq("user_id", user.id)
      .maybeSingle();
    if (currentSubscriptionError) {
      throw currentSubscriptionError;
    }

    if (currentSubscription?.status === "ACTIVE" && currentSubscription.plan_type === planType) {
      return jsonResponse({ error: "Tu cuenta ya tiene ese plan activo." }, 409);
    }

    const accessToken = getRequiredEnv("MERCADO_PAGO_ACCESS_TOKEN");
    const webhookSecret = getRequiredEnv("MERCADO_PAGO_WEBHOOK_SECRET");
    if (!webhookSecret) {
      return jsonResponse({ error: "Billing no configurado correctamente." }, 500);
    }

    const planConfig = getMercadoPagoPlanConfig(planType);
    const appBaseUrl = deriveAppBaseUrl(req);
    const functionsBaseUrl = deriveFunctionsBaseUrl(req);
    const backUrl = buildCheckoutBackUrl(appBaseUrl, planType);
    const notificationUrl = `${functionsBaseUrl}/billing-webhook`;
    const externalReference = buildExternalReference(user.id, planType);
    const idempotencyKey = crypto.randomUUID();

    const payload = {
      reason: planConfig.reason,
      external_reference: externalReference,
      payer_email: user.email,
      back_url: backUrl,
      notification_url: notificationUrl,
      status: "pending",
      auto_recurring: {
        frequency: planConfig.frequency,
        frequency_type: planConfig.frequencyType,
        transaction_amount: planConfig.amount,
        currency_id: planConfig.currencyId,
      },
    };

    const preapproval = await fetchMercadoPagoJson<MercadoPagoPreapprovalResponse>(accessToken, "/preapproval", {
      method: "POST",
      headers: {
        "X-Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify(payload),
    });

    const checkoutUrl = preapproval.init_point || preapproval.sandbox_init_point;
    if (!checkoutUrl) {
      throw new Error("Mercado Pago no devolvio init_point");
    }

    try {
      await adminClient.from("billing_events").insert({
        user_id: user.id,
        provider: "MERCADO_PAGO",
        event_type: "checkout_requested",
        provider_event_id: `checkout:${preapproval.id}`,
        provider_subscription_id: preapproval.id,
        payload: {
          plan_type: planType,
          external_reference: externalReference,
          checkout_url: checkoutUrl,
          status: preapproval.status || "pending",
        },
        status: "PROCESSED",
        processed_at: new Date().toISOString(),
      });
    } catch (_loggingError) {
      // Checkout should continue even if audit logging fails.
    }

    return jsonResponse({
      checkout_url: checkoutUrl,
      provider: "MERCADO_PAGO",
      provider_subscription_id: preapproval.id,
      external_reference: externalReference,
      plan_type: planType,
    });
  } catch (error) {
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Error desconocido al iniciar checkout" },
      error instanceof Error && error.message === "No autorizado" ? 401 : 500
    );
  }
});
