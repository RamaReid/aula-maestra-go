
# Fase 2 — Estado "Editado" + Revalidacion

## Pre-fix: BriefForm beforeunload cross-browser

**Archivo**: `src/components/lesson/BriefForm.tsx` (linea 42)

Agregar `e.returnValue = '';` para compatibilidad Chrome/Safari.

```typescript
const handler = (e: BeforeUnloadEvent) => {
  e.preventDefault();
  e.returnValue = '';
};
```

Confirmo que `handleSave` existe y compila (lineas 50-77). Sin cambios necesarios.

---

## 2.1 Migracion DB: EDITED en enums (idempotente)

Una sola migracion SQL con 4 bloques:

### Bloque 1: Agregar EDITED a enums

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

### Bloque 2: Trigger actualizado (VALIDATED -> EDITED permitido)

```sql
CREATE OR REPLACE FUNCTION public.prevent_direct_plan_validation()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $$
BEGIN
  -- Allow VALIDATED -> EDITED without bypass
  IF NEW.status = 'EDITED' AND OLD.status = 'VALIDATED' THEN
    RETURN NEW;
  END IF;
  -- Block direct transition to VALIDATED without bypass
  IF NEW.status = 'VALIDATED' AND OLD.status IS DISTINCT FROM 'VALIDATED' THEN
    IF COALESCE(current_setting('app.validate_plan_bypass', true), '') != 'true' THEN
      RAISE EXCEPTION 'Solo validate_plan() puede cambiar status a VALIDATED';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
```

### Bloque 3: validate_plan con rama EDITED temprana (ajuste obligatorio 1)

La rama EDITED se ejecuta **antes** de cualquier validacion de campos o chequeo de lecciones. Retorna inmediatamente.

Usa `ARRAY[]::text[]` en vez de `'{}'::text[]` (ajuste obligatorio 2).

```sql
CREATE OR REPLACE FUNCTION public.validate_plan(p_plan_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
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

  -- RAMA EDITED: retorno temprano sin validaciones ni creacion de lecciones
  IF v_plan.status = 'EDITED' THEN
    SET LOCAL app.validate_plan_bypass = 'true';
    UPDATE plans SET status = 'VALIDATED' WHERE id = p_plan_id;
    RETURN jsonb_build_object('success', true, 'errors', ARRAY[]::text[]);
  END IF;

  -- Solo INCOMPLETE puede seguir; cualquier otro estado se rechaza
  IF v_plan.status != 'INCOMPLETE' THEN
    RETURN jsonb_build_object('success', false, 'errors', ARRAY['Estado no permite validacion']);
  END IF;

  -- Validaciones de campos (solo para INCOMPLETE -> VALIDATED)
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

## 2.2 StatusBadge.tsx: mapeos EDITED + precedencia INVALIDATED > EDITED

**Archivo**: `src/components/ui/StatusBadge.tsx`

Actualizar 4 funciones:

```typescript
// planLabel
export function planLabel(status: string | null | undefined): string {
  switch (status) {
    case "VALIDATED": return "Validado";
    case "EDITED": return "Editado";
    default: return "Incompleto";
  }
}

// planTone
export function planTone(status: string | null | undefined): Tone {
  switch (status) {
    case "VALIDATED": return "success";
    case "EDITED": return "danger";
    default: return "warning";
  }
}

// materialLabel: precedencia INVALIDATED > EDITED
export function materialLabel(status: string | null | undefined): string {
  switch (status) {
    case "INVALIDATED": return "Invalidado";
    case "EDITED": return "Editado";
    case "GENERATED": return "Generado";
    case "VALIDATED": return "Validado";
    default: return "Sin generar";
  }
}

// materialTone: precedencia INVALIDATED > EDITED
export function materialTone(status: string | null | undefined): Tone {
  switch (status) {
    case "INVALIDATED": return "danger";
    case "EDITED": return "danger";
    case "GENERATED": return "warning";
    case "VALIDATED": return "success";
    default: return "neutral";
  }
}
```

Nota: La precedencia INVALIDATED > EDITED se resuelve en la capa de datos (el status ya refleja la precedencia correcta). Los mappers simplemente renderizan lo que reciben. Si un material esta INVALIDATED, ese es el status que llega.

---

## 2.3 PlanEditor.tsx: logica de edicion post-validacion

**Archivo**: `src/components/plan/PlanEditor.tsx`

Cambios principales:

1. **readOnly**: cambia de `planStatus === "VALIDATED" || !!courseArchived` a solo `!!courseArchived`

2. **Nuevos estados locales**:
   - `currentStatus` (inicializado con `planStatus`)
   - `hasEditedAfterValidation` (boolean, default false)

3. **useEffect para sincronizar props -> estado local** (ajuste obligatorio 3):
   ```typescript
   useEffect(() => {
     setCurrentStatus(planStatus);
     if (planStatus === "VALIDATED") {
       setHasEditedAfterValidation(false);
     }
   }, [planStatus]);
   ```

4. **saveField actualizado**: si `currentStatus === "VALIDATED"` y es primer cambio:
   - Hacer update `{ status: "EDITED" }` ademas del campo
   - `setCurrentStatus("EDITED")`
   - `setHasEditedAfterValidation(true)`

5. **Badge dinamico** (usando `currentStatus`):
   - VALIDATED -> "Validado" (default variant)
   - EDITED -> "Editado" (destructive variant) + microcopy debajo
   - INCOMPLETE -> "Incompleto" (secondary variant)

6. **CTA condicional**:
   - INCOMPLETE -> boton "Validar"
   - EDITED -> boton "Validar cambios"
   - VALIDATED -> sin CTA (ya esta validado)

7. **Microcopy** debajo del badge cuando EDITED:
   ```
   "Editado por docente: requiere validacion para quedar como version final."
   ```

8. **handleValidate toast**: si `hasEditedAfterValidation` (viene de EDITED), mostrar "Plan revalidado" sin "Se crearon las lecciones".

---

## 2.4 Course.tsx: fix critico de visibilidad tabs con EDITED

**Archivo**: `src/pages/Course.tsx`

Bug actual: `planValidated = plan?.status === "VALIDATED"` (linea 142). Cuando el plan pasa a EDITED, las tabs Agenda/Lecciones desaparecen y las lecciones no se fetchean (linea 82).

Fix:
- Linea 82: cambiar condicion de `planData?.status === "VALIDATED"` a `planData?.status === "VALIDATED" || planData?.status === "EDITED"` (las lecciones ya existen)
- Linea 142: cambiar `planValidated` a `plan?.status === "VALIDATED" || plan?.status === "EDITED"`

Esto garantiza que al pasar a EDITED, Agenda y Lecciones siguen visibles (ajuste obligatorio 7 del checklist).

---

## 2.5 Nombres de botones

| Archivo | Cambio |
|---------|--------|
| PlanEditor.tsx | "Validar Plan" -> "Validar" (INCOMPLETE) / "Validar cambios" (EDITED) |
| BriefForm.tsx | Ya dice "Guardar" (OK) |
| GenerateButton.tsx | Ya dice "Generar" (OK) |

---

## Resumen de archivos modificados

| Archivo | Cambio |
|---------|--------|
| `src/components/lesson/BriefForm.tsx` | Agregar `e.returnValue = ''` (1 linea) |
| Migracion SQL (1 archivo) | EDITED en enums + trigger + validate_plan |
| `src/components/ui/StatusBadge.tsx` | Mapeos EDITED en planLabel/planTone/materialLabel/materialTone |
| `src/components/plan/PlanEditor.tsx` | Logica edicion post-validacion completa |
| `src/pages/Course.tsx` | Fix `planValidated` para incluir EDITED |

## Checklist de pruebas manuales (7 casos)

1. **INCOMPLETE -> Validar**: Plan con campos completos + 28 lecciones. Presionar "Validar". Status = VALIDATED, lecciones creadas, CTA desaparece.
2. **VALIDATED -> Editar campo**: Editar fundamentacion. Badge cambia a "Editado" (rojo), microcopy aparece, CTA dice "Validar cambios".
3. **EDITED -> Validar cambios**: Presionar "Validar cambios". Status vuelve a VALIDATED, sin lecciones duplicadas, CTA desaparece.
4. **Curso archivado**: Campos disabled independientemente del status del plan.
5. **beforeunload BriefForm**: Editar campo sin guardar, cerrar pestana -> dialogo nativo aparece.
6. **EDITED -> Validar cambios -> refresh**: Tras refresh, status queda VALIDATED y contenido editado persiste.
7. **Tabs con EDITED**: Cuando plan esta EDITED, Agenda y Lecciones siguen visibles (no desaparecen).
