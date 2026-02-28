

# Plan: PRD 1.2 Foundation — Implementacion Completa con P0 Corregidos

## Resumen

5 entregables: migracion SQL (con 3 ajustes de robustez), Wizard de curso, validacion server-side, ARCHIVED UI+server, Agenda. Sin romper PRD 2.3 ni PRD 3.

---

## 1. Migracion SQL

Un solo archivo de migracion con todo:

### A) Helpers para ARCHIVED check

```sql
CREATE OR REPLACE FUNCTION public.is_course_not_archived_for_plan(p_plan_id UUID)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (
    SELECT 1 FROM plans p
    JOIN courses c ON c.id = p.course_id
    WHERE p.id = p_plan_id AND c.status = 'ACTIVE'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_course_not_archived_for_lesson(p_lesson_id UUID)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (
    SELECT 1 FROM lessons l
    JOIN courses c ON c.id = l.course_id
    WHERE l.id = p_lesson_id AND c.status = 'ACTIVE'
  );
$$;
```

### B) Trigger prevent_direct_plan_validation

```sql
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
```

### C) validate_plan RPC (con los 3 ajustes de robustez)

```sql
CREATE OR REPLACE FUNCTION public.validate_plan(p_plan_id UUID)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_plan RECORD; v_obj_count INT; v_pl_count INT; v_lesson_count INT;
  v_course_id UUID; v_errors TEXT[] := '{}';
BEGIN
  -- Ajuste 3: auth check
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

  -- Validaciones
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

  -- Prevenir duplicados
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

-- Ajustes 1 y 2: permisos
GRANT EXECUTE ON FUNCTION public.validate_plan(UUID) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_plan(UUID) FROM anon;
```

### D) Policies RLS modificadas

```text
Tabla            | Policy original                        | Cambio
plans            | "Owners can update plans"              | DROP + recrear con USING(owner) + WITH CHECK(owner AND not_archived)
plan_objectives  | "Owners can manage plan objectives"    | DROP + 4 policies separadas (SELECT/INSERT/UPDATE/DELETE) con check archived
plan_lessons     | "Owners can manage plan lessons"       | DROP + 4 policies separadas con check archived
lessons          | "Owners can update lessons"            | DROP + recrear con USING(owner) + WITH CHECK(owner AND not_archived_for_lesson)
```

SQL completo para las policies:

```sql
-- plans UPDATE
DROP POLICY IF EXISTS "Owners can update plans" ON plans;
CREATE POLICY "Owners can update plans" ON plans FOR UPDATE
  USING (is_course_owner(auth.uid(), course_id))
  WITH CHECK (is_course_owner(auth.uid(), course_id) AND is_course_not_archived_for_plan(id));

-- plan_objectives: split ALL -> 4
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

-- plan_lessons: split ALL -> 4
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

-- lessons UPDATE (bloquea agenda en ARCHIVED)
DROP POLICY IF EXISTS "Owners can update lessons" ON lessons;
CREATE POLICY "Owners can update lessons" ON lessons FOR UPDATE
  USING (is_course_owner(auth.uid(), course_id))
  WITH CHECK (is_course_owner(auth.uid(), course_id) AND is_course_not_archived_for_lesson(id));
```

---

## 2. Nuevo archivo: `src/pages/CourseNew.tsx`

Wizard 8 pasos con state machine local. Steps condicionales:
- **Orientacion**: solo si UPPER + COMUN
- **Especialidad**: solo si UPPER + TECNICA
- Flujo: Provincia(PBA fijo) -> Escuela(select+crear) -> Ciclo -> Ano -> Materia -> [Orientacion] -> [Especialidad] -> Confirmacion
- Al crear: check-course-limit -> INSERT courses -> INSERT plans -> INSERT 28 plan_lessons (term 1: 1-14, term 2: 15-28) -> navigate

---

## 3. Nuevo archivo: `src/components/plan/AgendaView.tsx`

Tabla con columnas: # | Tema | Fecha (input type="date"). UPDATE lessons.scheduled_date al cambiar. Prop `readOnly` para ARCHIVED.

---

## 4. Modificar `src/App.tsx`

Agregar import de CourseNew y ruta `/course/new` ANTES de `/course/:courseId`:

```tsx
import CourseNew from "./pages/CourseNew";
// ...dentro de Routes, antes de course/:courseId:
<Route path="/course/new" element={<ProtectedRoute><CourseNew /></ProtectedRoute>} />
```

---

## 5. Modificar `src/pages/Dashboard.tsx`

Linea 79-80: reemplazar TODO por navegacion real:

```tsx
navigate("/course/new");
```

Agregar `useNavigate` al import de react-router-dom.

---

## 6. Modificar `src/components/plan/PlanEditor.tsx`

- Agregar prop `courseArchived?: boolean`
- `readOnly` = `planStatus === "VALIDATED" || courseArchived`
- Reemplazar `handleValidate` (lineas 80-125) con llamada RPC:
  ```tsx
  const { data, error } = await supabase.rpc("validate_plan", { p_plan_id: planId });
  if (error) throw error;
  const result = data as { success: boolean; errors: string[] };
  if (!result.success) {
    toast({ title: "Validacion fallida", description: result.errors.join(". "), variant: "destructive" });
    return;
  }
  ```
- Ocultar boton Validar si `courseArchived`

---

## 7. Modificar `src/pages/Course.tsx`

- Agregar `status` al CourseInfo interface y al fetch (select `status` de courses)
- Boton "Archivar curso" con AlertDialog (solo si ACTIVE):
  ```tsx
  await supabase.from("courses").update({ status: "ARCHIVED" }).eq("id", courseId);
  ```
- Badge "Archivado" si status === ARCHIVED
- Pasar `courseArchived={course.status === 'ARCHIVED'}` a PlanEditor
- Renderizar `<AgendaView courseId={courseId} readOnly={course.status === 'ARCHIVED'} />` solo si plan VALIDATED

---

## QA: 11 Tests

| # | Test | Resultado |
|---|------|-----------|
| 1 | FREE, 0 cursos: wizard completo | Curso + plan + 28 plan_lessons creados |
| 2 | FREE, 1 curso: click Nuevo curso | check-course-limit bloquea |
| 3 | Wizard BASIC: paso orientacion | Auto-skip |
| 4 | Wizard TECNICA+UPPER: paso especialidad | Campo obligatorio |
| 5 | Plan incompleto: Validar | RPC retorna errores |
| 6 | Plan completo: Validar | VALIDATED + 28 lessons |
| 7 | UPDATE directo plans.status='VALIDATED' | Trigger: "Solo validate_plan() puede cambiar status a VALIDATED" |
| 8 | Archivar curso ACTIVE | status=ARCHIVED, PlanEditor readonly |
| 9 | ARCHIVED: INSERT plan_objective | RLS: "new row violates row-level security policy" |
| 10 | ARCHIVED: UPDATE lesson scheduled_date | RLS bloquea |
| 11 | Edge functions sin Authorization | 401 "No autorizado" |

---

## Archivos afectados

| Archivo | Accion |
|---------|--------|
| Migracion SQL | Crear — validate_plan + trigger + helpers + policies + GRANT/REVOKE |
| `src/pages/CourseNew.tsx` | Crear — Wizard 8 pasos |
| `src/components/plan/AgendaView.tsx` | Crear — Vista agenda |
| `src/App.tsx` | Modificar — ruta /course/new |
| `src/pages/Dashboard.tsx` | Modificar — navigate al wizard |
| `src/pages/Course.tsx` | Modificar — ARCHIVED UI + AgendaView + status |
| `src/components/plan/PlanEditor.tsx` | Modificar — RPC + courseArchived |

