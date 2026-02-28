

# Plan: Cerrar PRD 1.2 Foundation — Con 3 Ajustes P0 Corregidos

## Resumen

Implementar 5 entregables de PRD 1.2 con las 3 correcciones P0 exigidas por el usuario, integradas en una unica migracion SQL y cambios de UI minimos.

---

## Migracion SQL (1 archivo)

### A) config.toml — Mecanismo real de seguridad JWT

Lovable Cloud usa un sistema de signing-keys donde `verify_jwt = true` (el default) no funciona correctamente. El sistema indica que config.toml es auto-generado y no debe editarse manualmente. En su lugar:

- Ambas edge functions (`generate-materials` y `check-course-limit`) ya validan JWT manualmente via `getClaims()` en codigo
- `generate-materials` linea ~280: valida `Authorization: Bearer` + `getClaims(token)`, retorna 401 si falla
- `check-course-limit` linea ~22: misma validacion, retorna 401 si falla

**Test de seguridad a ejecutar post-implementacion**: Llamar ambas funciones sin header Authorization y con token invalido, verificar que retornan 401. Esto se documentara como QA test #11.

### B) Funcion `is_course_not_archived_for_plan(p_plan_id UUID)` — helper

```sql
CREATE OR REPLACE FUNCTION public.is_course_not_archived_for_plan(p_plan_id UUID)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (
    SELECT 1 FROM plans p
    JOIN courses c ON c.id = p.course_id
    WHERE p.id = p_plan_id AND c.status = 'ACTIVE'
  );
$$;
```

### C) Funcion `is_course_not_archived_for_lesson(p_lesson_id UUID)` — helper para agenda

```sql
CREATE OR REPLACE FUNCTION public.is_course_not_archived_for_lesson(p_lesson_id UUID)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (
    SELECT 1 FROM lessons l
    JOIN courses c ON c.id = l.course_id
    WHERE l.id = p_lesson_id AND c.status = 'ACTIVE'
  );
$$;
```

### D) Trigger `prevent_direct_plan_validation` — BEFORE UPDATE en plans

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

CREATE TRIGGER prevent_direct_plan_validation
  BEFORE UPDATE ON plans
  FOR EACH ROW
  EXECUTE FUNCTION prevent_direct_plan_validation();
```

`COALESCE(..., '')` trata null como "no bypass" (bloquea).

### E) Funcion `validate_plan(p_plan_id UUID)` — SECURITY DEFINER

- Verifica ownership via `is_course_owner(auth.uid(), course_id)`
- Valida: fundamentacion >= 100, estrategias_marco no vacio, evaluacion_marco no vacio, estrategias_practicas >= 1, objectives entre 4 y 8, plan_lessons == 28 exacto (no `< 28`, sino `!= 28`)
- Verifica que NO existan lessons para el curso (prevenir duplicados): `SELECT count(*) FROM lessons WHERE course_id = v_course_id` debe ser 0, si > 0 retorna error "Ya existen lecciones para este curso"
- `SET LOCAL app.validate_plan_bypass = 'true'` antes del UPDATE
- UPDATE plans SET status = VALIDATED
- INSERT lessons batch desde plan_lessons
- Retorna JSON `{success: bool, errors: text[]}`

### F) Policies RLS modificadas

**plans UPDATE** — DROP + recrear con USING owner AND WITH CHECK owner+not_archived:

```sql
DROP POLICY IF EXISTS "Owners can update plans" ON plans;
CREATE POLICY "Owners can update plans" ON plans FOR UPDATE
  USING (is_course_owner(auth.uid(), course_id))
  WITH CHECK (is_course_owner(auth.uid(), course_id) AND is_course_not_archived_for_plan(id));
```

**plan_objectives** — DROP ALL policy, crear 4 separadas:

```sql
DROP POLICY IF EXISTS "Owners can manage plan objectives" ON plan_objectives;
-- SELECT: owner only
CREATE POLICY "Owners can view plan objectives" ON plan_objectives FOR SELECT
  USING (is_plan_owner(auth.uid(), plan_id));
-- INSERT: owner + not archived
CREATE POLICY "Owners can insert plan objectives" ON plan_objectives FOR INSERT
  WITH CHECK (is_plan_owner(auth.uid(), plan_id) AND is_course_not_archived_for_plan(plan_id));
-- UPDATE: owner + not archived
CREATE POLICY "Owners can update plan objectives" ON plan_objectives FOR UPDATE
  USING (is_plan_owner(auth.uid(), plan_id))
  WITH CHECK (is_plan_owner(auth.uid(), plan_id) AND is_course_not_archived_for_plan(plan_id));
-- DELETE: owner + not archived
CREATE POLICY "Owners can delete plan objectives" ON plan_objectives FOR DELETE
  USING (is_plan_owner(auth.uid(), plan_id) AND is_course_not_archived_for_plan(plan_id));
```

**plan_lessons** — Mismo patron que plan_objectives.

**lessons UPDATE** — DROP + recrear con USING owner AND WITH CHECK owner+not_archived (bloquea agenda en ARCHIVED):

```sql
DROP POLICY IF EXISTS "Owners can update lessons" ON lessons;
CREATE POLICY "Owners can update lessons" ON lessons FOR UPDATE
  USING (is_course_owner(auth.uid(), course_id))
  WITH CHECK (is_course_owner(auth.uid(), course_id) AND is_course_not_archived_for_lesson(id));
```

### Resumen de policies tocadas

| Tabla | Policy | Cambio |
|-------|--------|--------|
| plans | "Owners can update plans" | DROP + recrear con USING owner + WITH CHECK (owner AND not archived) |
| plan_objectives | "Owners can manage plan objectives" (ALL) | DROP + 4 policies separadas con check archived |
| plan_lessons | "Owners can manage plan lessons" (ALL) | DROP + 4 policies separadas con check archived |
| lessons | "Owners can update lessons" | DROP + recrear con WITH CHECK not archived |

---

## Entregable 1: Wizard de Creacion de Curso

### Nuevo: `src/pages/CourseNew.tsx`

Wizard 8 pasos con state machine local:

| Paso | Campo | Logica |
|------|-------|--------|
| 1 | Provincia | Fijo "PBA" (readonly) |
| 2 | Escuela | Select de `schools` + formulario inline para crear nueva (official_name, district, locality, school_type) |
| 3 | Ciclo | Select BASIC / UPPER |
| 4 | Ano | BASIC: 1-3, UPPER: 4-6 |
| 5 | Materia | Query `curriculum_documents` filtrado por cycle+year_level, DISTINCT subject. Fallback texto libre |
| 6 | Orientacion | Solo si UPPER + COMUN. Si BASIC o TECNICA: auto-skip |
| 7 | Especialidad | Solo si UPPER + TECNICA. Si no: auto-skip |
| 8 | Confirmacion + boton Crear |

Al crear:
1. Invoke `check-course-limit` — si `can_create=false`, toast y bloquear
2. INSERT `courses`
3. INSERT `plans` (course_id)
4. INSERT batch 28 `plan_lessons` (plan_id, lesson_number 1-28, term: 1-14=1, 15-28=2)
5. Navigate a `/course/:newId`

### Modificar: `src/App.tsx`

Agregar ruta `/course/new` ANTES de `/course/:courseId`.

### Modificar: `src/pages/Dashboard.tsx`

Linea 79: cambiar TODO por `navigate("/course/new")`.

---

## Entregable 2: PlanEditor usa RPC

### Modificar: `src/components/plan/PlanEditor.tsx`

- Reemplazar `handleValidate` para usar `supabase.rpc("validate_plan", { p_plan_id: planId })`
- Eliminar UPDATE directo a plans.status y INSERT de lessons
- Mantener validaciones client-side como UX feedback rapido
- Agregar prop `courseArchived?: boolean` — fuerza readOnly y oculta boton Validar

---

## Entregable 3: ARCHIVED UI

### Modificar: `src/pages/Course.tsx`

- Agregar `status` al CourseInfo interface y al fetch
- Boton "Archivar curso" con AlertDialog de confirmacion (solo si ACTIVE)
- Badge "Archivado" si status === ARCHIVED
- Pasar `courseArchived={course.status === 'ARCHIVED'}` a PlanEditor y AgendaView

---

## Entregable 4: Agenda

### Nuevo: `src/components/plan/AgendaView.tsx`

- Tabla: # | Tema | Fecha con Input type="date"
- UPDATE lessons SET scheduled_date al cambiar
- Prop readOnly para ARCHIVED (UI hint; server bloqueado por RLS)

### Modificar: `src/pages/Course.tsx`

Renderizar AgendaView despues de PlanEditor, solo si plan VALIDATED.

---

## Archivos afectados

| Archivo | Accion |
|---------|--------|
| Migracion SQL | Crear — validate_plan + trigger + helpers + policies |
| `src/pages/CourseNew.tsx` | Crear — Wizard 8 pasos |
| `src/components/plan/AgendaView.tsx` | Crear — Vista agenda |
| `src/App.tsx` | Modificar — ruta /course/new |
| `src/pages/Dashboard.tsx` | Modificar — navigate al wizard |
| `src/pages/Course.tsx` | Modificar — ARCHIVED UI + AgendaView + status |
| `src/components/plan/PlanEditor.tsx` | Modificar — RPC + courseArchived |

---

## QA: 11 Tests

| # | Test | Resultado esperado |
|---|------|-------------------|
| 1 | FREE, 0 cursos: wizard completo | Curso + plan + 28 plan_lessons en DB |
| 2 | FREE, 1 curso: click Nuevo curso | check-course-limit bloquea |
| 3 | Wizard BASIC: paso orientacion | Auto-skip |
| 4 | Wizard TECNICA+UPPER: paso especialidad | Campo obligatorio |
| 5 | Plan incompleto: Validar | RPC retorna errores, status INCOMPLETE |
| 6 | Plan completo: Validar | VALIDATED + 28 lessons, sin duplicados |
| 7 | UPDATE directo plans SET status='VALIDATED' | Trigger: "Solo validate_plan() puede cambiar status a VALIDATED" |
| 8 | Archivar curso ACTIVE | status=ARCHIVED, PlanEditor readonly |
| 9 | Curso ARCHIVED: INSERT plan_objective | RLS: "new row violates row-level security policy" |
| 10 | Curso ARCHIVED: UPDATE lesson scheduled_date | RLS bloquea (WITH CHECK falla) |
| 11 | Edge functions sin Authorization header | Ambas retornan 401 "No autorizado" |

