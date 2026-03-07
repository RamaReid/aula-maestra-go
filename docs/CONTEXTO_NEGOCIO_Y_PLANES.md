# Contexto: Negocio y Planes

## Cabecera de evidencia

| Campo | Valor |
|---|---|
| Fecha/hora | 2026-03-07 |
| project_ref | `jsejuuyqjtevtoguljiv` |
| Branch | main |
| commit_sha | N/A |
| Autor | Lovable AI — fase de contexto |

---

## 1. Matriz de planes (FREE / BASICO / PREMIUM)

### Evidencia

Fuentes primarias:
- `src/hooks/useEntitlements.ts:20-30` — defaults FREE en frontend
- DB function `recalculate_entitlements` — logica server-side
- `src/pages/Billing.tsx:55-78` — copy de UI
- `supabase/functions/generate-materials/index.ts:251-254` — `isAuthorizedSourceAllowedForPlan`

### Matriz

| Feature | FREE | BASICO | PREMIUM | Evidencia (archivo:linea) |
|---|---|---|---|---|
| Cursos activos | 1 | 15 | 9999 | `recalculate_entitlements` p_max_courses |
| Sesiones/semana | 2 | 9999 | 9999 | `recalculate_entitlements` p_max_weekly_sessions |
| Clases/sesion | 3 | 9999 | 9999 | `recalculate_entitlements` p_max_classes_per_session |
| Watermark PDF | Si | No | No | `recalculate_entitlements` p_watermark_enabled |
| Storage persistente | No | Si | Si | `recalculate_entitlements` p_persistent_storage |
| Historial | No | Si | Si | `recalculate_entitlements` p_history_enabled |
| Copiloto | none | limited | full | `recalculate_entitlements` p_copiloto_mode |
| Auto-complete forms | No | No | Si | `recalculate_entitlements` p_auto_complete_forms |
| Fuentes docente archivo | No | Si | Si | `generate-materials/index.ts:251-254` |
| Fuentes docente URL/video | No | No | Si | `generate-materials/index.ts:251-254` |
| Upload manual PDF curricular | No | Si | Si | `import-curriculum-pdf/index.ts:100-108` |
| Secuencia consecutiva obligatoria | N/A (3 fijas) | Si | Si | `generate-materials/index.ts:727` |
| Free requiere exacto 3 clases | Si | No | No | `generate-materials/index.ts:668` |

---

## 2. Definicion "fuente valida" para generar materiales

### Evidencia

```
// generate-materials/index.ts:926-933
const requestedBibliographyIds = sanitizeIdList(brief.bibliografia_confirmada);
const requestedAuthorizedSourceIds = sanitizeIdList(brief.authorized_source_ids);
if (requestedBibliographyIds.length === 0 && requestedAuthorizedSourceIds.length === 0) {
  // Error: "Debe confirmar al menos una fuente para generar materiales"
}
```

### Conclusiones

**Fuente valida** = al menos UNO de:

1. **Nodo curricular de bibliografia**: UUID en `brief.bibliografia_confirmada`, validado contra protocolo de extraccion de bibliografia (`generate-materials/index.ts:1055-1069`). Si el nodo no pertenece a la seccion "Bibliografia" del diseno curricular, se rechaza.

2. **Fuente autorizada del docente**: UUID en `brief.authorized_source_ids`, con status `PROCESSED` o `APPROVED`, validada contra plan (FREE bloqueado) y contra target (clase o secuencia).

**Nodos de contenido curricular (EJE/UNIDAD/BLOQUE/CONTENIDO) NO son fuentes validas para generacion.** Se usan exclusivamente para trazabilidad via `plan_content_mappings`.

---

## 3. Separacion trazabilidad curricular vs bibliografia

| Capa | Trazabilidad (contenido curricular) | Bibliografia (fuentes) |
|---|---|---|
| **bootstrap-course-plan** | `nodesForMappings = uniqueNodes(safeCoreNodes).slice(0, 260)` — solo nodos core sin patron bibliografico. Linea 212. | `bibliographyNodes` van al prompt para contexto pero **NO** a mappings (diff reciente elimino linking). |
| **plan_content_mappings** | Solo nodos core (CONTENIDO/UNIDAD/BLOQUE sin patron de cita). | No se incluyen nodos bibliograficos. |
| **plan_lesson_content_links** | Core nodes linked por posicion round-robin. Lineas 960-986. | Bibliografia **removida** del linking (diff reciente, lineas 956-970 eliminadas). |
| **generate-materials** | `planMappedNodeIds` via plan_lesson_content_links → curriculum_nodes. | `bibliographyNodes` validados por protocolo, usados en prompt y tags `data-ref`. |
| **Lesson.tsx (frontend)** | Filtra nodos mapeados excluyendo los que `extractProtocolBibliographyNodes` identifica (diff reciente linea 214-218). | Se muestran por separado via `BibliographySelector`. |
| **lesson_briefs** | N/A | `bibliografia_confirmada: uuid[]` (nodos de bibliografia del diseno). |

---

## 4. Definicion "listo para generar"

Evidencia: `generate-materials/index.ts:843-933`

| # | Condicion | Linea | Error si falla |
|---|---|---|---|
| 1 | Curso status = `ACTIVE` | 843 | "curso no activo" |
| 2 | Plan status = `VALIDATED` | 855 | "plan debe estar VALIDATED" |
| 3 | Lesson no bloqueada (`status != LOCKED`) | 795 | "leccion bloqueada" |
| 4 | Lesson no generando (`is_generating = false`) | 775 | "ya esta generando" |
| 5 | Brief status = `READY_FOR_PRODUCTION` o `PRODUCED` | 919 | "brief no confirmado" |
| 6 | Al menos 1 fuente confirmada | 928 | "Debe confirmar al menos una fuente" |
| 7 | PlanLesson tiene `theme`, `justification`, `learning_outcome` | 873 | "campos obligatorios faltantes" |

---

## 5. Contrato canonico por tabla critica

### `courses`

```sql
-- Evidencia: SELECT column_name, is_nullable, column_default FROM information_schema.columns WHERE table_name='courses'
```

| Campo | Tipo | Obligatorio | Default | Nullable |
|---|---|---|---|---|
| id | uuid | PK | `gen_random_uuid()` | NO |
| user_id | uuid | SI | — | NO |
| school_id | uuid | SI (FK schools) | — | NO |
| subject | text | SI | — | NO |
| year_level | integer | SI | — | NO |
| academic_year | integer | SI | — | NO |
| status | course_status | SI | `'ACTIVE'` | NO |
| curriculum_document_id | uuid | NO | — | SI |
| orientation | text | NO | — | SI |
| speciality | text | NO | — | SI |
| created_at | timestamptz | SI | `now()` | NO |
| updated_at | timestamptz | SI | `now()` | NO |

### `lesson_briefs`

| Campo | Tipo | Obligatorio | Default | Nullable |
|---|---|---|---|---|
| id | uuid | PK | `gen_random_uuid()` | NO |
| lesson_id | uuid | SI (FK lessons, unique) | — | NO |
| status | brief_status | SI | `'IN_PROGRESS'` | NO |
| enfoque_deseado | text | SI | `''` | NO |
| tipo_dinamica_sugerida | text | SI | `''` | NO |
| nivel_profundidad | depth_level | SI | `'MEDIO'` | NO |
| observaciones_docente | text | SI | `''` | NO |
| bibliografia_confirmada | uuid[] | SI | `'{}'` | NO |
| created_at | timestamptz | SI | `now()` | NO |
| updated_at | timestamptz | SI | `now()` | NO |
| **authorized_source_ids** | **uuid[]** | **NO EXISTE EN CLOUD** | — | — |

### `subscriptions` (estado actual Cloud — 8 columnas)

| Campo | Tipo | Obligatorio | Default | Nullable |
|---|---|---|---|---|
| id | uuid | PK | `gen_random_uuid()` | NO |
| user_id | uuid | SI | — | NO |
| plan_type | plan_type | SI | `'FREE'` | NO |
| status | subscription_status | SI | `'ACTIVE'` | NO |
| start_date | timestamptz | SI | `now()` | NO |
| end_date | timestamptz | NO | — | SI |
| created_at | timestamptz | SI | `now()` | NO |
| updated_at | timestamptz | SI | `now()` | NO |

**12 columnas adicionales en migracion `20260307113000` (NO aplicada):** `provider`, `provider_customer_id`, `provider_subscription_id`, `provider_plan_id`, `billing_email`, `current_period_start`, `current_period_end`, `cancel_at_period_end`, `last_payment_status`, `last_payment_at`, `last_invoice_url`, `metadata`.

---

## 6. Decisiones abiertas (este documento)

| ID | Decision | Responsable | Deadline sugerido |
|---|---|---|---|
| D4 | Politica fallback cuando `authorized_source_ids` no existe en cloud: brief funciona solo con bib curricular, o se bloquea brief? | Owner producto | Post-aplicacion de migraciones |
