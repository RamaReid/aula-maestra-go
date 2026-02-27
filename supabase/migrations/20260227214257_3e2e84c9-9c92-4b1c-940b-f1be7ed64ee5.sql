
-- ============================================================
-- PRD 3 — Fase 1: Enums, Tablas, Funciones, Triggers, Backfill
-- ============================================================

-- 1. Enums
CREATE TYPE public.plan_type AS ENUM ('FREE', 'BASICO', 'PREMIUM');
CREATE TYPE public.subscription_status AS ENUM ('ACTIVE', 'CANCELED', 'EXPIRED');
CREATE TYPE public.copiloto_mode AS ENUM ('none', 'limited', 'full');

-- 2. Table: subscriptions
CREATE TABLE public.subscriptions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE,
  plan_type public.plan_type NOT NULL DEFAULT 'FREE',
  status public.subscription_status NOT NULL DEFAULT 'ACTIVE',
  start_date timestamptz NOT NULL DEFAULT now(),
  end_date timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own subscription"
  ON public.subscriptions FOR SELECT
  USING (user_id = auth.uid());

-- 3. Table: user_entitlements
CREATE TABLE public.user_entitlements (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE,
  max_courses integer NOT NULL DEFAULT 1,
  max_students_per_course integer NOT NULL DEFAULT 35,
  max_weekly_sessions integer NOT NULL DEFAULT 2,
  max_classes_per_session integer NOT NULL DEFAULT 3,
  watermark_enabled boolean NOT NULL DEFAULT true,
  history_enabled boolean NOT NULL DEFAULT false,
  copiloto_mode public.copiloto_mode NOT NULL DEFAULT 'none',
  auto_complete_forms_enabled boolean NOT NULL DEFAULT false,
  persistent_storage_enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_entitlements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own entitlements"
  ON public.user_entitlements FOR SELECT
  USING (user_id = auth.uid());

-- 4. Table: usage_counters
CREATE TABLE public.usage_counters (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE,
  week_start_date date NOT NULL DEFAULT (date_trunc('week', now()))::date,
  sessions_used_this_week integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.usage_counters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own usage counters"
  ON public.usage_counters FOR SELECT
  USING (user_id = auth.uid());

-- 5. updated_at triggers for the 3 new tables
CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_entitlements_updated_at
  BEFORE UPDATE ON public.user_entitlements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_usage_counters_updated_at
  BEFORE UPDATE ON public.usage_counters
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6. Function: recalculate_entitlements
CREATE OR REPLACE FUNCTION public.recalculate_entitlements(p_user_id uuid, p_plan public.plan_type)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.user_entitlements
  SET
    max_courses = CASE p_plan
      WHEN 'FREE' THEN 1
      WHEN 'BASICO' THEN 15
      WHEN 'PREMIUM' THEN 9999
    END,
    max_students_per_course = CASE p_plan
      WHEN 'FREE' THEN 35
      WHEN 'BASICO' THEN 9999
      WHEN 'PREMIUM' THEN 9999
    END,
    max_weekly_sessions = CASE p_plan
      WHEN 'FREE' THEN 2
      WHEN 'BASICO' THEN 9999
      WHEN 'PREMIUM' THEN 9999
    END,
    max_classes_per_session = CASE p_plan
      WHEN 'FREE' THEN 3
      WHEN 'BASICO' THEN 9999
      WHEN 'PREMIUM' THEN 9999
    END,
    watermark_enabled = CASE p_plan
      WHEN 'FREE' THEN true
      ELSE false
    END,
    history_enabled = CASE p_plan
      WHEN 'FREE' THEN false
      ELSE true
    END,
    copiloto_mode = CASE p_plan
      WHEN 'FREE' THEN 'none'::public.copiloto_mode
      WHEN 'BASICO' THEN 'limited'::public.copiloto_mode
      WHEN 'PREMIUM' THEN 'full'::public.copiloto_mode
    END,
    auto_complete_forms_enabled = CASE p_plan
      WHEN 'PREMIUM' THEN true
      ELSE false
    END,
    persistent_storage_enabled = CASE p_plan
      WHEN 'FREE' THEN false
      ELSE true
    END
  WHERE user_id = p_user_id;
END;
$$;

-- 7. Function: reset_weekly_counters
CREATE OR REPLACE FUNCTION public.reset_weekly_counters()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  current_monday date := (date_trunc('week', now()))::date;
BEGIN
  UPDATE public.usage_counters
  SET week_start_date = current_monday,
      sessions_used_this_week = 0
  WHERE week_start_date < current_monday;
END;
$$;

-- 8. Trigger: on_subscription_plan_change
CREATE OR REPLACE FUNCTION public.handle_subscription_plan_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.plan_type IS DISTINCT FROM OLD.plan_type THEN
    PERFORM public.recalculate_entitlements(NEW.user_id, NEW.plan_type);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_subscription_plan_change
  AFTER UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.handle_subscription_plan_change();

-- 9. Modify handle_new_user() to also create subscription + entitlements + counter
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Profile (existing)
  INSERT INTO public.profiles (id, name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.email, '')
  );
  -- Role (existing)
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'docente');
  -- Subscription FREE
  INSERT INTO public.subscriptions (user_id, plan_type, status)
  VALUES (NEW.id, 'FREE', 'ACTIVE');
  -- Entitlements FREE (defaults match FREE values)
  INSERT INTO public.user_entitlements (user_id)
  VALUES (NEW.id);
  -- Usage counter
  INSERT INTO public.usage_counters (user_id)
  VALUES (NEW.id);
  RETURN NEW;
END;
$$;

-- 10. Admin function: upgrade_user_plan
CREATE OR REPLACE FUNCTION public.upgrade_user_plan(p_user_id uuid, p_new_plan public.plan_type)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.subscriptions
  SET plan_type = p_new_plan
  WHERE user_id = p_user_id;
END;
$$;

-- 11. Backfill existing users
INSERT INTO public.subscriptions (user_id, plan_type, status)
SELECT p.id, 'FREE', 'ACTIVE'
FROM public.profiles p
WHERE NOT EXISTS (SELECT 1 FROM public.subscriptions s WHERE s.user_id = p.id);

INSERT INTO public.user_entitlements (user_id)
SELECT p.id
FROM public.profiles p
WHERE NOT EXISTS (SELECT 1 FROM public.user_entitlements ue WHERE ue.user_id = p.id);

INSERT INTO public.usage_counters (user_id)
SELECT p.id
FROM public.profiles p
WHERE NOT EXISTS (SELECT 1 FROM public.usage_counters uc WHERE uc.user_id = p.id);
