
-- Fix search_path warning on trigger function
CREATE OR REPLACE FUNCTION public.prevent_direct_plan_validation()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status = 'VALIDATED' AND OLD.status IS DISTINCT FROM 'VALIDATED' THEN
    IF COALESCE(current_setting('app.validate_plan_bypass', true), '') != 'true' THEN
      RAISE EXCEPTION 'Solo validate_plan() puede cambiar status a VALIDATED';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
