import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

export type PaidPlanType = "BASICO" | "PREMIUM";
export type InternalSubscriptionStatus = "ACTIVE" | "CANCELED" | "EXPIRED";
export type MercadoPagoPreapproval = {
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

interface MercadoPagoPlanConfig {
  planType: PaidPlanType;
  amount: number;
  currencyId: string;
  reason: string;
  frequency: number;
  frequencyType: "months";
}

export function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function getRequiredEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) {
    throw new Error(`Missing required env: ${name}`);
  }
  return value;
}

export function getOptionalEnv(name: string): string | null {
  const value = Deno.env.get(name);
  return value ? value : null;
}

export function getMercadoPagoPlanConfig(planType: PaidPlanType): MercadoPagoPlanConfig {
  const currencyId = getOptionalEnv("MERCADO_PAGO_CURRENCY_ID") || "ARS";
  const amountEnv =
    planType === "BASICO" ? getRequiredEnv("MERCADO_PAGO_BASICO_PRICE_ARS") : getRequiredEnv("MERCADO_PAGO_PREMIUM_PRICE_ARS");
  const amount = Number(amountEnv);

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error(`Invalid amount for plan ${planType}`);
  }

  const reasonPrefix = getOptionalEnv("MERCADO_PAGO_REASON_PREFIX") || "DocencIA";

  return {
    planType,
    amount,
    currencyId,
    reason: `${reasonPrefix} ${planType} mensual`,
    frequency: 1,
    frequencyType: "months",
  };
}

export function deriveAppBaseUrl(req: Request): string {
  const configured = getOptionalEnv("APP_BASE_URL");
  if (configured) {
    const parsed = new URL(configured);
    if (parsed.protocol !== "https:") {
      throw new Error("APP_BASE_URL must use https");
    }
    return parsed.origin;
  }

  const originHeader = req.headers.get("origin");
  if (!originHeader) {
    throw new Error("Missing APP_BASE_URL and request origin");
  }

  const parsed = new URL(originHeader);
  if (parsed.protocol !== "https:" && parsed.hostname !== "localhost" && parsed.hostname !== "127.0.0.1") {
    throw new Error("Origin must use https in production");
  }

  return parsed.origin;
}

export function deriveFunctionsBaseUrl(req: Request): string {
  const current = new URL(req.url);
  const index = current.pathname.lastIndexOf("/");
  if (index < 0) throw new Error("Invalid function URL");
  return `${current.origin}${current.pathname.slice(0, index)}`;
}

export function buildCheckoutBackUrl(appBaseUrl: string, planType: PaidPlanType): string {
  const url = new URL("/billing", appBaseUrl);
  url.searchParams.set("checkout", "mercadopago");
  url.searchParams.set("plan", planType);
  return url.toString();
}

export function buildExternalReference(userId: string, planType: PaidPlanType): string {
  return `${userId}:${planType}:${crypto.randomUUID()}`;
}

export function parsePlanType(value: unknown): PaidPlanType | null {
  if (value === "BASICO" || value === "PREMIUM") return value;
  return null;
}

export function deriveUserAndPlanFromExternalReference(externalReference: string | null | undefined) {
  if (!externalReference) return { userId: null, planType: null };
  const [userId, rawPlanType] = externalReference.split(":", 3);
  const planType = parsePlanType(rawPlanType);
  return { userId: userId || null, planType };
}

export function parseSignatureHeader(headerValue: string | null): { ts: string | null; v1: string | null } {
  if (!headerValue) return { ts: null, v1: null };

  const parts = headerValue.split(",").map((part) => part.trim());
  let ts: string | null = null;
  let v1: string | null = null;

  for (const part of parts) {
    const [key, value] = part.split("=", 2);
    if (key === "ts") ts = value || null;
    if (key === "v1") v1 = value || null;
  }

  return { ts, v1 };
}

async function hmacSha256Hex(secret: string, value: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function extractWebhookTopic(url: URL, body: Record<string, unknown>): string {
  const raw =
    url.searchParams.get("type") ||
    url.searchParams.get("topic") ||
    (typeof body.type === "string" ? body.type : null) ||
    (typeof body.topic === "string" ? body.topic : null) ||
    (typeof body.action === "string" ? body.action : null) ||
    "unknown";

  return raw.toLowerCase();
}

export function extractWebhookDataId(url: URL, body: Record<string, unknown>): string | null {
  const queryDataId = url.searchParams.get("data.id");
  if (queryDataId) return queryDataId;

  const directBodyData = body.data;
  if (directBodyData && typeof directBodyData === "object" && "id" in directBodyData) {
    const dataId = (directBodyData as { id?: unknown }).id;
    if (typeof dataId === "string" || typeof dataId === "number") {
      return String(dataId);
    }
  }

  if (typeof body["data.id"] === "string" || typeof body["data.id"] === "number") {
    return String(body["data.id"]);
  }

  return null;
}

export async function validateMercadoPagoSignature(
  req: Request,
  body: Record<string, unknown>,
  secret: string
): Promise<boolean> {
  const signatureHeader = req.headers.get("x-signature");
  const requestId = req.headers.get("x-request-id");
  const { ts, v1 } = parseSignatureHeader(signatureHeader);
  const url = new URL(req.url);
  const dataId = extractWebhookDataId(url, body);

  if (!ts || !v1 || !requestId || !dataId) {
    return false;
  }

  const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
  const expected = await hmacSha256Hex(secret, manifest);
  return expected.toLowerCase() === v1.toLowerCase();
}

export function normalizeMercadoPagoSubscriptionStatus(value: string | null | undefined): InternalSubscriptionStatus | null {
  const status = (value || "").toLowerCase();

  switch (status) {
    case "authorized":
      return "ACTIVE";
    case "paused":
    case "cancelled":
    case "canceled":
      return "CANCELED";
    case "expired":
      return "EXPIRED";
    default:
      return null;
  }
}

export async function fetchMercadoPagoJson<T>(
  accessToken: string,
  path: string,
  init?: RequestInit
): Promise<T> {
  const response = await fetch(`https://api.mercadopago.com${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && "message" in payload && typeof payload.message === "string"
        ? payload.message
        : `Mercado Pago API error ${response.status}`;
    throw new Error(message);
  }

  return payload as T;
}

export function createSupabaseClients(authHeader?: string | null) {
  const supabaseUrl = getRequiredEnv("SUPABASE_URL");
  const anonKey = getRequiredEnv("SUPABASE_ANON_KEY");
  const serviceRoleKey = getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY");

  const userClient = authHeader
    ? createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      })
    : null;
  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  return { userClient, adminClient };
}

export async function getAuthenticatedUser(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new Error("No autorizado");
  }

  const { userClient } = createSupabaseClients(authHeader);
  if (!userClient) throw new Error("No autorizado");

  const { data, error } = await userClient.auth.getUser(authHeader.replace("Bearer ", ""));
  if (error || !data?.user) {
    throw new Error("No autorizado");
  }

  return { user: data.user, authHeader };
}

export async function syncMercadoPagoSubscription(
  adminClient: any,
  accessToken: string,
  providerSubscriptionId: string
): Promise<{
  preapproval: MercadoPagoPreapproval;
  userId: string;
  planType: PaidPlanType;
  normalizedStatus: InternalSubscriptionStatus;
}> {
  const preapproval = await fetchMercadoPagoJson<MercadoPagoPreapproval>(accessToken, `/preapproval/${providerSubscriptionId}`, {
    method: "GET",
  });

  const { userId, planType } = deriveUserAndPlanFromExternalReference(preapproval.external_reference);
  const normalizedStatus = normalizeMercadoPagoSubscriptionStatus(preapproval.status);

  if (!userId || !planType) {
    throw new Error("No se pudo resolver user_id o plan_type desde external_reference");
  }

  if (!normalizedStatus) {
    throw new Error(`Estado no sincronizable: ${preapproval.status || "unknown"}`);
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

  return {
    preapproval,
    userId,
    planType,
    normalizedStatus,
  };
}
