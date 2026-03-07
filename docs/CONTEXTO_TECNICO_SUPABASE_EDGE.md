# Contexto: Tecnico — Supabase & Edge Functions

## Cabecera de evidencia

| Campo | Valor |
|---|---|
| Fecha/hora | 2026-03-07 |
| project_ref | `jsejuuyqjtevtoguljiv` |
| Branch | main |
| commit_sha | N/A |
| Autor | Lovable AI — fase de contexto |

---

## 1. Evidencia — Queries SQL ejecutadas contra Cloud

### 1.1 Tablas en schema public

```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' ORDER BY table_name;
```

**Output (19 filas):**
```
courses
curriculum_documents
curriculum_nodes
lesson_briefs
lesson_shift_events
lessons
plan_content_mappings
plan_lesson_content_links
plan_lessons
plan_objectives
plans
profiles
reading_materials
schools
subscriptions
teaching_materials
usage_counters
user_entitlements
user_roles
```

**NO existen en Cloud:** `authorized_sources`, `authorized_source_targets`, `billing_events`, `manual_payment_requests`, `premium_query_requests`.

### 1.2 Columnas de `subscriptions`

```sql
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'subscriptions' ORDER BY ordinal_position;
```

**Output (8 columnas):**
```
id          | uuid                     | NO  | gen_random_uuid()
user_id     | uuid                     | NO  | (none)
plan_type   | USER-DEFINED             | NO  | 'FREE'::plan_type
status      | USER-DEFINED             | NO  | 'ACTIVE'::subscription_status
start_date  | timestamp with time zone | NO  | now()
end_date    | timestamp with time zone | YES | (none)
created_at  | timestamp with time zone | NO  | now()
updated_at  | timestamp with time zone | NO  | now()
```

### 1.3 Columnas de `lesson_briefs`

```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'lesson_briefs' ORDER BY ordinal_position;
```

**Output (10 columnas):**
```
id, lesson_id, status, enfoque_deseado, tipo_dinamica_sugerida,
nivel_profundidad, observaciones_docente, bibliografia_confirmada,
created_at, updated_at
```

**NO existe:** `authorized_source_ids`.

### 1.4 DB Functions

```sql
SELECT routine_name FROM information_schema.routines
WHERE routine_schema = 'public' ORDER BY routine_name;
```

**Output (17 funciones):**
```
demo_contract_check, has_role, is_course_not_archived_for_lesson,
is_course_not_archived_for_plan, is_course_owner, is_lesson_brief_owner,
is_lesson_owner, is_plan_lesson_owner, is_plan_owner,
recalculate_entitlements, reset_weekly_counters, upgrade_user_plan,
validate_plan, handle_new_user, handle_updated_at, set_first_subscription,
check_brief_before_produce
```

**NO existen:** `admin_upsert_billing_subscription`, `is_authorized_source_owner`.

### 1.5 Datos actuales

```sql
SELECT count(*) FROM courses;          -- 0
SELECT count(*) FROM lessons;          -- 0
SELECT count(*) FROM plan_lessons;     -- 0
SELECT count(*) FROM plans;            -- 0
SELECT count(*) FROM profiles;         -- 2
SELECT count(*) FROM subscriptions;    -- 2
SELECT count(*) FROM curriculum_documents;  -- 6
SELECT count(*) FROM curriculum_nodes;      -- 561

SELECT count(*), node_type FROM curriculum_nodes GROUP BY node_type;
-- 434 EJE, 42 UNIDAD, 9 BLOQUE, 76 CONTENIDO
```

### 1.6 Secretos configurados

Via `fetch_secrets`:
- `LOVABLE_API_KEY` — presente
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_URL`, `SUPABASE_PUBLISHABLE_KEY` — auto-provisioned

**Faltantes:** `MERCADO_PAGO_ACCESS_TOKEN`, `MERCADO_PAGO_WEBHOOK_SECRET`, `MERCADO_PAGO_BASICO_PRICE_ARS`, `MERCADO_PAGO_PREMIUM_PRICE_ARS`. Opcionales: `APP_BASE_URL`, `MERCADO_PAGO_CURRENCY_ID`, `MERCADO_PAGO_REASON_PREFIX`.

---

## 2. Drift Matrix — Cloud vs Repo vs Codigo

| Entidad | Migracion | Cloud DB | types.ts | Codigo lo usa | Estado |
|---|---|---|---|---|---|
| `subscriptions.provider` (+ 11 cols) | `20260307113000` | FALTA | FALTA | `billingCommon.ts:318` | **DRIFT CRITICO** |
| `billing_events` (tabla) | `20260307113000` | FALTA | FALTA | `billing-webhook/index.ts:49` | **DRIFT CRITICO** |
| `manual_payment_requests` (tabla) | `20260307113000` | FALTA | FALTA | `Billing.tsx` | **DRIFT CRITICO** |
| `admin_upsert_billing_subscription` (rpc) | `20260307113000` | FALTA | FALTA | `billingCommon.ts:318` | **DRIFT CRITICO** |
| `authorized_sources` (tabla) | `20260306170000` | FALTA | FALTA | `process-authorized-source` | **DRIFT CRITICO** |
| `authorized_source_targets` (tabla) | `20260306170000` | FALTA | FALTA | `process-authorized-source` | **DRIFT CRITICO** |
| `is_authorized_source_owner` (func) | `20260306170000` | FALTA | FALTA | RLS policies | **DRIFT CRITICO** |
| `lesson_briefs.authorized_source_ids` | `20260306171000` | FALTA | FALTA | `generate-materials:926` | **DRIFT** |
| `authorized-sources` (storage bucket) | `20260306172000` | FALTA | N/A | `process-authorized-source` | **DRIFT** |
| `premium_query_requests` (tabla) | `20260307010000` | FALTA | FALTA | `resolve-premium-query` | **DRIFT** |

---

## 3. Inventario: 13 Edge Functions

| # | Funcion | Lineas | Modelo IA | Secretos extra | Estado |
|---|---|---|---|---|---|
| 1 | `bootstrap-course-plan` | 1008 | gemini-2.5-pro | LOVABLE_API_KEY | **Operativa** |
| 2 | `generate-materials` | 1665 | gemini-2.5-flash + pro | LOVABLE_API_KEY | **Operativa parcial** (authorized_sources falta) |
| 3 | `resolve-curriculum-document` | 413 | — | — | **Operativa** |
| 4 | `import-curriculum-pdf` | 121 | — | — | **BLOQUEADA** (`npm:pdfjs-dist`) |
| 5 | `process-authorized-source` | 372 | — | LOVABLE_API_KEY | **BLOQUEADA** (`npm:` + tabla falta) |
| 6 | `repair-curriculum-bibliography` | ~50 | — | — | **Parcial** (depende curriculumImport.ts) |
| 7 | `check-course-limit` | 61 | — | — | **Operativa** |
| 8 | `create-checkout` | 147 | — | MP_ACCESS_TOKEN, MP_WEBHOOK_SECRET, MP_PRICES | **BLOQUEADA** (secretos) |
| 9 | `billing-webhook` | 120 | — | MP_ACCESS_TOKEN, MP_WEBHOOK_SECRET | **BLOQUEADA** (secretos + tablas) |
| 10 | `cancel-subscription` | 91 | — | MP_ACCESS_TOKEN | **BLOQUEADA** (secretos + cols) |
| 11 | `reconcile-billing` | 90 | — | MP_ACCESS_TOKEN | **BLOQUEADA** (secretos + cols) |
| 12 | `set-test-plan` | 121 | — | — | **Operativa** (whitelist: `rgarciareid@gmail.com`) |
| 13 | `resolve-premium-query` | 498 | — | — | **BLOQUEADA** (tabla falta) |

**Confirmacion:** No existe `seed-demo-course` como edge function. La referencia es a `src/pages/Demo.tsx` (componente frontend).

---

## 4. Contratos entrada/salida — Funciones criticas

### `bootstrap-course-plan`

**Entrada (POST, autenticado):**
```json
{
  "course_id": "uuid (obligatorio)"
}
```

**Salida exito (200):**
```json
{
  "success": true,
  "plan_id": "uuid",
  "lessons_count": 28,
  "objectives_count": 5,
  "content_mappings_count": 120,
  "source": "ai" | "fallback"
}
```

**Errores:** 401 (no autenticado), 400 (curso no encontrado, plan ya existe), 500 (error IA + fallback fallo).

### `generate-materials`

**Entrada (POST, autenticado):**
```json
{
  "lesson_ids": ["uuid", "uuid", "uuid"],
  "generate_reading": true,
  "generate_teaching": true
}
```

**Salida exito (200):**
```json
{
  "success": true,
  "results": [
    {
      "lesson_id": "uuid",
      "reading": { "status": "VALIDATED" | "INVALIDATED", "word_count": 1150 },
      "teaching": { "status": "VALIDATED" | "INVALIDATED" }
    }
  ]
}
```

**Errores:** 401, 400 (brief no confirmado, sin fuentes, plan no validado), 409 (ya generando), 403 (limite plan).

### `resolve-curriculum-document`

**Entrada (POST, autenticado):**
```json
{
  "province": "PBA",
  "subject": "Filosofía",
  "cycle": "UPPER",
  "year_level": 6,
  "school_type": "COMUN",
  "orientation": "Ciencias Sociales"
}
```

**Salida exito (200):**
```json
{
  "document_id": "uuid",
  "status": "VERIFIED",
  "nodes_count": 225
}
```

---

## 5. RLS por tabla

```sql
SELECT tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename, policyname;
```

**Output resumido (tablas criticas):**

| Tabla | Policy | Comando | Condicion |
|---|---|---|---|
| courses | owner_crud | ALL | `user_id = auth.uid()` |
| lessons | owner_crud | ALL | `is_lesson_owner(id, auth.uid())` |
| lesson_briefs | owner_crud | ALL | `is_lesson_brief_owner(id, auth.uid())` |
| plans | owner_crud | ALL | `is_plan_owner(id, auth.uid())` |
| plan_lessons | owner_crud | ALL | `is_plan_lesson_owner(id, auth.uid())` |
| plan_content_mappings | owner_select | SELECT | `is_plan_owner(plan_id, auth.uid())` |
| plan_lesson_content_links | owner_select | SELECT | via plan_lesson_id ownership chain |
| subscriptions | user_select_own | SELECT | `user_id = auth.uid()` |
| user_entitlements | user_select_own | SELECT | `user_id = auth.uid()` |
| curriculum_documents | public_read | SELECT | `true` (datos publicos) |
| curriculum_nodes | public_read | SELECT | `true` (datos publicos) |
| schools | public_read_user_create | SELECT/INSERT | `true` / `created_by = auth.uid()` |
| profiles | owner_crud | ALL | `id = auth.uid()` |

---

## 6. Seguridad — Funciones que usan service_role

| Funcion | Uso de adminClient | Justificacion |
|---|---|---|
| `bootstrap-course-plan` | Insert curriculum_nodes sinteticos, upsert plans/plan_lessons/plan_objectives, insert plan_content_mappings/links | Opera a nombre del sistema tras validar ownership via userClient |
| `generate-materials` | Lock/unlock `is_generating`, upsert teaching/reading materials, update briefs, increment usage | Atomic lock pattern + operaciones post-generacion |
| `billing-webhook` | Insert/update billing_events, sync subscriptions | Webhook externo sin authHeader, validado por firma HMAC |
| `cancel-subscription` | Update subscriptions via sync | Requiere escribir subscriptions que el user solo puede leer |
| `reconcile-billing` | Update subscriptions via sync | Idem |
| `set-test-plan` | Upgrade plan, recalculate entitlements | Whitelist QA — solo emails autorizados |
| `import-curriculum-pdf` | Insert curriculum_documents/nodes | Datos compartidos publicamente, no por usuario |

---

## 7. Decisiones abiertas (este documento)

| ID | Decision | Responsable | Deadline sugerido |
|---|---|---|---|
| D1 | Aplicar las 5 migraciones pendientes (`20260306170000` a `20260307113000`) a Cloud | Owner producto | Inmediato |
| D2 | Resolver `npm:pdfjs-dist` imports en Deno (`esm.sh` vs `deno.json`) | Dev | Pre-deploy import/process |
| D3 | Configurar secretos Mercado Pago en Cloud | Owner producto | Segun roadmap billing |
