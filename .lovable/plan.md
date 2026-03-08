

# Plan: ai_usage_logs + budget stop en generate-materials + fix build errors

## Alcance

Solo lo aprobado: tracking de uso IA en `generate-materials`, hard-stop por presupuesto diario, limpieza del console.log temporal. Además, fix de **todos** los build errors actuales (son prerequisito para deploy).

---

## Fase 1 — Fix build errors (todos los archivos)

Causa raíz: `createClient` sin tipo genérico produce `never` en operaciones de tabla. Solución documentada en memoria: usar `any` para `adminClient`.

| Archivo | Cambio |
|---|---|
| `_shared/billingCommon.ts` | Cambiar tipo `SupabaseClientLike` a `any` en param de `syncMercadoPagoSubscription` |
| `_shared/curriculumImport.ts` | Tipar `adminClient` como `any` en funciones que lo reciben |
| `bootstrap-course-plan/index.ts` | Cast `adminClient` a `any` donde se pasa a funciones; cast `course as unknown as CourseSummary` |
| `billing-webhook/index.ts` | Cast `adminClient as any` al llamar `syncMercadoPagoSubscription` |
| `cancel-subscription/index.ts` | Cast `adminClient as any` al llamar `syncMercadoPagoSubscription` |
| `generate-materials/index.ts` | Fix assignment `course = courseWithCurriculum as any` (línea 839) |

---

## Fase 2 — Tabla `ai_usage_logs`

Migración SQL:

```sql
CREATE TABLE public.ai_usage_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  course_id uuid,
  lesson_id uuid,
  request_id text,
  feature text NOT NULL,
  model text NOT NULL,
  prompt_tokens int DEFAULT 0,
  completion_tokens int DEFAULT 0,
  total_tokens int DEFAULT 0,
  estimated boolean DEFAULT false,
  duration_ms int,
  cost_usd numeric(10,6),
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.ai_usage_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own ai usage"
  ON public.ai_usage_logs FOR SELECT TO authenticated
  USING (user_id = auth.uid());
```

Sin INSERT policy (solo `adminClient`/service_role escribe).

---

## Fase 3 — Tracking + budget en `generate-materials`

Modificar `callAI` en `generate-materials/index.ts` para:

1. Aceptar parámetros adicionales: `adminClient`, `userId`, `courseId`, `lessonId`, `feature`.
2. **Pre-call budget check**: consultar `SELECT COALESCE(SUM(cost_usd),0) FROM ai_usage_logs WHERE user_id = $userId AND created_at >= current_date`. Si >= `AI_DAILY_BUDGET_USD` (env var, default 2.0), lanzar error `"Presupuesto diario de IA agotado"`.
3. Medir `Date.now()` antes/después.
4. Extraer `usage` de la respuesta (`prompt_tokens`, `completion_tokens`, `total_tokens`).
5. Calcular `cost_usd` con tabla de precios hardcodeada:
   - `gemini-2.5-flash`: $0.15/1M input + $0.60/1M output
   - `gemini-2.5-pro`: $1.25/1M input + $10/1M output
6. INSERT en `ai_usage_logs` via `adminClient`.
7. Remover `console.log("AI_USAGE_LOG", ...)` temporal.

---

## Fase 4 — Deploy + evidencia

1. Deploy `generate-materials` (+ las demás functions corregidas en Fase 1).
2. Ejecutar una corrida QA real (lesson 1 del curso existente o regenerar).
3. Verificar registros en `ai_usage_logs` via query.
4. Probar hard-stop: setear `AI_DAILY_BUDGET_USD=0.001` temporalmente y confirmar rechazo.
5. Entregar resumen: total_calls, total_tokens, costo_total, costo_por_feature.

---

## Archivos a modificar

| Archivo | Acción |
|---|---|
| Migración SQL | CREATE TABLE ai_usage_logs |
| `_shared/billingCommon.ts` | Fix tipo adminClient → any |
| `_shared/curriculumImport.ts` | Fix tipo adminClient → any |
| `bootstrap-course-plan/index.ts` | Fix casts |
| `billing-webhook/index.ts` | Fix cast |
| `cancel-subscription/index.ts` | Fix cast |
| `generate-materials/index.ts` | Fix cast + tracking + budget + remover log temporal |

