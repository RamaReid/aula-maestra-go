CREATE OR REPLACE FUNCTION public.sync_lessons_from_plan(p_course_id uuid, p_plan_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.lessons (course_id, plan_lesson_id, lesson_number, status)
  SELECT p_course_id, pl.id, pl.lesson_number, 'PLANNED'
  FROM public.plan_lessons pl
  WHERE pl.plan_id = p_plan_id
  ORDER BY pl.lesson_number
  ON CONFLICT (course_id, lesson_number)
  DO UPDATE SET
    plan_lesson_id = EXCLUDED.plan_lesson_id,
    lesson_number = EXCLUDED.lesson_number,
    updated_at = now();

  DELETE FROM public.lessons l
  WHERE l.course_id = p_course_id
    AND NOT EXISTS (
      SELECT 1
      FROM public.plan_lessons pl
      WHERE pl.plan_id = p_plan_id
        AND pl.lesson_number = l.lesson_number
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_plan(p_plan_id uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_plan RECORD; v_obj_count INT; v_pl_count INT; v_lesson_count INT;
  v_course_id UUID; v_errors TEXT[] := ARRAY[]::text[];
  v_pl RECORD; v_mapping_count INT; v_block_count INT; v_rubric_count INT;
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

  v_course_id := v_plan.course_id;

  IF NOT EXISTS (SELECT 1 FROM courses WHERE id = v_course_id AND status = 'ACTIVE') THEN
    RETURN jsonb_build_object('success', false, 'errors', ARRAY['El curso esta archivado']);
  END IF;

  IF v_plan.status = 'EDITED' THEN
    SET LOCAL app.validate_plan_bypass = 'true';
    UPDATE plans SET status = 'VALIDATED' WHERE id = p_plan_id;
    PERFORM public.sync_lessons_from_plan(v_course_id, p_plan_id);
    PERFORM public.assign_lesson_schedule_from_course(v_course_id);
    RETURN jsonb_build_object('success', true, 'errors', ARRAY[]::text[]);
  END IF;

  IF v_plan.status != 'INCOMPLETE' THEN
    RETURN jsonb_build_object('success', false, 'errors', ARRAY['Estado no permite validacion']);
  END IF;

  IF length(COALESCE(trim(v_plan.fundamentacion), '')) < 100 THEN
    v_errors := array_append(v_errors, 'Fundamentacion debe tener al menos 100 caracteres');
  END IF;
  IF length(COALESCE(trim(v_plan.estrategias_marco), '')) = 0 THEN
    v_errors := array_append(v_errors, 'Estrategias marco es obligatorio');
  END IF;
  IF length(COALESCE(trim(v_plan.evaluacion_marco), '')) = 0 THEN
    v_errors := array_append(v_errors, 'Evaluacion marco es obligatorio');
  END IF;
  IF array_length(v_plan.estrategias_practicas, 1) IS NULL
     OR array_length(v_plan.estrategias_practicas, 1) < 1 THEN
    v_errors := array_append(v_errors, 'Se requiere al menos 1 estrategia practica');
  END IF;
  IF length(COALESCE(trim(v_plan.resources), '')) = 0 THEN
    v_errors := array_append(v_errors, 'Recursos es obligatorio');
  END IF;

  SELECT count(*) INTO v_obj_count FROM plan_objectives WHERE plan_id = p_plan_id;
  IF v_obj_count < 6 OR v_obj_count > 8 THEN
    v_errors := array_append(v_errors, 'Se requieren entre 6 y 8 objetivos (actual: ' || v_obj_count || ')');
  END IF;

  SELECT count(*) INTO v_mapping_count FROM plan_content_mappings WHERE plan_id = p_plan_id;
  IF v_mapping_count < 1 THEN
    v_errors := array_append(v_errors, 'Se requiere al menos 1 contenido curricular mapeado');
  END IF;

  SELECT count(*) INTO v_block_count
  FROM plan_content_blocks
  WHERE plan_id = p_plan_id
    AND length(COALESCE(trim(title), '')) > 0;
  IF v_block_count < 1 THEN
    v_errors := array_append(v_errors, 'Se requiere al menos 1 bloque o unidad de contenidos');
  END IF;

  SELECT count(*) INTO v_rubric_count
  FROM plan_rubrics
  WHERE plan_id = p_plan_id;
  IF v_rubric_count < 1 THEN
    v_errors := array_append(v_errors, 'Se requiere al menos 1 fila de rubrica articulada con contenidos');
  END IF;

  SELECT count(*) INTO v_pl_count FROM plan_lessons WHERE plan_id = p_plan_id;
  IF v_pl_count != 28 THEN
    v_errors := array_append(v_errors, 'La anual debe tener exactamente 28 clases (actual: ' || v_pl_count || ')');
  END IF;

  FOR v_pl IN
    SELECT lesson_number, theme, justification, learning_outcome, activities_summary
    FROM plan_lessons
    WHERE plan_id = p_plan_id
    ORDER BY lesson_number
  LOOP
    IF length(COALESCE(trim(v_pl.theme), '')) = 0 THEN
      v_errors := array_append(v_errors, 'Clase ' || v_pl.lesson_number || ': Tema es obligatorio');
    END IF;
    IF length(COALESCE(trim(v_pl.justification), '')) = 0 THEN
      v_errors := array_append(v_errors, 'Clase ' || v_pl.lesson_number || ': Justificacion es obligatoria');
    END IF;
    IF length(COALESCE(trim(v_pl.learning_outcome), '')) = 0 THEN
      v_errors := array_append(v_errors, 'Clase ' || v_pl.lesson_number || ': Resultado de aprendizaje es obligatorio');
    END IF;
    IF length(COALESCE(trim(v_pl.activities_summary), '')) = 0 THEN
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

  PERFORM public.sync_lessons_from_plan(v_course_id, p_plan_id);
  PERFORM public.assign_lesson_schedule_from_course(v_course_id);

  RETURN jsonb_build_object('success', true, 'errors', ARRAY[]::text[]);
END;
$$;
