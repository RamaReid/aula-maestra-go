import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

import {
  corsHeaders,
  createSupabaseClients,
  extractWebhookDataId,
  extractWebhookTopic,
  fetchMercadoPagoJson,
  getRequiredEnv,
  jsonResponse,
  normalizeMercadoPagoSubscriptionStatus,
  parsePlanType,
  validateMercadoPagoSignature,
} from "../_shared/billingCommon.ts";

type MercadoPagoPreapproval = {
  id: string;
  payer_id?: string | number | null;
  payer_email?: string | null;
  external_reference?: string | null;
  status?: string | null;
  reason?: string | null;
  date_created?: string | null;
  last_modified?: string | null;
  next_payment_date?: string | null;
  preapproval_plan_id?: string | null;
  auto_recurring?: {
    transaction_amount?: number | null;
    currency_id?: string | null;
    frequency?: number | null;
    frequency_type?: string | null;
  } | null;
};

function deriveUserAndPlanFromExternalReference(externalReference: string | null | undefined) {
  if (!externalReference) return { userId: null, planType: null };
  const [userId, rawPlanType] = externalReference.split(":", 3);
  const planType = parsePlanType(rawPlanType);
  return { userId: userId || null, planType };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Metodo no permitido" }, 405);
  }

  const accessToken = getRequiredEnv("MERCADO_PAGO_ACCESS_TOKEN");
  const webhookSecret = getRequiredEnv("MERCADO_PAGO_WEBHOOK_SECRET");
  const { adminClient } = createSupabaseClients();

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const url = new URL(req.url);
  const topic = extractWebhookTopic(url, body);
  const dataId = extractWebhookDataId(url, body);
  const action = typeof body.action === "string" ? body.action : "unknown";
  const providerEventId = typeof body.id === "number" || typeof body.id === "string" ? String(body.id) : dataId ? `${topic}:${dataId}:${action}` : null;

  const signatureIsValid = await validateMercadoPagoSignature(req, body, webhookSecret);
  if (!signatureIsValid) {
    return jsonResponse({ error: "Firma invalida" }, 401);
  }

  let eventId: string | null = null;
  try {
    if (providerEventId) {
      const { data: existingEvent } = await adminClient
        .from("billing_events")
        .select("id, status")
        .eq("provider", "MERCADO_PAGO")
        .eq("provider_event_id", providerEventId)
        .maybeSingle();

      if (existingEvent?.status === "PROCESSED") {
        return jsonResponse({ received: true, duplicated: true });
      }

      if (existingEvent?.id) {
        eventId = existingEvent.id;
      }
    }

    if (!eventId) {
      const { data: insertedEvent, error: insertError } = await adminClient
        .from("billing_events")
        .insert({
          provider: "MERCADO_PAGO",
          event_type: topic,
          provider_event_id: providerEventId,
          provider_subscription_id: dataId,
          payload: body,
          status: "RECEIVED",
        })
        .select("id")
        .single();

      if (insertError) throw insertError;
      eventId = insertedEvent.id as string;
    }

    if (!dataId) {
      await adminClient
        .from("billing_events")
        .update({
          status: "IGNORED",
          processed_at: new Date().toISOString(),
          error_message: "Notification without data.id",
        })
        .eq("id", eventId);

      return jsonResponse({ received: true, ignored: true });
    }

    const isSubscriptionTopic =
      topic.includes("subscription") ||
      topic.includes("preapproval");

    if (!isSubscriptionTopic) {
      await adminClient
        .from("billing_events")
        .update({
          status: "IGNORED",
          processed_at: new Date().toISOString(),
          error_message: `Topic ${topic} logged without subscription sync`,
        })
        .eq("id", eventId);

      return jsonResponse({ received: true, ignored: true });
    }

    const preapproval = await fetchMercadoPagoJson<MercadoPagoPreapproval>(accessToken, `/preapproval/${dataId}`, {
      method: "GET",
    });

    const { userId, planType } = deriveUserAndPlanFromExternalReference(preapproval.external_reference);
    const normalizedStatus = normalizeMercadoPagoSubscriptionStatus(preapproval.status);

    if (!userId || !planType) {
      throw new Error("No se pudo resolver user_id o plan_type desde external_reference");
    }

    if (!normalizedStatus) {
      await adminClient
        .from("billing_events")
        .update({
          status: "IGNORED",
          processed_at: new Date().toISOString(),
          payload: {
            webhook: body,
            preapproval,
          },
          error_message: `Estado no sincronizable: ${preapproval.status || "unknown"}`,
        })
        .eq("id", eventId);

      return jsonResponse({ received: true, ignored: true, status: preapproval.status || "unknown" });
    }

    const { error: upsertError } = await adminClient.rpc("admin_upsert_billing_subscription", {
      p_user_id: userId,
      p_plan: planType,
      p_status: normalizedStatus,
      p_provider: "MERCADO_PAGO",
      p_provider_customer_id: preapproval.payer_id ? String(preapproval.payer_id) : null,
      p_provider_subscription_id: preapproval.id,
      p_provider_plan_id: preapproval.preapproval_plan_id || null,
      p_billing_email: preapproval.payer_email || null,
      p_current_period_start: preapproval.last_modified || preapproval.date_created || null,
      p_current_period_end: preapproval.next_payment_date || null,
      p_cancel_at_period_end: false,
      p_last_payment_status: preapproval.status || null,
      p_last_payment_at: preapproval.last_modified || null,
      p_last_invoice_url: null,
      p_metadata: {
        external_reference: preapproval.external_reference || null,
        raw_status: preapproval.status || null,
        reason: preapproval.reason || null,
        auto_recurring: preapproval.auto_recurring || null,
      },
    });
    if (upsertError) throw upsertError;

    await adminClient
      .from("billing_events")
      .update({
        user_id: userId,
        status: "PROCESSED",
        processed_at: new Date().toISOString(),
        provider_subscription_id: preapproval.id,
        payload: {
          webhook: body,
          preapproval,
        },
        error_message: null,
      })
      .eq("id", eventId);

    return jsonResponse({ received: true, processed: true });
  } catch (error) {
    if (eventId) {
      await adminClient
        .from("billing_events")
        .update({
          status: "FAILED",
          processed_at: new Date().toISOString(),
          error_message: error instanceof Error ? error.message : "Error desconocido",
        })
        .eq("id", eventId);
    }

    return jsonResponse(
      { error: error instanceof Error ? error.message : "Error procesando webhook" },
      500
    );
  }
});
