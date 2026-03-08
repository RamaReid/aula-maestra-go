import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

import {
  corsHeaders,
  createSupabaseClients,
  extractWebhookDataId,
  extractWebhookTopic,
  getRequiredEnv,
  jsonResponse,
  syncMercadoPagoSubscription,
  validateMercadoPagoSignature,
} from "../_shared/billingCommon.ts";

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

    const { preapproval, userId } = await syncMercadoPagoSubscription(adminClient as any, accessToken, dataId);

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
