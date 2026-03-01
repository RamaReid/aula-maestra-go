

# DEMO Golden Master + Motor Canonico de Planificaciones

Plan final con los 3 ajustes incorporados. 7 tareas, 8 archivos afectados.

---

## TAREA 1 -- Migraciones DB (2 columnas nuevas)

Dos ALTER TABLE:

```sql
ALTER TABLE plans ADD COLUMN resources text NOT NULL DEFAULT '';
ALTER TABLE plan_lessons ADD COLUMN activities_summary text NOT NULL DEFAULT '';
```

No se requieren cambios de RLS (policies existentes cubren owner access).

---

## TAREA 2 -- UI: PlanEditor (6 tabs)

**Archivo:** `src/components/plan/PlanEditor.tsx`

Cambios:
- Agregar `resources` al tipo `PlanData` y al SELECT (linea 43).
- Cambiar TabsList de `grid-cols-4` a `grid-cols-3 md:grid-cols-6`.
- Agregar TabsTrigger "Recursos" y TabsTrigger "Cronograma".
- TabsContent "recursos": Label + Textarea (rows=8) con autosave debounce 500ms (mismo patron que fundamentacion).
- TabsContent "cronograma": renderiza `<PlanLessonsEditor planId={planId} readOnly={readOnly} />`.
- Reemplazar Badge (linea 120-122) por StatusBadge con `planTone`/`planLabel`.
- Renombrar tab "Propositos" a "Objetivos (4-8)" (ajuste #3).

---

## TAREA 3 -- Nuevo componente PlanLessonsEditor

**Archivo nuevo:** `src/components/plan/PlanLessonsEditor.tsx`

Props: `planId: string`, `readOnly: boolean`.

Funcionalidad:
- Fetch las 28 plan_lessons ordenadas por lesson_number.
- **Ajuste #1:** Si count < 28, muestra boton "Recrear cronograma (1..28)" que:
  - DELETE plan_lessons WHERE plan_id = planId
  - INSERT 28 filas con lesson_number 1..28, term auto (1 para 1-14, 2 para 15-28), campos vacios
  - Re-fetch despues del insert
- Muestra tabla agrupada por cuatrimestre (separador "Cuatrimestre 1" / "Cuatrimestre 2").
- Columnas: #, Tema, Actividades, Term.
- `theme` y `activities_summary` editables via Input/Textarea inline con autosave onBlur (update por plan_lesson id).
- `learning_outcome` y `justification` editables en accordion expandible por fila (click para ver detalles).

---

## TAREA 4 -- RPC validate_plan (enforcement duro)

**Migracion SQL:** CREATE OR REPLACE FUNCTION validate_plan

Agregar despues de las validaciones existentes (sin tocar las que ya estan):

```sql
-- Validar resources (incluido en SELECT * que ya usa)
IF length(trim(v_plan.resources)) = 0 THEN
  v_errors := array_append(v_errors, 'Recursos es obligatorio');
END IF;

-- Validar activities_summary en cada plan_lesson
FOR v_pl IN SELECT lesson_number, activities_summary
            FROM plan_lessons WHERE plan_id = p_plan_id
            ORDER BY lesson_number
LOOP
  IF length(trim(v_pl.activities_summary)) = 0 THEN
    v_errors := array_append(v_errors, 'Clase ' || v_pl.lesson_number || ': Actividades es obligatorio');
  END IF;
END LOOP;
```

El SELECT * del plan ya incluye `resources` automaticamente al existir la columna.

---

## TAREA 5 -- DEMO fixture (seed)

**Archivo nuevo:** `supabase/functions/seed-demo-course/index.ts`

Edge function que:
- Usa SERVICE_ROLE_KEY para bypass RLS.
- **Ajuste #2 (idempotente sin borrar curso):**
  - Busca escuela por nombre "EESA Demo (Canon)". Si no existe, la crea. Si existe, la reutiliza.
  - Busca curso por subject + year_level + school_id del caller. Si no existe, lo crea. Si existe, reutiliza el id.
  - Busca plan por course_id. Si no existe, lo crea. Si existe, hace UPDATE de los campos (fundamentacion, estrategias_marco, etc.).
  - DELETE + INSERT para plan_objectives (8 items, los "Objetivos de aprendizaje" del canon).
  - DELETE + INSERT para plan_lessons (28 filas completas del cronograma del canon).
  - IDs del curso y plan quedan estables.

Datos del canon (del archivo adjunto):
- `fundamentacion`: texto completo (~2500 chars, lineas 11-21 del archivo).
- `estrategias_marco`: texto de "Estrategias didacticas" (lineas 142-146).
- `estrategias_practicas`: 5 items array ("Exposicion dialogada...", "Lectura guiada...", "Trabajo con situaciones...", "Organizacion de la informacion...", "Tecnicas grupales...").
- `evaluacion_marco`: texto completo de "Formas de evaluar" incluyendo rubrica C1-C5 (lineas 191-227).
- `resources`: texto completo de "Recursos" (lineas 152-177).
- `plan_objectives`: 8 items de "Objetivos de aprendizaje" (lineas 43-50). **Ajuste #3 nota:** estos se almacenan como plan_objectives y en UI se muestran como "Objetivos (4-8)".
- `plan_lessons`: 28 filas del cronograma (lineas 106-136):
  - theme: titulo de cada clase (ej: "Concepto de Filosofia: que es, para que y como se practica")
  - activities_summary: texto despues de "Actividades:" (ej: "definicion operativa (5-7 lineas) con ejemplo")
  - learning_outcome: derivado del contenido
  - term: 1 para 1-14, 2 para 15-28

---

## TAREA 6 -- demo_contract_check RPC

**Migracion SQL:** nueva funcion RPC.

- SECURITY DEFINER con checks de auth.uid() + is_course_owner().
- STABLE (no muta estado).
- Ejecuta los mismos checks estructurales que validate_plan:
  - fundamentacion >= 100 chars
  - estrategias_marco no vacio
  - evaluacion_marco no vacio
  - estrategias_practicas >= 1
  - resources no vacio (nuevo)
  - plan_objectives 4-8
  - plan_lessons == 28
  - activities_summary no vacio para cada clase (nuevo)
- Retorna `{ success: boolean, errors: string[] }` sin mutar estado ni insertar lessons.

---

## TAREA 7 -- AgendaView (columna Actividades)

**Archivo:** `src/components/plan/AgendaView.tsx`

- Extender select de plan_lessons (linea 36) de `"id, theme"` a `"id, theme, activities_summary"`.
- Agregar `activities_summary` al tipo `LessonRow` y al mapeo.
- Agregar columna "Actividades" a la tabla entre "Tema" y "Fecha".
- Rotulo "Actividades" (no "Evidencia").

---

## Archivos afectados

| # | Archivo | Accion |
|---|---------|--------|
| 1 | DB: plans | ALTER ADD resources |
| 2 | DB: plan_lessons | ALTER ADD activities_summary |
| 3 | DB: RPC validate_plan | CREATE OR REPLACE (agregar checks) |
| 4 | DB: RPC demo_contract_check | CREATE nueva funcion |
| 5 | src/components/plan/PlanEditor.tsx | Modificar: 6 tabs, resources, cronograma, StatusBadge, label "Objetivos (4-8)" |
| 6 | src/components/plan/PlanLessonsEditor.tsx | Crear: editor 28 clases con fallback recrear |
| 7 | src/components/plan/PlanObjectivesEditor.tsx | Modificar: label "propositos" -> "objetivos" |
| 8 | src/components/plan/AgendaView.tsx | Modificar: columna Actividades |
| 9 | supabase/functions/seed-demo-course/index.ts | Crear: fixture DEMO idempotente |

**NO se toca:** generate-materials, AuthContext, lesson_briefs, reading/teaching_materials, Demo.tsx, CourseNew.tsx.

---

## Secuencia de ejecucion

1. Migraciones DB (TAREA 1) -- plans.resources + plan_lessons.activities_summary
2. RPC validate_plan actualizado (TAREA 4)
3. RPC demo_contract_check (TAREA 6)
4. Componentes UI (TAREAS 2, 3, 7) -- PlanEditor + PlanLessonsEditor + PlanObjectivesEditor + AgendaView
5. Seed fixture DEMO (TAREA 5) -- edge function
6. QA: invocar seed-demo-course, luego demo_contract_check sobre el plan DEMO -> success=true

---

## Resumen de los 3 ajustes aplicados

| # | Ajuste | Resolucion |
|---|--------|------------|
| 1 | Fallback count < 28 | Boton "Recrear cronograma (1..28)" en PlanLessonsEditor que hace delete+insert 28 filas |
| 2 | Seed idempotente sin borrar curso | Upsert por entidad: buscar/reutilizar curso+plan, delete+insert solo objectives y lessons |
| 3 | Label UI plan_objectives | Cambiar "Propositos" a "Objetivos (4-8)" en PlanEditor tab y PlanObjectivesEditor |

