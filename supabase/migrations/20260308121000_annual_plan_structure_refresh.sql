CREATE TABLE public.course_schedule_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 1 AND 5),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  module_count INT NOT NULL CHECK (module_count BETWEEN 1 AND 6),
  order_index INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (course_id, day_of_week, start_time)
);

ALTER TABLE public.course_schedule_slots ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.plan_content_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  topics TEXT[] NOT NULL DEFAULT '{}',
  term INT CHECK (term IN (1, 2)),
  order_index INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.plan_content_blocks ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.plan_lessons
  ADD COLUMN IF NOT EXISTS content_block_id UUID REFERENCES public.plan_content_blocks(id) ON DELETE SET NULL;

CREATE TABLE public.plan_rubrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  content_block_id UUID NOT NULL REFERENCES public.plan_content_blocks(id) ON DELETE CASCADE,
  criterion_name TEXT NOT NULL DEFAULT '',
  focus_note TEXT NOT NULL DEFAULT '',
  advanced_level TEXT NOT NULL DEFAULT '',
  expected_level TEXT NOT NULL DEFAULT '',
  basic_level TEXT NOT NULL DEFAULT '',
  initial_level TEXT NOT NULL DEFAULT '',
  order_index INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.plan_rubrics ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.plan_teacher_bibliography_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  citation TEXT NOT NULL DEFAULT '',
  usage_notes TEXT NOT NULL DEFAULT '',
  order_index INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.plan_teacher_bibliography_entries ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_course_schedule_slots_updated_at
  BEFORE UPDATE ON public.course_schedule_slots
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_plan_content_blocks_updated_at
  BEFORE UPDATE ON public.plan_content_blocks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_plan_rubrics_updated_at
  BEFORE UPDATE ON public.plan_rubrics
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_plan_teacher_bibliography_entries_updated_at
  BEFORE UPDATE ON public.plan_teacher_bibliography_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Owners can view course schedule slots" ON public.course_schedule_slots FOR SELECT
  USING (public.is_course_owner(auth.uid(), course_id));
CREATE POLICY "Owners can insert course schedule slots" ON public.course_schedule_slots FOR INSERT
  WITH CHECK (public.is_course_owner(auth.uid(), course_id));
CREATE POLICY "Owners can update course schedule slots" ON public.course_schedule_slots FOR UPDATE
  USING (public.is_course_owner(auth.uid(), course_id))
  WITH CHECK (public.is_course_owner(auth.uid(), course_id));
CREATE POLICY "Owners can delete course schedule slots" ON public.course_schedule_slots FOR DELETE
  USING (public.is_course_owner(auth.uid(), course_id));

CREATE POLICY "Owners can view content blocks" ON public.plan_content_blocks FOR SELECT
  USING (public.is_plan_owner(auth.uid(), plan_id));
CREATE POLICY "Owners can insert content blocks" ON public.plan_content_blocks FOR INSERT
  WITH CHECK (public.is_plan_owner(auth.uid(), plan_id) AND public.is_course_not_archived_for_plan(plan_id));
CREATE POLICY "Owners can update content blocks" ON public.plan_content_blocks FOR UPDATE
  USING (public.is_plan_owner(auth.uid(), plan_id))
  WITH CHECK (public.is_plan_owner(auth.uid(), plan_id) AND public.is_course_not_archived_for_plan(plan_id));
CREATE POLICY "Owners can delete content blocks" ON public.plan_content_blocks FOR DELETE
  USING (public.is_plan_owner(auth.uid(), plan_id) AND public.is_course_not_archived_for_plan(plan_id));

CREATE POLICY "Owners can view rubrics" ON public.plan_rubrics FOR SELECT
  USING (public.is_plan_owner(auth.uid(), plan_id));
CREATE POLICY "Owners can insert rubrics" ON public.plan_rubrics FOR INSERT
  WITH CHECK (public.is_plan_owner(auth.uid(), plan_id) AND public.is_course_not_archived_for_plan(plan_id));
CREATE POLICY "Owners can update rubrics" ON public.plan_rubrics FOR UPDATE
  USING (public.is_plan_owner(auth.uid(), plan_id))
  WITH CHECK (public.is_plan_owner(auth.uid(), plan_id) AND public.is_course_not_archived_for_plan(plan_id));
CREATE POLICY "Owners can delete rubrics" ON public.plan_rubrics FOR DELETE
  USING (public.is_plan_owner(auth.uid(), plan_id) AND public.is_course_not_archived_for_plan(plan_id));

CREATE POLICY "Owners can view teacher bibliography" ON public.plan_teacher_bibliography_entries FOR SELECT
  USING (public.is_plan_owner(auth.uid(), plan_id));
CREATE POLICY "Owners can insert teacher bibliography" ON public.plan_teacher_bibliography_entries FOR INSERT
  WITH CHECK (public.is_plan_owner(auth.uid(), plan_id) AND public.is_course_not_archived_for_plan(plan_id));
CREATE POLICY "Owners can update teacher bibliography" ON public.plan_teacher_bibliography_entries FOR UPDATE
  USING (public.is_plan_owner(auth.uid(), plan_id))
  WITH CHECK (public.is_plan_owner(auth.uid(), plan_id) AND public.is_course_not_archived_for_plan(plan_id));
CREATE POLICY "Owners can delete teacher bibliography" ON public.plan_teacher_bibliography_entries FOR DELETE
  USING (public.is_plan_owner(auth.uid(), plan_id) AND public.is_course_not_archived_for_plan(plan_id));

CREATE OR REPLACE FUNCTION public.assign_lesson_schedule_from_course(p_course_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_academic_year INT;
  v_slot_count INT;
  v_lesson RECORD;
  v_slot RECORD;
  v_term_index INT;
  v_term_start DATE;
  v_offset INT;
  v_week_offset INT;
  v_scheduled DATE;
BEGIN
  SELECT academic_year INTO v_academic_year
  FROM public.courses
  WHERE id = p_course_id;

  IF v_academic_year IS NULL THEN
    RETURN;
  END IF;

  SELECT count(*) INTO v_slot_count
  FROM public.course_schedule_slots
  WHERE course_id = p_course_id;

  IF v_slot_count = 0 THEN
    UPDATE public.lessons
    SET scheduled_date = NULL
    WHERE course_id = p_course_id;
    RETURN;
  END IF;

  FOR v_lesson IN
    SELECT l.id, l.lesson_number, pl.term
    FROM public.lessons l
    JOIN public.plan_lessons pl ON pl.id = l.plan_lesson_id
    WHERE l.course_id = p_course_id
    ORDER BY l.lesson_number
  LOOP
    v_term_index := CASE
      WHEN v_lesson.term = 1 THEN v_lesson.lesson_number - 1
      ELSE GREATEST(v_lesson.lesson_number - 15, 0)
    END;

    SELECT day_of_week, start_time
    INTO v_slot
    FROM public.course_schedule_slots
    WHERE course_id = p_course_id
    ORDER BY order_index, day_of_week, start_time
    OFFSET (v_term_index % v_slot_count)
    LIMIT 1;

    v_term_start := make_date(v_academic_year, CASE WHEN v_lesson.term = 1 THEN 3 ELSE 8 END, 1);
    v_offset := (v_slot.day_of_week - EXTRACT(ISODOW FROM v_term_start)::INT + 7) % 7;
    v_week_offset := floor(v_term_index / v_slot_count::numeric)::INT;
    v_scheduled := v_term_start + v_offset + (v_week_offset * 7);

    UPDATE public.lessons
    SET scheduled_date = v_scheduled
    WHERE id = v_lesson.id;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_course_schedule_slots()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_course_id UUID;
BEGIN
  v_course_id := COALESCE(NEW.course_id, OLD.course_id);
  PERFORM public.assign_lesson_schedule_from_course(v_course_id);
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER sync_course_schedule_slots_after_change
  AFTER INSERT OR UPDATE OR DELETE ON public.course_schedule_slots
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_course_schedule_slots();

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

  INSERT INTO lessons (course_id, plan_lesson_id, lesson_number, status)
  SELECT v_course_id, pl.id, pl.lesson_number, 'PLANNED'
  FROM plan_lessons pl WHERE pl.plan_id = p_plan_id ORDER BY pl.lesson_number;

  PERFORM public.assign_lesson_schedule_from_course(v_course_id);

  RETURN jsonb_build_object('success', true, 'errors', ARRAY[]::text[]);
END;
$$;
