import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowLeft, CreditCard, Landmark, Loader2 } from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { PlanType, useEntitlements } from "@/hooks/useEntitlements";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useToast } from "@/components/ui/use-toast";

interface SubscriptionRow {
  plan_type: PlanType;
  status: "ACTIVE" | "CANCELED" | "EXPIRED";
  start_date: string | null;
  end_date: string | null;
  updated_at: string;
}

interface ManualPaymentRequestRow {
  id: string;
  requested_plan: PlanType;
  status: "PENDING_REVIEW" | "APPROVED" | "REJECTED" | "EXPIRED";
  billing_name: string | null;
  tax_id: string | null;
  notes: string | null;
  review_notes: string | null;
  created_at: string;
}

const planCardCopy: Record<
  PlanType,
  {
    title: string;
    summary: string;
    bullets: string[];
  }
> = {
  FREE: {
    title: "Gratis",
    summary: "Para probar el flujo principal con limites acotados.",
    bullets: ["1 curso activo", "2 sesiones semanales", "3 clases por sesion", "Sin exportacion PDF validada"],
  },
  BASICO: {
    title: "Basico",
    summary: "Operacion docente diaria con cursos multiples y exportacion.",
    bullets: ["Hasta 15 cursos", "Secuencias consecutivas", "PDF validado", "Fuentes propias por archivo"],
  },
  PREMIUM: {
    title: "Premium",
    summary: "Mayor profundidad, fuentes online y copiloto completo.",
    bullets: ["Todo Basico", "Fuentes por URL y video", "Busqueda asistida", "Copiloto full"],
  },
};

function formatDate(value: string | null | undefined): string {
  if (!value) return "Sin fecha";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sin fecha";
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function subscriptionTone(status: string): "success" | "warning" | "danger" | "neutral" {
  switch (status) {
    case "ACTIVE":
      return "success";
    case "CANCELED":
      return "warning";
    case "EXPIRED":
      return "danger";
    default:
      return "neutral";
  }
}

function subscriptionLabel(status: string): string {
  switch (status) {
    case "ACTIVE":
      return "Activa";
    case "CANCELED":
      return "Cancelada";
    case "EXPIRED":
      return "Vencida";
    default:
      return status;
  }
}

function manualRequestTone(status: string): "success" | "warning" | "danger" | "neutral" {
  switch (status) {
    case "APPROVED":
      return "success";
    case "PENDING_REVIEW":
      return "warning";
    case "REJECTED":
    case "EXPIRED":
      return "danger";
    default:
      return "neutral";
  }
}

function manualRequestLabel(status: string): string {
  switch (status) {
    case "PENDING_REVIEW":
      return "Pendiente";
    case "APPROVED":
      return "Aprobada";
    case "REJECTED":
      return "Rechazada";
    case "EXPIRED":
      return "Vencida";
    default:
      return status;
  }
}

export default function Billing() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const { planType, entitlements } = useEntitlements();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [checkingOutPlan, setCheckingOutPlan] = useState<"BASICO" | "PREMIUM" | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionRow | null>(null);
  const [requests, setRequests] = useState<ManualPaymentRequestRow[]>([]);
  const [requestedPlan, setRequestedPlan] = useState<"BASICO" | "PREMIUM">("BASICO");
  const [billingName, setBillingName] = useState("");
  const [taxId, setTaxId] = useState("");
  const [notes, setNotes] = useState("");
  const checkoutToastShownRef = useRef(false);

  const fetchBillingData = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    setLoading(true);

    const [subscriptionRes, requestsRes] = await Promise.all([
      supabase
        .from("subscriptions")
        .select("plan_type, status, start_date, end_date, updated_at")
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("manual_payment_requests" as any)
        .select("id, requested_plan, status, billing_name, tax_id, notes, review_notes, created_at")
        .order("created_at", { ascending: false }),
    ]);

    setSubscription((subscriptionRes.data as SubscriptionRow | null) || null);
    setRequests((requestsRes.data as unknown as ManualPaymentRequestRow[] | null) || []);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchBillingData();
  }, [fetchBillingData]);

  useEffect(() => {
    if (checkoutToastShownRef.current) return;
    if (searchParams.get("checkout") !== "mercadopago") return;

    checkoutToastShownRef.current = true;
    const returnedPlan = searchParams.get("plan");
    toast({
      title: "Estamos confirmando tu suscripcion",
      description:
        returnedPlan === "BASICO" || returnedPlan === "PREMIUM"
          ? `Mercado Pago redirigio correctamente. Estamos esperando la confirmacion final para ${returnedPlan}.`
          : "Mercado Pago redirigio correctamente. Estamos esperando la confirmacion final.",
    });
  }, [searchParams, toast]);

  const currentPlanCopy = useMemo(() => planCardCopy[planType], [planType]);

  const handleCheckout = async (nextPlan: "BASICO" | "PREMIUM") => {
    setCheckingOutPlan(nextPlan);
    try {
      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: { plan_type: nextPlan },
      });

      if (error) throw error;
      if (!data?.checkout_url) {
        throw new Error("No se pudo obtener la URL de checkout.");
      }

      window.location.href = data.checkout_url as string;
    } catch (error) {
      toast({
        title: "No se pudo iniciar el checkout",
        description: error instanceof Error ? error.message : "Error desconocido",
        variant: "destructive",
      });
      setCheckingOutPlan(null);
    }
  };

  const handleManualRequest = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!user) return;

    setSubmitting(true);
    try {
      const { error } = await supabase.from("manual_payment_requests" as any).insert({
        user_id: user.id,
        requested_plan: requestedPlan,
        requested_provider: "MANUAL",
        status: "PENDING_REVIEW",
        billing_name: billingName.trim() || null,
        tax_id: taxId.trim() || null,
        notes: notes.trim() || null,
      });

      if (error) throw error;

      setBillingName("");
      setTaxId("");
      setNotes("");
      await fetchBillingData();

      toast({
        title: "Solicitud enviada",
        description: "Quedo registrada para revision manual en billing.",
      });
    } catch (error) {
      toast({
        title: "No se pudo registrar la solicitud",
        description: error instanceof Error ? error.message : "Error desconocido",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <div>
            <p className="text-sm text-muted-foreground">Facturacion y planes</p>
            <h1 className="text-lg font-semibold text-foreground">Billing</h1>
          </div>
          <Button asChild variant="ghost" size="sm">
            <Link to="/dashboard">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver
            </Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto grid max-w-5xl gap-6 px-4 py-8 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Estado actual</CardTitle>
              <CardDescription>Resumen del plan que hoy esta habilitado para tu cuenta.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {loading ? (
                <div className="flex items-center text-sm text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Cargando estado de billing
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap items-center gap-3">
                    <StatusBadge tone="neutral" label={planType} />
                    <StatusBadge
                      tone={subscriptionTone(subscription?.status || "ACTIVE")}
                      label={subscriptionLabel(subscription?.status || "ACTIVE")}
                    />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="rounded-lg border p-4">
                      <p className="text-sm font-medium text-foreground">Titular</p>
                      <p className="mt-1 text-sm text-muted-foreground">{profile?.email || "Sin email"}</p>
                    </div>
                    <div className="rounded-lg border p-4">
                      <p className="text-sm font-medium text-foreground">Inicio del plan</p>
                      <p className="mt-1 text-sm text-muted-foreground">{formatDate(subscription?.start_date)}</p>
                    </div>
                    <div className="rounded-lg border p-4">
                      <p className="text-sm font-medium text-foreground">Fin o corte actual</p>
                      <p className="mt-1 text-sm text-muted-foreground">{formatDate(subscription?.end_date)}</p>
                    </div>
                    <div className="rounded-lg border p-4">
                      <p className="text-sm font-medium text-foreground">Ultima actualizacion</p>
                      <p className="mt-1 text-sm text-muted-foreground">{formatDate(subscription?.updated_at)}</p>
                    </div>
                  </div>

                  <div className="rounded-lg border bg-muted/30 p-4">
                    <p className="text-sm font-medium text-foreground">{currentPlanCopy.title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{currentPlanCopy.summary}</p>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-md bg-background p-3">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Cursos</p>
                        <p className="mt-1 text-sm text-foreground">{entitlements.max_courses}</p>
                      </div>
                      <div className="rounded-md bg-background p-3">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Sesiones por semana</p>
                        <p className="mt-1 text-sm text-foreground">{entitlements.max_weekly_sessions}</p>
                      </div>
                      <div className="rounded-md bg-background p-3">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Clases por sesion</p>
                        <p className="mt-1 text-sm text-foreground">{entitlements.max_classes_per_session}</p>
                      </div>
                      <div className="rounded-md bg-background p-3">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Storage persistente</p>
                        <p className="mt-1 text-sm text-foreground">
                          {entitlements.persistent_storage_enabled ? "Habilitado" : "No habilitado"}
                        </p>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Planes disponibles</CardTitle>
              <CardDescription>
                Esta pantalla deja preparado el upgrade comercial. El checkout automatico va a conectarse en la siguiente fase.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-3">
              {(["FREE", "BASICO", "PREMIUM"] as PlanType[]).map((plan) => {
                const copy = planCardCopy[plan];
                const isCurrent = plan === planType;

                return (
                  <div key={plan} className={`rounded-xl border p-4 ${isCurrent ? "border-primary bg-primary/5" : ""}`}>
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold text-foreground">{copy.title}</p>
                      <StatusBadge tone={isCurrent ? "success" : "neutral"} label={plan} />
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">{copy.summary}</p>
                    <ul className="mt-4 space-y-2 text-sm text-foreground">
                      {copy.bullets.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                    <Button
                      className="mt-4 w-full"
                      variant={isCurrent ? "outline" : "default"}
                      disabled={isCurrent || plan === "FREE" || checkingOutPlan !== null}
                      onClick={() => handleCheckout(plan as "BASICO" | "PREMIUM")}
                    >
                      {isCurrent
                        ? "Plan actual"
                        : checkingOutPlan === plan
                        ? "Redirigiendo..."
                        : "Pagar con Mercado Pago"}
                    </Button>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Landmark className="h-4 w-4" />
                Pago alternativo
              </CardTitle>
              <CardDescription>
                Para transferencia, colegio o facturacion manual, deja una solicitud y se revisa por soporte.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={handleManualRequest}>
                <div className="space-y-2">
                  <Label>Plan solicitado</Label>
                  <Select value={requestedPlan} onValueChange={(value) => setRequestedPlan(value as "BASICO" | "PREMIUM")}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="BASICO">BASICO</SelectItem>
                      <SelectItem value="PREMIUM">PREMIUM</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="billing-name">Nombre o razon social</Label>
                  <Input
                    id="billing-name"
                    value={billingName}
                    onChange={(event) => setBillingName(event.target.value)}
                    placeholder="Opcional"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tax-id">CUIT / identificador</Label>
                  <Input
                    id="tax-id"
                    value={taxId}
                    onChange={(event) => setTaxId(event.target.value)}
                    placeholder="Opcional"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="billing-notes">Notas</Label>
                  <Textarea
                    id="billing-notes"
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    rows={5}
                    placeholder="Ej. necesito factura, pago institucional, transferencia, alta anual."
                  />
                </div>

                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Enviando solicitud
                    </>
                  ) : (
                    <>
                      <CreditCard className="mr-2 h-4 w-4" />
                      Enviar solicitud manual
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Solicitudes recientes</CardTitle>
              <CardDescription>Historial basico de pedidos manuales asociados a tu cuenta.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {loading ? (
                <div className="text-sm text-muted-foreground">Cargando solicitudes</div>
              ) : requests.length === 0 ? (
                <div className="text-sm text-muted-foreground">Todavia no hay solicitudes manuales registradas.</div>
              ) : (
                requests.map((request, index) => (
                  <div key={request.id}>
                    {index > 0 && <Separator className="mb-4" />}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-medium text-foreground">{request.requested_plan}</p>
                        <StatusBadge tone={manualRequestTone(request.status)} label={manualRequestLabel(request.status)} />
                      </div>
                      <p className="text-xs text-muted-foreground">Creada: {formatDate(request.created_at)}</p>
                      {request.billing_name && (
                        <p className="text-sm text-muted-foreground">Titular: {request.billing_name}</p>
                      )}
                      {request.tax_id && (
                        <p className="text-sm text-muted-foreground">Identificador: {request.tax_id}</p>
                      )}
                      {request.notes && <p className="text-sm text-muted-foreground">{request.notes}</p>}
                      {request.review_notes && (
                        <p className="text-sm text-foreground">Revision: {request.review_notes}</p>
                      )}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
