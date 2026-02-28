

# Plan: UI de Edicion y Validacion de Plan (F-5 a F-7)

## Resumen

Agregar al Course page una seccion de Plan editable (antes de las lecciones) con tabs para fundamentacion, estrategias, evaluacion, y propositos. Incluir boton "Validar Plan" que valide reglas y cambie status a VALIDATED, creando las 28 Lessons reales.

---

## Componentes a crear

### 1. `src/components/plan/PlanEditor.tsx`

Componente principal que recibe `planId`, `courseId`, `planStatus`. Usa Tabs con 4 secciones:

- **Fundamentacion**: Textarea para `fundamentacion` (minimo 100 caracteres para validar)
- **Estrategias**: Textarea para `estrategias_marco` + lista editable para `estrategias_practicas[]` (agregar/eliminar items)
- **Evaluacion**: Textarea para `evaluacion_marco`
- **Propositos**: Lista editable de `plan_objectives` (4-8 requeridos). Cada uno con input de texto + boton eliminar. Boton "Agregar proposito" (max 8).

Cada seccion guarda automaticamente al perder foco (debounced auto-save via UPDATE a `plans` o INSERT/UPDATE/DELETE a `plan_objectives`).

Si `planStatus === "VALIDATED"`, todo es read-only.

### 2. `src/components/plan/PlanObjectivesEditor.tsx`

Sub-componente para la lista de propositos:
- Fetch `plan_objectives` por `plan_id`, ordenados por `order_index`
- Input por cada objetivo con boton X para eliminar
- Boton "+ Agregar proposito" (deshabilitado si ya hay 8)
- Indicador visual "4-8 propositos requeridos" con conteo actual

### 3. Boton "Validar Plan"

Dentro de PlanEditor, un boton prominente que:

**Validaciones client-side antes de enviar:**
1. `fundamentacion.length >= 100` (texto minimo significativo)
2. `estrategias_marco` no vacio
3. `evaluacion_marco` no vacio
4. `estrategias_practicas.length >= 1`
5. `plan_objectives` count entre 4 y 8
6. Las 28 `plan_lessons` deben existir (ya creadas por el Wizard — por ahora se verifica que existan)

**Al validar:**
1. UPDATE `plans` SET `status = 'VALIDATED'`
2. Para cada una de las 28 `plan_lessons`, INSERT en `lessons` con `course_id`, `plan_lesson_id`, `lesson_number`, `status = 'PLANNED'`
3. Toast de exito
4. Refrescar estado — el editor pasa a read-only

---

## Modificaciones a archivos existentes

### `src/pages/Course.tsx`

- Fetch el `plan` asociado al curso (query `plans` WHERE `course_id = courseId`)
- Renderizar `<PlanEditor>` ANTES de la seccion de lecciones
- Mostrar Badge con status del plan (INCOMPLETE / VALIDATED)
- Si plan es VALIDATED, mostrar las lecciones. Si no, mostrar mensaje "Valida el plan para habilitar las lecciones"

---

## Detalles tecnicos

- No se necesitan migraciones SQL (las tablas y RLS ya existen)
- Se usa el Supabase client directamente para CRUD
- Auto-save con `onBlur` + debounce de 500ms en textareas
- Para `estrategias_practicas` (array de text): UI de chips/tags con input para agregar + X para eliminar
- Al crear lessons en la validacion, se usa un INSERT batch de las 28 rows

## Archivos

| Archivo | Accion |
|---------|--------|
| `src/components/plan/PlanEditor.tsx` | Crear |
| `src/components/plan/PlanObjectivesEditor.tsx` | Crear |
| `src/pages/Course.tsx` | Modificar — agregar fetch de plan + renderizar PlanEditor |

