CREATE TYPE public.billing_provider AS ENUM ('MANUAL', 'MERCADO_PAGO', 'STRIPE');
CREATE TYPE public.billing_event_status AS ENUM ('RECEIVED', 'PROCESSED', 'IGNORED', 'FAILED');
CREATE TYPE public.manual_payment_status AS ENUM ('PENDING_REVIEW', 'APPROVED', 'REJECTED', 'EXPIRED');

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS provider public.billing_provider NOT NULL DEFAULT 'MANUAL',
  ADD COLUMN IF NOT EXISTS provider_customer_id text,
  ADD COLUMN IF NOT EXISTS provider_subscription_id text,
  ADD COLUMN IF NOT EXISTS provider_plan_id text,
  ADD COLUMN IF NOT EXISTS billing_email text,
  ADD COLUMN IF NOT EXISTS current_period_start timestamptz,
  ADD COLUMN IF NOT EXISTS current_period_end timestamptz,
  ADD COLUMN IF NOT EXISTS cancel_at_period_end boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_payment_status text,
  ADD COLUMN IF NOT EXISTS last_payment_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_invoice_url text,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

UPDATE public.subscriptions s
SET
  billing_email = COALESCE(s.billing_email, p.email),
  current_period_start = COALESCE(s.current_period_start, s.start_date),
  current_period_end = COALESCE(s.current_period_end, s.end_date)
FROM public.profiles p
WHERE p.id = s.user_id;

CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_provider_subscription_uidx
  ON public.subscriptions (provider, provider_subscription_id)
  WHERE provider_subscription_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS subscriptions_provider_customer_idx
  ON public.subscriptions (provider, provider_customer_id)
  WHERE provider_customer_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.billing_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  provider public.billing_provider NOT NULL,
  event_type text NOT NULL,
  provider_event_id text,
  provider_subscription_id text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status public.billing_event_status NOT NULL DEFAULT 'RECEIVED',
  error_message text,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.billing_events ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX IF NOT EXISTS billing_events_provider_event_uidx
  ON public.billing_events (provider, provider_event_id)
  WHERE provider_event_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS billing_events_user_idx
  ON public.billing_events (user_id, created_at DESC);

CREATE TRIGGER update_billing_events_updated_at
  BEFORE UPDATE ON public.billing_events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.manual_payment_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  requested_plan public.plan_type NOT NULL,
  requested_provider public.billing_provider NOT NULL DEFAULT 'MANUAL',
  status public.manual_payment_status NOT NULL DEFAULT 'PENDING_REVIEW',
  billing_name text,
  tax_id text,
  notes text,
  proof_storage_path text,
  review_notes text,
  reviewed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT manual_payment_requests_plan_check CHECK (requested_plan IN ('BASICO', 'PREMIUM'))
);

ALTER TABLE public.manual_payment_requests ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS manual_payment_requests_user_idx
  ON public.manual_payment_requests (user_id, created_at DESC);

CREATE TRIGGER update_manual_payment_requests_updated_at
  BEFORE UPDATE ON public.manual_payment_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Users can view own manual payment requests"
  ON public.manual_payment_requests FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can create own manual payment requests"
  ON public.manual_payment_requests FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND requested_plan IN ('BASICO', 'PREMIUM')
    AND requested_provider = 'MANUAL'
    AND status = 'PENDING_REVIEW'
  );

CREATE OR REPLACE FUNCTION public.handle_subscription_plan_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.plan_type IS DISTINCT FROM OLD.plan_type OR NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'ACTIVE' THEN
      PERFORM public.recalculate_entitlements(NEW.user_id, NEW.plan_type);
    ELSE
      PERFORM public.recalculate_entitlements(NEW.user_id, 'FREE'::public.plan_type);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_upsert_billing_subscription(
  p_user_id uuid,
  p_plan public.plan_type,
  p_status public.subscription_status,
  p_provider public.billing_provider DEFAULT 'MANUAL',
  p_provider_customer_id text DEFAULT NULL,
  p_provider_subscription_id text DEFAULT NULL,
  p_provider_plan_id text DEFAULT NULL,
  p_billing_email text DEFAULT NULL,
  p_current_period_start timestamptz DEFAULT NULL,
  p_current_period_end timestamptz DEFAULT NULL,
  p_cancel_at_period_end boolean DEFAULT false,
  p_last_payment_status text DEFAULT NULL,
  p_last_payment_at timestamptz DEFAULT NULL,
  p_last_invoice_url text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS public.subscriptions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_subscription public.subscriptions;
BEGIN
  INSERT INTO public.subscriptions (
    user_id, plan_type, status, provider,
    provider_customer_id, provider_subscription_id, provider_plan_id,
    billing_email, current_period_start, current_period_end,
    cancel_at_period_end, last_payment_status, last_payment_at,
    last_invoice_url, metadata, start_date, end_date
  )
  VALUES (
    p_user_id, p_plan, p_status, p_provider,
    p_provider_customer_id, p_provider_subscription_id, p_provider_plan_id,
    p_billing_email, p_current_period_start, p_current_period_end,
    p_cancel_at_period_end, p_last_payment_status, p_last_payment_at,
    p_last_invoice_url, COALESCE(p_metadata, '{}'::jsonb),
    COALESCE(p_current_period_start, now()), p_current_period_end
  )
  ON CONFLICT (user_id) DO UPDATE
  SET
    plan_type = EXCLUDED.plan_type,
    status = EXCLUDED.status,
    provider = EXCLUDED.provider,
    provider_customer_id = EXCLUDED.provider_customer_id,
    provider_subscription_id = EXCLUDED.provider_subscription_id,
    provider_plan_id = EXCLUDED.provider_plan_id,
    billing_email = COALESCE(EXCLUDED.billing_email, public.subscriptions.billing_email),
    current_period_start = COALESCE(EXCLUDED.current_period_start, public.subscriptions.current_period_start),
    current_period_end = EXCLUDED.current_period_end,
    cancel_at_period_end = EXCLUDED.cancel_at_period_end,
    last_payment_status = EXCLUDED.last_payment_status,
    last_payment_at = EXCLUDED.last_payment_at,
    last_invoice_url = EXCLUDED.last_invoice_url,
    metadata = COALESCE(EXCLUDED.metadata, '{}'::jsonb),
    start_date = COALESCE(EXCLUDED.current_period_start, public.subscriptions.start_date),
    end_date = EXCLUDED.current_period_end
  RETURNING * INTO v_subscription;

  IF v_subscription.status = 'ACTIVE' THEN
    PERFORM public.recalculate_entitlements(v_subscription.user_id, v_subscription.plan_type);
  ELSE
    PERFORM public.recalculate_entitlements(v_subscription.user_id, 'FREE'::public.plan_type);
  END IF;

  RETURN v_subscription;
END;
$$;