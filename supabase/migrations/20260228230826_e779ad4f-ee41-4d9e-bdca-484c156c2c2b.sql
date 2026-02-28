
-- =============================================
-- PRD 1.2 Foundation: validate_plan + trigger + helpers + RLS
-- =============================================

-- A) Helper: check course not archived via plan_id
CREATE OR REPLACE FUNCTION public.is_course_not_archived_for_plan(p_plan_id UUID)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (
    SELECT 1 FROM plans p
    JOIN courses c ON c.id = p.course_id
    WHERE p.id = p_plan_id AND c.status = 'ACTIVE'
  );
$$;

-- B) Helper: check course not archived via lesson_id
CREATE OR REPLACE FUNCTION public.is_course_not_archived_for_lesson(p_lesson_id UUID)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (
    SELECT 1 FROM lessons l
    JOIN courses c ON c.id = l.course_id
    WHERE l.id = p_lesson_id AND c.status = 'ACTIVE'
  );
$$;

-- C) Trigger: prevent direct plan validation
CREATE OR REPLACE FUNCTION public.prevent_direct_plan_validation()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'VALIDATED' AND OLD.status IS DISTINCT FROM 'VALIDATED' THEN
    IF COALESCE(current_setting('app.validate_plan_bypass', true), '') != 'true' THEN
      RAISE EXCEPTION 'Solo validate_plan() puede cambiar status a VALIDATED';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_direct_plan_validation ON plans;
CREATE TRIGGER prevent_direct_plan_validation
  BEFORE UPDATE ON plans FOR EACH ROW
  EXECUTE FUNCTION prevent_direct_plan_validation();

-- D) validate_plan RPC
CREATE OR REPLACE FUNCTION public.validate_plan(p_plan_id UUID)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_plan RECORD; v_obj_count INT; v_pl_count INT; v_lesson_count INT;
  v_course_id UUID; v_errors TEXT[] := '{}';
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'errors', ARRAY['No autenticado']);
  END IF;

  SELECT * INTO v_plan FROM plans WHERE id = p_plan_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'errors', ARRAY['Plan no encontrado']);
  END IF;
  IF NOT is_course_owner(auth.uid(), v_plan.course_id) THEN
    RETURN jsonb_build_object('success', false, 'errors', ARRAY['No autorizado']);
  END IF;
  IF v_plan.status = 'VALIDATED' THEN
    RETURN jsonb_build_object('success', false, 'errors', ARRAY['Plan ya validado']);
  END IF;

  v_course_id := v_plan.course_id;

  IF NOT EXISTS (SELECT 1 FROM courses WHERE id = v_course_id AND status = 'ACTIVE') THEN
    RETURN jsonb_build_object('success', false, 'errors', ARRAY['El curso esta archivado']);
  END IF;

  IF length(v_plan.fundamentacion) < 100 THEN
    v_errors := array_append(v_errors, 'Fundamentacion debe tener al menos 100 caracteres');
  END IF;
  IF trim(v_plan.estrategias_marco) = '' OR v_plan.estrategias_marco IS NULL THEN
    v_errors := array_append(v_errors, 'Estrategias marco es obligatorio');
  END IF;
  IF trim(v_plan.evaluacion_marco) = '' OR v_plan.evaluacion_marco IS NULL THEN
    v_errors := array_append(v_errors, 'Evaluacion marco es obligatorio');
  END IF;
  IF array_length(v_plan.estrategias_practicas, 1) IS NULL OR array_length(v_plan.estrategias_practicas, 1) < 1 THEN
    v_errors := array_append(v_errors, 'Se requiere al menos 1 estrategia practica');
  END IF;

  SELECT count(*) INTO v_obj_count FROM plan_objectives WHERE plan_id = p_plan_id;
  IF v_obj_count < 4 OR v_obj_count > 8 THEN
    v_errors := array_append(v_errors, 'Se requieren entre 4 y 8 propositos (actual: ' || v_obj_count || ')');
  END IF;

  SELECT count(*) INTO v_pl_count FROM plan_lessons WHERE plan_id = p_plan_id;
  IF v_pl_count != 28 THEN
    v_errors := array_append(v_errors, 'Deben existir exactamente 28 plan_lessons (actual: ' || v_pl_count || ')');
  END IF;

  SELECT count(*) INTO v_lesson_count FROM lessons WHERE course_id = v_course_id;
  IF v_lesson_count > 0 THEN
    v_errors := array_append(v_errors, 'Ya existen lecciones para este curso');
  END IF;

  IF array_length(v_errors, 1) > 0 THEN
    RETURN jsonb_build_object('success', false, 'errors', v_errors);
  END IF;

  SET LOCAL app.validate_plan_bypass = 'true';
  UPDATE plans SET status = 'VALIDATED' WHERE id = p_plan_id;

  INSERT INTO lessons (course_id, plan_lesson_id, lesson_number, status)
  SELECT v_course_id, pl.id, pl.lesson_number, 'PLANNED'
  FROM plan_lessons pl WHERE pl.plan_id = p_plan_id ORDER BY pl.lesson_number;

  RETURN jsonb_build_object('success', true, 'errors', '{}'::text[]);
END;
$$;

GRANT EXECUTE ON FUNCTION public.validate_plan(UUID) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_plan(UUID) FROM anon;

-- E) RLS Policy updates

-- plans UPDATE: add WITH CHECK for archived
DROP POLICY IF EXISTS "Owners can update plans" ON plans;
CREATE POLICY "Owners can update plans" ON plans FOR UPDATE
  USING (is_course_owner(auth.uid(), course_id))
  WITH CHECK (is_course_owner(auth.uid(), course_id) AND is_course_not_archived_for_plan(id));

-- plan_objectives: split ALL -> 4 granular policies
DROP POLICY IF EXISTS "Owners can manage plan objectives" ON plan_objectives;
CREATE POLICY "Owners can view plan objectives" ON plan_objectives FOR SELECT
  USING (is_plan_owner(auth.uid(), plan_id));
CREATE POLICY "Owners can insert plan objectives" ON plan_objectives FOR INSERT
  WITH CHECK (is_plan_owner(auth.uid(), plan_id) AND is_course_not_archived_for_plan(plan_id));
CREATE POLICY "Owners can update plan objectives" ON plan_objectives FOR UPDATE
  USING (is_plan_owner(auth.uid(), plan_id))
  WITH CHECK (is_plan_owner(auth.uid(), plan_id) AND is_course_not_archived_for_plan(plan_id));
CREATE POLICY "Owners can delete plan objectives" ON plan_objectives FOR DELETE
  USING (is_plan_owner(auth.uid(), plan_id) AND is_course_not_archived_for_plan(plan_id));

-- plan_lessons: split ALL -> 4 granular policies
DROP POLICY IF EXISTS "Owners can manage plan lessons" ON plan_lessons;
CREATE POLICY "Owners can view plan lessons" ON plan_lessons FOR SELECT
  USING (is_plan_owner(auth.uid(), plan_id));
CREATE POLICY "Owners can insert plan lessons" ON plan_lessons FOR INSERT
  WITH CHECK (is_plan_owner(auth.uid(), plan_id) AND is_course_not_archived_for_plan(plan_id));
CREATE POLICY "Owners can update plan lessons" ON plan_lessons FOR UPDATE
  USING (is_plan_owner(auth.uid(), plan_id))
  WITH CHECK (is_plan_owner(auth.uid(), plan_id) AND is_course_not_archived_for_plan(plan_id));
CREATE POLICY "Owners can delete plan lessons" ON plan_lessons FOR DELETE
  USING (is_plan_owner(auth.uid(), plan_id) AND is_course_not_archived_for_plan(plan_id));

-- lessons UPDATE: add WITH CHECK for archived
DROP POLICY IF EXISTS "Owners can update lessons" ON lessons;
CREATE POLICY "Owners can update lessons" ON lessons FOR UPDATE
  USING (is_course_owner(auth.uid(), course_id))
  WITH CHECK (is_course_owner(auth.uid(), course_id) AND is_course_not_archived_for_lesson(id));
