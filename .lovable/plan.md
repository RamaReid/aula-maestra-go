

# Fase 2 — Migracion DB + UI (version final con fixes)

## Confirmaciones pre-merge

1. **`plans.resources`**: Existe en el schema (text, NOT NULL, default `''::text`). Validacion OK.
2. **Null-safe**: Todas las validaciones de texto usaran `length(COALESCE(trim(...), ''))` para fundamentacion, estrategias_marco, evaluacion_marco y resources.

## 2.1 Migracion SQL (1 archivo, 3 bloques)

### Bloque 1: Agregar EDITED a enums (idempotente)

```sql
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'EDITED'
    AND enumtypid = 'plan_status'::regtype) THEN
    ALTER TYPE plan_status ADD VALUE 'EDITED';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'EDITED'
    AND enumtypid = 'material_status'::regtype) THEN
    ALTER TYPE material_status ADD VALUE 'EDITED';
  END IF;
END $$;
```

### Bloque 2: Trigger (VALIDATED -> EDITED sin bypass)

```sql
CREATE OR REPLACE FUNCTION public.prevent_direct_plan_validation()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status = 'EDITED' AND OLD.status = 'VALIDATED' THEN
    RETURN NEW;
  END IF;
  IF NEW.status = 'VALIDATED' AND OLD.status IS DISTINCT FROM 'VALIDATED' THEN
    IF COALESCE(current_setting('app.validate_plan_bypass', true), '') != 'true' THEN
      RAISE EXCEPTION 'Solo validate_plan() puede cambiar status a VALIDATED';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
```

### Bloque 3: validate_plan (rama EDITED temprana + null-safe + flexible count)

Cambios clave respecto a la version actual:

- **Rama EDITED temprana**: antes de cualquier validacion de campos, si status = EDITED -> set bypass, UPDATE -> VALIDATED, RETURN success.
- **Null-safe**: `length(COALESCE(trim(v_plan.fundamentacion), ''))` en fundamentacion, estrategias_marco, evaluacion_marco, resources.
- **Flexible count**: `v_pl_count < 1` en vez de `!= 28`.
- **ARRAY[]::text[]**: reemplaza `'{}'::text[]` en todos los retornos.
- **Rechazo generico**: `IF v_plan.status != 'INCOMPLETE'` despues de la rama EDITED.

```sql
CREATE OR REPLACE FUNCTION public.validate_plan(p_plan_id uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_plan RECORD; v_obj_count INT; v_pl_count INT; v_lesson_count INT;
  v_course_id UUID; v_errors TEXT[] := ARRAY[]::text[];
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

  v_course_id := v_plan.course_id;

  IF NOT EXISTS (SELECT 1 FROM courses WHERE id = v_course_id AND status = 'ACTIVE') THEN
    RETURN jsonb_build_object('success', false, 'errors', ARRAY['El curso esta archivado']);
  END IF;

  -- RAMA EDITED: retorno temprano
  IF v_plan.status = 'EDITED' THEN
    SET LOCAL app.validate_plan_bypass = 'true';
    UPDATE plans SET status = 'VALIDATED' WHERE id = p_plan_id;
    RETURN jsonb_build_object('success', true, 'errors', ARRAY[]::text[]);
  END IF;

  IF v_plan.status != 'INCOMPLETE' THEN
    RETURN jsonb_build_object('success', false, 'errors', ARRAY['Estado no permite validacion']);
  END IF;

  -- Validaciones null-safe
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
  IF v_obj_count < 4 OR v_obj_count > 8 THEN
    v_errors := array_append(v_errors, 'Se requieren entre 4 y 8 propositos (actual: ' || v_obj_count || ')');
  END IF;

  SELECT count(*) INTO v_pl_count FROM plan_lessons WHERE plan_id = p_plan_id;
  IF v_pl_count < 1 THEN
    v_errors := array_append(v_errors, 'Se requiere al menos 1 clase en el cronograma (actual: ' || v_pl_count || ')');
  END IF;

  FOR v_pl IN SELECT lesson_number, activities_summary
              FROM plan_lessons WHERE plan_id = p_plan_id ORDER BY lesson_number
  LOOP
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

  RETURN jsonb_build_object('success', true, 'errors', ARRAY[]::text[]);
END;
$$;
```

---

## 2.2 BriefForm.tsx: beforeunload cross-browser

Agregar `e.returnValue = '';` al handler existente (1 linea).

## 2.3 StatusBadge.tsx: mapeos EDITED

4 funciones actualizadas:

- `planLabel`: EDITED -> "Editado"
- `planTone`: EDITED -> "danger"
- `materialLabel`: INVALIDATED > EDITED > GENERATED > VALIDATED (precedencia por switch order)
- `materialTone`: INVALIDATED/EDITED -> "danger", GENERATED -> "warning", VALIDATED -> "success"

## 2.4 PlanEditor.tsx: logica post-validacion

1. `readOnly` = solo `!!courseArchived` (no bloquea VALIDATED)
2. Estado local `currentStatus` + `hasEditedAfterValidation`
3. `useEffect` sincroniza `planStatus` prop -> `currentStatus` (reset si vuelve a VALIDATED)
4. `saveField`: si `currentStatus === "VALIDATED"`, primer cambio -> update DB a EDITED + `setCurrentStatus("EDITED")`
5. Badge: VALIDATED/default, EDITED/destructive + microcopy, INCOMPLETE/secondary
6. CTA: INCOMPLETE -> "Validar", EDITED -> "Validar cambios", VALIDATED -> oculto
7. Toast: si `hasEditedAfterValidation` -> "Plan revalidado" (sin "Se crearon las lecciones")

## 2.5 Course.tsx: fix tabs con EDITED

- `planValidated` incluye EDITED: `plan?.status === "VALIDATED" || plan?.status === "EDITED"`
- Fetch de lecciones: misma condicion expandida

---

## Resumen de archivos

| Archivo | Cambio |
|---------|--------|
| Migracion SQL | Enums + trigger + validate_plan (null-safe, flexible, rama EDITED) |
| `src/components/lesson/BriefForm.tsx` | `e.returnValue = ''` (1 linea) |
| `src/components/ui/StatusBadge.tsx` | 4 funciones con EDITED |
| `src/components/plan/PlanEditor.tsx` | Logica completa post-validacion |
| `src/pages/Course.tsx` | planValidated incluye EDITED |

## Checklist de pruebas (7 casos)

1. INCOMPLETE -> Validar: lecciones creadas, status VALIDATED, CTA oculto
2. VALIDATED -> editar campo: badge "Editado" rojo, microcopy, CTA "Validar cambios"
3. EDITED -> Validar cambios: status VALIDATED, sin lecciones duplicadas, CTA oculto
4. Curso archivado: campos disabled en cualquier status
5. beforeunload BriefForm: dialogo nativo al cerrar con cambios sin guardar
6. EDITED -> Validar cambios -> refresh: status VALIDATED, contenido editado persiste
7. Tabs con EDITED: Agenda y Lecciones siguen visibles
