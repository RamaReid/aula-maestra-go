
# Política de Uso Racional — Fase 1 completada

## Implementado

1. **Tabla `ai_usage_logs`** — persiste user_id, course_id, lesson_id, model, tokens, cost_usd, duration_ms por cada llamada IA.
2. **Budget hard-stop** — `checkDailyBudget()` consulta gasto diario antes de cada llamada; si supera `AI_DAILY_BUDGET_USD` (env var, default $2.0), bloquea con error claro. Warning al 70%.
3. **Tracking integrado en `generate-materials`** — ambas llamadas (teaching + reading) registran uso en `ai_usage_logs` con costo calculado por modelo.
4. **Console.log temporal removido** — reemplazado por `AI_TRACKED` log estructurado.
5. **Build errors corregidos** — todos los `never` type errors en billingCommon, curriculumImport, bootstrap, webhook, cancel-subscription.

## Deploy status

- `generate-materials`: deployed ✅
- `bootstrap-course-plan`: deployed ✅
- `billing-webhook`: deployed ✅
- `cancel-subscription`: deployed ✅

## Pendiente (no aprobado en esta fase)

- Dedupe por hash
- Integración tracking en bootstrap-course-plan
- Reglas de bloqueo por invalidation count
- Refactor adicional de tipos

## Verificación pendiente

- Correr generate-materials en una lección real y verificar registros en ai_usage_logs
- Probar hard-stop con AI_DAILY_BUDGET_USD=0.001
