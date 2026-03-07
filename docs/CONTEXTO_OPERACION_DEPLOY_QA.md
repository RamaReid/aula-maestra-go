# Contexto: Operacion, Deploy y QA

## Cabecera de evidencia

| Campo | Valor |
|---|---|
| Fecha/hora | 2026-03-07 |
| project_ref | `jsejuuyqjtevtoguljiv` |
| Branch | main |
| commit_sha | N/A |
| Autor | Lovable AI — fase de contexto |

---

## 1. Entorno

Un solo entorno: **Lovable Cloud** (proyecto `jsejuuyqjtevtoguljiv`). No hay staging ni produccion separados.

- **19 migraciones en repositorio** (directorio `supabase/migrations/`)
- **Ultimas 5 NO aplicadas** a Cloud:
  - `20260306170000_add_authorized_sources.sql`
  - `20260306171000_add_brief_authorized_source_ids.sql`
  - `20260306172000_add_authorized_sources_bucket.sql`
  - `20260307010000_add_premium_query_requests.sql`
  - `20260307113000_add_billing_foundation.sql`
- Edge functions se despliegan automaticamente al hacer push via Lovable.

---

## 2. Secretos

### Configurados

```
LOVABLE_API_KEY          — presente (verificado via fetch_secrets)
SUPABASE_URL             — auto-provisioned
SUPABASE_ANON_KEY        — auto-provisioned
SUPABASE_SERVICE_ROLE_KEY — auto-provisioned
SUPABASE_DB_URL          — auto-provisioned
SUPABASE_PUBLISHABLE_KEY — auto-provisioned
```

### Faltantes (requeridos para billing)

```
MERCADO_PAGO_ACCESS_TOKEN      — FALTA
MERCADO_PAGO_WEBHOOK_SECRET    — FALTA
MERCADO_PAGO_BASICO_PRICE_ARS  — FALTA
MERCADO_PAGO_PREMIUM_PRICE_ARS — FALTA
```

### Opcionales

```
APP_BASE_URL                   — no configurado (se deriva del request origin)
MERCADO_PAGO_CURRENCY_ID       — default "ARS" (billingCommon.ts:62)
MERCADO_PAGO_REASON_PREFIX     — default "DocencIA" (billingCommon.ts:71)
```

---

## 3. Datos actuales en Cloud

```sql
SELECT 'courses' as t, count(*) FROM courses
UNION ALL SELECT 'lessons', count(*) FROM lessons
UNION ALL SELECT 'plan_lessons', count(*) FROM plan_lessons
UNION ALL SELECT 'plans', count(*) FROM plans
UNION ALL SELECT 'profiles', count(*) FROM profiles
UNION ALL SELECT 'subscriptions', count(*) FROM subscriptions
UNION ALL SELECT 'curriculum_documents', count(*) FROM curriculum_documents
UNION ALL SELECT 'curriculum_nodes', count(*) FROM curriculum_nodes
UNION ALL SELECT 'reading_materials', count(*) FROM reading_materials
UNION ALL SELECT 'teaching_materials', count(*) FROM teaching_materials;
```

**Output:**

| Tabla | Count |
|---|---|
| courses | 0 |
| lessons | 0 |
| plan_lessons | 0 |
| plans | 0 |
| profiles | 2 |
| subscriptions | 2 |
| curriculum_documents | 6 |
| curriculum_nodes | 561 |
| reading_materials | 0 |
| teaching_materials | 0 |

**Usuarios:**
- `7382fc69...` — `rgarciareid@gmail.com` — BASICO/ACTIVE
- `f2869db2...` — `gdarquitecturaydiseno@gmail.com` — FREE/ACTIVE

---

## 4. Observabilidad

**Estado actual:** No hay logging estructurado. Los edge functions usan `console.error()` y `console.log()` sin:
- `request_id`
- `course_id` / `lesson_id`
- `function_name`
- `error_code`
- Timestamps estructurados

**Consecuencia:** Debugging en produccion requiere buscar texto libre en los logs de Cloud.

---

## 5. Rollback

No hay procedimiento de rollback documentado.
- Edge functions: se sobreescriben en cada push. No hay versionado.
- Migraciones DB: no tienen down-migration (`DROP` statements).
- Datos: no hay backup automatizado documentado.

---

## 6. Matriz UAT — Flujos E2E

| Flujo | Ejecutado | Evidencia |
|---|---|---|
| Registro + login | Si (2 usuarios existen) | `SELECT count(*) FROM profiles` = 2 |
| Crear curso | **No** | `SELECT count(*) FROM courses` = 0 |
| Bootstrap plan | **No** | `SELECT count(*) FROM plans` = 0 |
| Validar plan | **No** | Sin plans, sin validacion |
| Configurar brief | **No** | Sin lessons |
| Generar materiales | **No** | `SELECT count(*) FROM reading_materials` = 0 |
| Exportar PDF | **No** | Sin materiales |
| Billing checkout | **No** | Secretos faltantes |
| Billing webhook | **No** | Secretos + tablas faltantes |
| Import curriculum PDF | **No** | `npm:` import bloqueante |
| Upload fuente docente | **No** | Tabla + bucket faltantes |

---

## 7. Matriz de pruebas negativas

Casos que **DEBEN fallar** cuando el sistema este operativo:

| ID | Escenario | Resultado esperado | Evidencia (archivo:linea) |
|---|---|---|---|
| NEG-01 | FREE crea 2do curso | 403 — limite max_courses=1 | `check-course-limit/index.ts` + `recalculate_entitlements` |
| NEG-02 | FREE prepara exactamente 2 clases | 400 — "requiere exactamente 3" | `generate-materials/index.ts:668` |
| NEG-03 | FREE prepara 4 clases | 403 — max_classes_per_session=3 | `generate-materials/index.ts:661` |
| NEG-04 | BASICO selecciona secuencia no consecutiva (ej: clases 3,5,7) | 400 — "clases deben ser consecutivas" | `generate-materials/index.ts:727` |
| NEG-05 | Brief sin fuentes confirmadas intenta generar | 400 — "al menos una fuente" | `generate-materials/index.ts:928` |
| NEG-06 | Brief con status IN_PROGRESS intenta generar | 400 — "brief no confirmado" | `generate-materials/index.ts:919-924` |
| NEG-07 | Lesson con is_generating=true intenta generar otra vez | 409 — "ya esta generando" | `generate-materials/index.ts:775` |
| NEG-08 | Plan INCOMPLETE intenta generar materiales | 400 — "plan debe estar VALIDATED" | `generate-materials/index.ts:855` |
| NEG-09 | Curso ARCHIVED intenta generar | 400 — "curso no activo" | `generate-materials/index.ts:843` |
| NEG-10 | validate_plan con fundamentacion < 100 chars | Error en array de validacion | DB function `validate_plan` |
| NEG-11 | validate_plan con 0 plan_lessons | Error "al menos 1 clase" | DB function `validate_plan` |
| NEG-12 | FREE intenta usar fuente DOCENTE_ARCHIVO | Rechazado (false) | `generate-materials/index.ts:251-254` |
| NEG-13 | BASICO intenta usar fuente DOCENTE_URL | Rechazado (false, solo PREMIUM) | `generate-materials/index.ts:251-254` |
| NEG-14 | Webhook billing con firma HMAC invalida | 401 — "Firma invalida" | `billing-webhook/index.ts:42` |

---

## 8. Decisiones abiertas (este documento)

| ID | Decision | Responsable | Deadline sugerido |
|---|---|---|---|
| D5 | Se necesita un entorno de staging separado antes de UAT real? | Owner producto + DevOps | Antes de primer flujo E2E |
