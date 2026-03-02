
# PRD Consolidado — Canon de Forma COMPLETO (Ajustado)

## Ajustes obligatorios incorporados

A) Canon para Planificacion y Secuencia (no solo Clase)
B) Definicion de INVALIDATED vs EDITED con precedencia
C) Cronograma como requisito final explicito (Fase 4 transitoria con modo puente)

---

## FASE 1 — UI del Curso con Tabs + Navegacion (sin backend)

### 1.1 Course.tsx: Tabs canonicas

Envolver PlanEditor, AgendaView y lista de lecciones en `Tabs` controlado:
- "Planificacion" (siempre visible) -> PlanEditor
- "Agenda" (solo si plan.status === "VALIDATED") -> AgendaView
- "Lecciones" (solo si plan.status === "VALIDATED") -> lista actual de lecciones

Tab por defecto: "Planificacion". Tabs no disponibles se ocultan.

**Archivo**: `src/pages/Course.tsx` (reestructurar lineas 191-255)

### 1.2 AgendaView.tsx: layout grid tipo Demo

Reemplazar `<Table>` por layout con `div` + grid:
- `grid-cols-[2.5rem_1fr_auto_auto_auto]` (N, Tema, Fecha, Estado, Accion)
- Columna "Estado": StatusBadge derivado de lesson status existente (fetch `status` de lessons)
- Columna "Accion": boton exacto "Ver clase" como `Link` a `/lesson/{lessonId}`
- Eliminar imports Table/TableBody/etc
- Patron visual identico al tab Agenda en Demo.tsx

**Archivo**: `src/components/plan/AgendaView.tsx` (reescritura)

### 1.3 Lesson.tsx: boton "Volver al curso"

Cambiar boton ghost icon-only por boton con texto visible:
```
<Button variant="ghost" size="sm" asChild>
  <Link to={`/course/${lesson.course_id}`}>
    <ArrowLeft className="h-4 w-4 mr-2" />
    Volver al curso
  </Link>
</Button>
```

**Archivo**: `src/pages/Lesson.tsx` (lineas 194-198)

### 1.4 BriefForm: guard de cambios sin guardar

Agregar dirty tracking (comparar estado actual vs props iniciales) + `beforeunload` listener cuando dirty.

**Archivo**: `src/components/lesson/BriefForm.tsx`

---

## FASE 2 — Estado "Editado" + Revalidacion (DB + UI)

### 2.1 Migracion DB: EDITED en enums (idempotente)

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

### 2.2 Trigger: permitir VALIDATED -> EDITED

Modificar `prevent_direct_plan_validation()` para permitir:
- `NEW.status = 'EDITED' AND OLD.status = 'VALIDATED'` -> permitir sin bypass

### 2.3 validate_plan: aceptar revalidacion desde EDITED

Cambiar condicion de rechazo:
- Actual: `IF v_plan.status = 'VALIDATED' THEN rechazar`
- Nuevo: `IF v_plan.status NOT IN ('INCOMPLETE', 'EDITED') THEN rechazar`
- Si viene de EDITED: solo actualizar status a VALIDATED (NO crear lecciones nuevas)

### 2.4 Precedencia de estados (regla de producto)

Definir precedencia: **INVALIDATED > EDITED > VALIDATED > GENERATED > INCOMPLETE**

- INVALIDATED = falla estructural / canon incompleto / requiere "Regenerar"
- EDITED = docente modifico algo validado / requiere "Validar cambios"
- Un artefacto no puede estar EDITED e INVALIDATED a la vez; si se invalida por canon, INVALIDATED prevalece

### 2.5 StatusBadge.tsx: mapeos canonicos

Agregar:
- `planLabel("EDITED")` -> "Editado", `planTone("EDITED")` -> "danger"
- `materialLabel("EDITED")` -> "Editado", `materialTone("EDITED")` -> "danger"

Microcopy bajo badge Editado (exacto):
"Editado por docente: requiere validacion para quedar como version final."

**Archivo**: `src/components/ui/StatusBadge.tsx`

### 2.6 PlanEditor.tsx: logica de edicion post-validacion

- Dejar de bloquear edicion cuando VALIDATED (solo bloquear si courseArchived)
- Al primer cambio real cuando status === "VALIDATED":
  - Update plans.status a "EDITED"
  - Badge rojo "Editado" + microcopy
  - CTA cambia a "Validar cambios"
- Cuando VALIDATED sin cambios: no mostrar CTA
- Cuando INCOMPLETE: CTA = "Validar"

**Archivo**: `src/components/plan/PlanEditor.tsx`

### 2.7 Nombres exactos de botones

| Archivo | Actual | Canonico |
|---------|--------|----------|
| GenerateButton.tsx | "Generar materiales" | "Generar" |
| PlanEditor.tsx | "Validar Plan" | "Validar" / "Validar cambios" |
| BriefForm.tsx | "Guardar borrador" | "Guardar" |
| AgendaView.tsx | (nuevo) | "Ver clase" |
| Lesson.tsx | (icono solo) | "Volver al curso" |

---

## FASE 3 — Canon de Forma en Generacion (COMPLETO: Clase + Planificacion + Secuencia)

### 3A. Canon de CLASE (12 secciones)

#### 3A.1 Migracion DB: extended_content

```sql
ALTER TABLE teaching_materials
ADD COLUMN IF NOT EXISTS extended_content jsonb NOT NULL DEFAULT '{}'::jsonb;
```

#### 3A.2 Edge function: prompt canonico de Clase

Actualizar `generate-materials/index.ts`:
- Expandir teaching prompt para exigir 12 secciones canonicas:
  1. Encabezado (tema + duracion + ubicacion)
  2. Proposito
  3. Contenidos de la clase (lista)
  4. Bibliografia de base
  5. (Material de lectura = reading_material separado)
  6. Desarrollo (4 bloques: Entrada 10-15', Lectura guiada 20-25', Actividad central 35-40', Cierre 10-15')
  7. Evidencia minima
  8. Criterios de validez
  9. Recuperacion equivalente
  10. Recursos
  11. Plan B
  12. Adaptaciones situadas

- Expandir tool schema con campos: `class_header`, `class_contents`, `base_bibliography`, `entry_block`, `guided_reading_block`, `central_activity_block`, `closing_block`, `minimum_evidence`, `validity_criteria`, `equivalent_recovery`, `resources`, `plan_b`, `situated_adaptations`

- Almacenar en `extended_content` JSONB (retrocompatibilidad con campos legacy)

#### 3A.3 Validacion post-generacion (Clase)

Verificar que ninguna de las 12 secciones este vacia. Si falta alguna -> INVALIDATED + razon "Seccion X faltante" + CTA "Regenerar".

#### 3A.4 TeachingMaterialView.tsx: render 12 cards tipo Demo

Leer `material.extended_content` y renderizar 12 cards individuales. Fallback a campos legacy si extended_content vacio.

**Archivo**: `src/components/lesson/TeachingMaterialView.tsx`

#### 3A.5 ReadingMaterialView.tsx: Card wrapper consistente

Envolver en Card con CardHeader + CardTitle exacto "Material de lectura para estudiantes".

**Archivo**: `src/components/lesson/ReadingMaterialView.tsx`

### 3B. Canon de PLANIFICACION (13 secciones)

#### 3B.1 Nueva edge function: generate-plan

Crear `supabase/functions/generate-plan/index.ts` que genera Planificacion canonica con 13 secciones obligatorias:

1. Fundamentacion (5 componentes obligatorios: necesidad formativa, enfoque disciplinar, ejes organizadores, anclaje situado, propuesta didactica+evaluacion)
2. Objetivos generales
3. Objetivos de aprendizaje
4. Contenidos (por tramo/cuatrimestre)
5. Organizacion espacio-temporal / Cronograma
6. Estrategias didacticas
7. Recursos (4 subbloques: infraestructura, materiales, casos, aportes)
8. Adaptaciones situadas (barrera -> ajuste)
9. Formas de evaluar
10. Rubrica (criterios + niveles)
11. Bibliografia (general / casos / integracion)
12. Carpeta de casos
13. Ejemplo desarrollado (paso a paso)

Input: course_id + datos existentes del plan (fundamentacion, estrategias, etc.) como contexto base.
Output: JSONB con las 13 secciones completas.

#### 3B.2 Migracion DB: campo generated_plan_content en plans

```sql
ALTER TABLE plans
ADD COLUMN IF NOT EXISTS generated_content jsonb NOT NULL DEFAULT '{}'::jsonb;
```

#### 3B.3 Validacion post-generacion (Planificacion)

- Verificar 13 secciones presentes y no vacias
- Verificar Fundamentacion tiene 5 componentes
- Verificar Recursos tiene 4 subbloques
- Si falta algo -> INVALIDATED + razon + CTA "Regenerar"

#### 3B.4 UI: boton "Generar" en PlanEditor + vista readonly tipo Demo

- Agregar boton "Generar" (o "Regenerar") en PlanEditor cuando plan esta INCOMPLETE
- Tras generacion exitosa, renderizar las 13 secciones como cards individuales (1 Card por seccion, scroll vertical, patron identico a Demo.tsx)
- El docente puede editar el contenido generado (pasa a EDITED)
- "Validar" / "Validar cambios" para cerrar ciclo

### 3C. Canon de SECUENCIA (global + N clases)

#### 3C.1 Nueva edge function: generate-sequence

Crear `supabase/functions/generate-sequence/index.ts` que genera Secuencia canonica:

Bloque global obligatorio:
- Propositos
- Alcances y encuadre
- Aprendizajes esperados
- Evidencia minima (Producto integrador + Recuperacion equivalente)
- Evaluacion formativa (instrumento comun)
- Plantilla unica de produccion
- Material de lectura para estudiantes (si aplica)

Bloque por clase i=1..N (forma fija):
- Proposito de la clase
- Entrada (10-15')
- Desarrollo (55-60')
- Cierre y salida (10-15')
- Plan B low-tech

N es variable segun lo solicitado, pero la forma interna es fija.

#### 3C.2 Migracion DB: tabla sequences o campo en plans

Opcion recomendada: nueva tabla `sequences`:
```sql
CREATE TABLE sequences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT '',
  lesson_range_start integer NOT NULL,
  lesson_range_end integer NOT NULL,
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  status material_status NOT NULL DEFAULT 'GENERATED',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE sequences ENABLE ROW LEVEL SECURITY;
-- RLS: owners can manage via plan ownership
```

#### 3C.3 Validacion post-generacion (Secuencia)

- Verificar bloque global completo (7 secciones)
- Verificar cada clase i tiene estructura fija (5 secciones)
- Si falta algo -> INVALIDATED + razon + CTA "Regenerar"

#### 3C.4 UI: vista de secuencia tipo Demo

Renderizar secuencia como cards por seccion (patron Demo.tsx tab Secuencia). Accesible desde Course.tsx (posiblemente como sub-tab o desde Agenda).

### 3D. Regla general INVALIDATED

Para los 3 artefactos (Clase, Planificacion, Secuencia):
- Si falta seccion obligatoria o componente obligatorio -> INVALIDATED
- Mostrar badge rojo "Invalidado" + razones + CTA "Regenerar"
- INVALIDATED prevalece sobre EDITED en precedencia

---

## FASE 4 — Cronograma con Calendario Oficial (REQUISITO FINAL, implementacion futura)

### 4.0 Modo puente (transitorio, explicito)

Hasta tener calendarios oficiales cargados:
- El docente configura manualmente rango de fechas y/o cantidad de clases
- El cronograma se genera con esos datos
- Al editar cronograma: estado "Editado" + "Validar cambios"
- **EXPLICITO**: este modo es transitorio; el producto final requiere calendario oficial

### 4.1 Requisito final (no negociable)

El producto final debe cumplir:
- Cronograma = calendario oficial (jurisdiccion/nivel/anio) + match dia/horario docente
- Excepcion 1er anio escalonado (offset 1 semana antes si la jurisdiccion lo establece)
- Tabla `official_calendars` con no lectivos, recesos, offset por anio

### 4.2 Tabla official_calendars

```sql
CREATE TABLE official_calendars (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  jurisdiction text NOT NULL DEFAULT 'PBA',
  level text NOT NULL,
  year_level integer,
  academic_year integer NOT NULL,
  non_school_dates date[] NOT NULL DEFAULT '{}',
  recess_ranges jsonb NOT NULL DEFAULT '[]',
  first_year_offset_days integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

### 4.3 Inputs en CourseNew.tsx

Agregar: jurisdiccion, nivel/modalidad, dia(s) y horario(s).

### 4.4 Generacion automatica de fechas

Match calendario + horarios docente -> scheduled_date por leccion.

### 4.5 Excepcion 1er anio

Usar `first_year_offset_days` del calendario oficial.

---

## Orden de implementacion

```text
Fase 1.1  Course.tsx Tabs                      (UI)
Fase 1.2  AgendaView grid + Ver clase          (UI)
Fase 1.3  Lesson.tsx "Volver al curso"          (UI)
Fase 1.4  BriefForm unsaved changes guard       (UI)
--- verificar ---
Fase 2.1  DB: EDITED en enums                  (migracion)
Fase 2.2  DB: trigger VALIDATED->EDITED         (migracion)
Fase 2.3  DB: validate_plan revalidacion        (migracion)
Fase 2.5  StatusBadge mapeos EDITED             (UI)
Fase 2.6  PlanEditor logica EDITED              (UI+DB)
Fase 2.7  Nombres de botones                   (UI)
--- verificar ---
Fase 3A.1 DB: extended_content                  (migracion)
Fase 3A.2 Edge function: prompt Clase           (backend)
Fase 3A.3 Validacion post-gen Clase             (backend)
Fase 3A.4 TeachingMaterialView 12 cards         (UI)
Fase 3A.5 ReadingMaterialView wrapper           (UI)
--- verificar canon Clase ---
Fase 3B.2 DB: generated_content en plans        (migracion)
Fase 3B.1 Edge function: generate-plan          (backend)
Fase 3B.3 Validacion post-gen Planificacion     (backend)
Fase 3B.4 PlanEditor: Generar + vista cards     (UI)
--- verificar canon Planificacion ---
Fase 3C.2 DB: tabla sequences                  (migracion)
Fase 3C.1 Edge function: generate-sequence      (backend)
Fase 3C.3 Validacion post-gen Secuencia         (backend)
Fase 3C.4 Vista secuencia tipo Demo             (UI)
--- verificar canon Secuencia ---
Fase 4.*  Calendario oficial                   (futuro, requisito final)
```

## Archivos modificados (resumen completo)

| Fase | Archivo | Cambio |
|------|---------|--------|
| 1.1 | src/pages/Course.tsx | Tabs layout |
| 1.2 | src/components/plan/AgendaView.tsx | Grid + Ver clase + StatusBadge |
| 1.3 | src/pages/Lesson.tsx | "Volver al curso" |
| 1.4 | src/components/lesson/BriefForm.tsx | Dirty tracking + beforeunload |
| 2.1-2.3 | Migracion SQL | EDITED enum + trigger + validate_plan |
| 2.5 | src/components/ui/StatusBadge.tsx | Mapeos EDITED |
| 2.6 | src/components/plan/PlanEditor.tsx | Logica edicion post-validacion |
| 2.7 | src/components/lesson/GenerateButton.tsx | "Generar" |
| 3A.1 | Migracion SQL | extended_content |
| 3A.2-3 | supabase/functions/generate-materials/index.ts | Prompt 12 secciones + validacion |
| 3A.4 | src/components/lesson/TeachingMaterialView.tsx | 12 cards canonicas |
| 3A.5 | src/components/lesson/ReadingMaterialView.tsx | Card wrapper |
| 3B.1 | supabase/functions/generate-plan/index.ts | NUEVA edge function |
| 3B.2 | Migracion SQL | generated_content en plans |
| 3B.4 | src/components/plan/PlanEditor.tsx | Generar + vista cards |
| 3C.1 | supabase/functions/generate-sequence/index.ts | NUEVA edge function |
| 3C.2 | Migracion SQL | tabla sequences |
| 3C.4 | Nuevo componente (ej. SequenceView.tsx) | Vista secuencia |
| 4.* | Migracion SQL + CourseNew.tsx | Calendario oficial (futuro) |

## Checklist UI (nombres exactos)

- Tabs Course: "Planificacion", "Agenda", "Lecciones"
- Tabs PlanEditor: "Fundamentacion", "Estrategias", "Evaluacion", "Propositos" (sin cambio)
- Botones: "Generar", "Regenerar", "Validar", "Validar cambios", "Ver clase", "Volver al curso", "Guardar"
- Badges: "Generado" (amarillo), "Validado" (verde), "Editado" (rojo), "Invalidado" (rojo destructive)
- Microcopy Editado: "Editado por docente: requiere validacion para quedar como version final."
- Precedencia: INVALIDATED > EDITED > VALIDATED > GENERATED > INCOMPLETE

## Nota sobre alcance

Este plan ES "Canon Completo": cubre Clase (12 secciones), Planificacion (13 secciones + Fundamentacion 5 componentes), y Secuencia (global + N clases con forma fija). Fase 4 (calendario oficial) queda como requisito final explicito con modo puente transitorio.
