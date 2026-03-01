
-- TAREA 4: Update validate_plan with resources + activities_summary checks
CREATE OR REPLACE FUNCTION public.validate_plan(p_plan_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  v_plan RECORD; v_obj_count INT; v_pl_count INT; v_lesson_count INT;
  v_course_id UUID; v_errors TEXT[] := '{}';
  v_pl RECORD;
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

  -- NEW: Validate resources
  IF length(trim(v_plan.resources)) = 0 THEN
    v_errors := array_append(v_errors, 'Recursos es obligatorio');
  END IF;

  SELECT count(*) INTO v_obj_count FROM plan_objectives WHERE plan_id = p_plan_id;
  IF v_obj_count < 4 OR v_obj_count > 8 THEN
    v_errors := array_append(v_errors, 'Se requieren entre 4 y 8 propositos (actual: ' || v_obj_count || ')');
  END IF;

  SELECT count(*) INTO v_pl_count FROM plan_lessons WHERE plan_id = p_plan_id;
  IF v_pl_count != 28 THEN
    v_errors := array_append(v_errors, 'Deben existir exactamente 28 plan_lessons (actual: ' || v_pl_count || ')');
  END IF;

  -- NEW: Validate activities_summary for each plan_lesson
  FOR v_pl IN SELECT lesson_number, activities_summary
              FROM plan_lessons WHERE plan_id = p_plan_id
              ORDER BY lesson_number
  LOOP
    IF length(trim(v_pl.activities_summary)) = 0 THEN
      v_errors := array_append(v_errors, 'Clase ' || v_pl.lesson_number || ': Actividades es obligatorio');
    END IF;
  END LOOP;

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

-- TAREA 6: demo_contract_check RPC (read-only, with auth+ownership)
CREATE OR REPLACE FUNCTION public.demo_contract_check(p_plan_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_plan RECORD; v_obj_count INT; v_pl_count INT;
  v_errors TEXT[] := '{}';
  v_pl RECORD;
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

  IF length(v_plan.fundamentacion) < 100 THEN
    v_errors := array_append(v_errors, 'Fundamentacion debe tener al menos 100 caracteres');
  END IF;
  IF trim(v_plan.estrategias_marco) = '' OR v_plan.estrategias_marco IS NULL THEN
    v_errors := array_append(v_errors, 'Estrategias marco es obligatorio');
  END IF;
  IF trim(v_plan.evaluacion_marco) = '' OR v_plan.evaluacion_marco IS NULL THEN
    v_errors := array_append(v_errors, 'Evaluacion marco es obligatorio');
  END IF;
  IF array_length(v_plan.estrategias_practicas, 1) IS NULL
     OR array_length(v_plan.estrategias_practicas, 1) < 1 THEN
    v_errors := array_append(v_errors, 'Se requiere al menos 1 estrategia practica');
  END IF;
  IF length(trim(v_plan.resources)) = 0 THEN
    v_errors := array_append(v_errors, 'Recursos es obligatorio');
  END IF;

  SELECT count(*) INTO v_obj_count FROM plan_objectives WHERE plan_id = p_plan_id;
  IF v_obj_count < 4 OR v_obj_count > 8 THEN
    v_errors := array_append(v_errors, 'Se requieren entre 4 y 8 propositos (actual: ' || v_obj_count || ')');
  END IF;

  SELECT count(*) INTO v_pl_count FROM plan_lessons WHERE plan_id = p_plan_id;
  IF v_pl_count != 28 THEN
    v_errors := array_append(v_errors, 'Deben existir exactamente 28 plan_lessons (actual: ' || v_pl_count || ')');
  END IF;

  FOR v_pl IN SELECT lesson_number, activities_summary
              FROM plan_lessons WHERE plan_id = p_plan_id
              ORDER BY lesson_number
  LOOP
    IF length(trim(v_pl.activities_summary)) = 0 THEN
      v_errors := array_append(v_errors, 'Clase ' || v_pl.lesson_number || ': Actividades es obligatorio');
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'success', array_length(v_errors, 1) IS NULL,
    'errors', v_errors
  );
END;
$$;
