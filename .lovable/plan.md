

# Plan: D1 + D2 + D4 + D5 con ajustes obligatorios

## Paso 0 — Conciliacion de historial de migraciones

### Situacion
19 archivos de migracion en repo. 12 registrados en `schema_migrations`. **7 no registrados** (no 8).

### 3 migraciones con contenido ya en DB (evidencia verificada ahora)

| Version | Contenido | Evidencia Cloud |
|---|---|---|
| `20260302203000` | `courses.curriculum_document_id` + 7 cols en `curriculum_documents` | Query `information_schema.columns` confirma las 7 cols + FK `courses_curriculum_document_id_fkey` + indice `courses_curriculum_document_id_idx` |
| `20260302212000` | `validate_plan` con `v_mapping_count` check | `pg_proc.prosrc` muestra version **SIN** `v_mapping_count` — la funcion en Cloud es una version anterior. **Este contenido NO esta completamente reflejado.** |
| `20260305113000` | `ADD COLUMN IF NOT EXISTS curriculum_document_id` + FK idempotente | Columna e FK ya existen (confirmado). SQL es idempotente (`IF NOT EXISTS`). |

**Hallazgo critico**: La migracion `20260302212000` (validate_plan con check de `plan_content_mappings`) **NO esta aplicada** — la funcion en Cloud no tiene el bloque `v_mapping_count`. Esto significa que hay **6 migraciones a ejecutar**, no 5.

### 5 migraciones sin contenido en DB
- `20260306170000` — authorized_sources + authorized_source_targets
- `20260306171000` — lesson_briefs.authorized_source_ids
- `20260306172000` — authorized-sources bucket
- `20260307010000` — premium_query_requests
- `20260307113000` — billing foundation

### Resumen: 7 no registradas, 6 a ejecutar

| Version | Ejecutar SQL? | Razon |
|---|---|---|
| `20260302203000` | NO (idempotente pero ya aplicado) | Contenido presente. Solo registrar en schema_migrations. |
| `20260302212000` | **SI** | `validate_plan` en Cloud no tiene `v_mapping_count` check |
| `20260305113000` | NO (idempotente, safe to re-run) | Contenido presente. Solo registrar o re-ejecutar safe. |
| `20260306170000` | **SI** | Tabla no existe |
| `20260306171000` | **SI** | Columna no existe |
| `20260306172000` | **SI** | Bucket no existe |
| `20260307010000` | **SI** | Tabla no existe |
| `20260307113000` | **SI** | Columnas/tablas no existen |

---

## Paso 1 — D1: Aplicar migraciones (6 SQL + 1 registro)

Ejecutar via herramienta de migracion en este orden:

1. **`20260302212000`** — `CREATE OR REPLACE FUNCTION validate_plan` (con `v_mapping_count`, validacion de `theme`, `justification`, `learning_outcome` por plan_lesson)
2. **`20260306170000`** — `authorized_sources` + `authorized_source_targets` + `is_authorized_source_owner` + RLS (4 policies en authorized_sources, 1 ALL policy en authorized_source_targets) + trigger updated_at
3. **`20260306171000`** — `ALTER TABLE lesson_briefs ADD COLUMN authorized_source_ids UUID[]`
4. **`20260306172000`** — bucket `authorized-sources` + 4 storage policies
5. **`20260307010000`** — `premium_query_requests` + `is_premium_query_owner` + RLS (4 policies) + trigger updated_at
6. **`20260307113000`** — billing types + 12 cols subscriptions + `billing_events` + `manual_payment_requests` + `admin_upsert_billing_subscription` + updated `handle_subscription_plan_change`

### Validacion post-migracion (incluye RLS)
- Query existencia de tablas: `authorized_sources`, `authorized_source_targets`, `premium_query_requests`, `billing_events`, `manual_payment_requests`
- Query columnas: `lesson_briefs.authorized_source_ids`, `subscriptions.provider` + 11 mas
- Query funciones: `is_authorized_source_owner`, `is_premium_query_owner`, `admin_upsert_billing_subscription`
- Query RLS policies: `SELECT tablename, policyname FROM pg_policies WHERE tablename IN ('authorized_sources','authorized_source_targets','premium_query_requests','billing_events','manual_payment_requests')`
- Query bucket: `SELECT id FROM storage.buckets WHERE id='authorized-sources'`
- Query validate_plan: confirmar presencia de `v_mapping_count` en `pg_proc.prosrc`

---

## Paso 2 — D2: Fix imports Deno

2 cambios de codigo:

1. `supabase/functions/_shared/curriculumImport.ts` linea 2:
   `npm:pdfjs-dist@4.10.38/legacy/build/pdf.mjs` → `https://esm.sh/pdfjs-dist@4.10.38/legacy/build/pdf.mjs`

2. `supabase/functions/process-authorized-source/index.ts` linea 3:
   mismo cambio

### Prueba de invocacion real post-deploy
Invocar via `curl_edge_functions` cada una de estas 3 functions con body minimo (esperando error de validacion, NO error de import):

- `import-curriculum-pdf` — POST `{}` → esperar 401 o 400, NO error de modulo
- `process-authorized-source` — POST `{}` → esperar 401 o 400
- `repair-curriculum-bibliography` — POST `{}` → esperar 401 o 400

---

## Paso 3 — D3: Deploy edge functions

Desplegar las 3 functions afectadas por D2: `import-curriculum-pdf`, `process-authorized-source`, `repair-curriculum-bibliography`.

Evidencia por funcion: nombre + resultado deploy (exito/error).

---

## Paso 4 — D4: Upgrade usuario QA a PREMIUM

Invocar `set-test-plan` con `plan_type: "PREMIUM"` para usuario `rgarciareid@gmail.com` via `curl_edge_functions`.

Evidencia:
- Query `SELECT plan_type, status FROM subscriptions WHERE user_id='7382fc69-6356-46c7-b956-13936853839c'`
- Query `SELECT copiloto_mode, max_courses, max_weekly_sessions FROM user_entitlements WHERE user_id='7382fc69-6356-46c7-b956-13936853839c'`

---

## Paso 5 — D5: Verificacion C1-C4

### C1 — Schema: queries SQL ya descritas en Paso 1 validacion
### C2 — Edge Functions: deploy + invocacion de prueba (Paso 2-3)
### C3 — Secrets: `fetch_secrets` → reportar nombres presentes/faltantes
### C4 — E2E precondiciones:
- Confirmar tablas operativas (courses, plans, plan_lessons, lessons, lesson_briefs, teaching/reading_materials)
- Confirmar curriculum_documents disponibles (6 docs, 561 nodes)
- Confirmar usuario QA con PREMIUM activo
- Documentar ruta paso a paso con IDs disponibles:
  1. Crear curso → course_id
  2. bootstrap-course-plan → plan_id
  3. validate_plan(plan_id) → lessons creadas
  4. Crear brief → brief_id
  5. Confirmar brief → status CONFIRMED
  6. generate-materials → teaching_material_id + reading_material_id

---

## Bloqueos (separados)

### Bloqueo tecnico
- Secretos `MERCADO_PAGO_ACCESS_TOKEN`, `MERCADO_PAGO_WEBHOOK_SECRET`, `MERCADO_PAGO_BASICO_PRICE_ARS`, `MERCADO_PAGO_PREMIUM_PRICE_ARS`, `APP_BASE_URL` no configurados
- Functions billing (`create-checkout`, `billing-webhook`, `cancel-subscription`, `reconcile-billing`) no invocables funcionalmente

### Gap de producto
- Limites custom de costo IA para QA (max 1 curso, max 3 generate/dia, expiracion 7 dias, tag `source=qa-bigschool`) no implementados en el sistema actual — requiere diseño y desarrollo

---

## Entregables de salida (6 archivos)

| Archivo | Contenido |
|---|---|
| `docs/CONTEXT_EVIDENCE_REPORT.md` | Resumen ejecutivo con links a evidencia, fecha, project_ref, responsable |
| `docs/evidence/sql_outputs.txt` | Queries + resultados literales de C1 (tablas, columnas, funciones, RLS, bucket) |
| `docs/evidence/functions_deploy_status.txt` | Nombre funcion + fecha/hora + resultado deploy + resultado invocacion prueba |
| `docs/evidence/secrets_names.txt` | Lista de secretos presentes + faltantes |
| `docs/evidence/e2e_run_ids.txt` | Precondiciones verificadas + ruta paso a paso + IDs disponibles (curriculum_document_ids) |
| `docs/evidence/logs_extract.txt` | Extracto de logs de edge functions post-deploy (o "sin logs" si vacio) |

Formato minimo en cada archivo:
```
fecha/hora: 2026-03-07T...
project_ref: jsejuuyqjtevtoguljiv
comando/query: ...
resultado: ...
responsable: Lovable AI
```

---

## Resumen de cambios

| Tipo | Recurso | Cambio |
|---|---|---|
| DB Migration | 6 SQLs | Aplicar via herramienta |
| Code edit | `curriculumImport.ts:2` | `npm:` → `https://esm.sh/` |
| Code edit | `process-authorized-source/index.ts:3` | `npm:` → `https://esm.sh/` |
| Deploy | 3 edge functions | Re-deploy |
| Invocacion | `set-test-plan` | Upgrade QA a PREMIUM |
| Docs | 6 archivos nuevos en `docs/` y `docs/evidence/` | Evidencia verificable |

