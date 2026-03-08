# Plan: Validación Hard-Stop + Cierre de Evidencia

## Estado actual (verificado ahora)

**Tracking E2E: FUNCIONAL** — 4 filas en `ai_usage_logs`:


| #   | Feature  | Model            | Tokens | Cost USD  | Duration |
| --- | -------- | ---------------- | ------ | --------- | -------- |
| 1   | teaching | gemini-2.5-flash | 1,871  | $0.000666 | 6,223ms  |
| 2   | reading  | gemini-2.5-pro   | 5,977  | $0.050311 | 43,795ms |
| 3   | reading  | gemini-2.5-pro   | 5,004  | $0.040153 | 37,020ms |
| 4   | reading  | gemini-2.5-pro   | 7,018  | $0.060161 | 53,109ms |


**Total: 19,870 tokens / $0.151291 / 4 llamadas**

Lesson `b1b122c0` estado: `PLANNED`, `is_generating=false`.
Teaching: `INVALIDATED`. Reading: `INVALIDATED` (1449 palabras, fuera de rango 1000-1300).

**Baseline para hard-stop:** count=4, max(created_at)=`2026-03-08 01:26:20.466031+00`

---

## Pasos a ejecutar

### Paso 1 — Configurar presupuesto bloqueante

Usar `add_secret` para crear `AI_DAILY_BUDGET_USD = 0.0001`.
El gasto actual del día ($0.151291) ya supera este límite, por lo que el hard-stop debe activarse.

### Paso 2 — Invocar generate-materials

Llamar vía `curl_edge_functions` a `/generate-materials` con `lesson_id=b1b122c0-4161-414c-9e5a-3ffd97913ea8`.
Resultado esperado: error `"Presupuesto diario de IA agotado"`.

### Paso 3 — Verificar no inserción

Ejecutar dos queries:

- `SELECT count(*) FROM ai_usage_logs WHERE lesson_id = '<ID>'` — debe seguir en 4
- `SELECT max(created_at) FROM ai_usage_logs WHERE lesson_id = '<ID>'` — debe ser idéntico al baseline

### Paso 4 — Restaurar presupuesto

Usar `add_secret` para setear `AI_DAILY_BUDGET_USD = 2.0`.

### Paso 5 — Actualizar 4 archivos de evidencia

`**docs/evidence/sql_outputs.txt**` — Agregar queries 1-5 con resultados reales:

- Query 1: ai_usage_logs (4 filas con datos completos)
- Query 2: lessons status/is_generating
- Query 3: teaching_materials status
- Query 4: reading_materials status + validation_reasons
- Query 5: count/max antes y después del bloqueo

`**docs/evidence/logs_extract.txt**` — Agregar logs de generate-materials:

- 4 líneas AI_TRACKED (1 teaching + 3 reading)
- Mensaje de bloqueo por presupuesto agotado

`**docs/evidence/e2e_run_ids.txt**` — Agregar sección de validación tracking:

- user_id, course_id, lesson_id
- Resumen de resultados (4 calls, $0.151291)
- Hard-stop verificado

`**docs/CONTEXT_EVIDENCE_REPORT.md**` — Agregar 2 secciones:

- "Tracking IA validado" con tabla de costos
- "Budget hard-stop validado" con evidencia de bloqueo y no-inserción

---

## Archivos a modificar


| Archivo                           | Acción                                |
| --------------------------------- | ------------------------------------- |
| `docs/evidence/sql_outputs.txt`   | Agregar queries 1-5 + resultados      |
| `docs/evidence/logs_extract.txt`  | Agregar logs tracking + hard-stop     |
| `docs/evidence/e2e_run_ids.txt`   | Agregar IDs + resumen validación      |
| `docs/CONTEXT_EVIDENCE_REPORT.md` | Secciones tracking + budget validados |


No se modifican archivos de código. Solo evidencia y secreto temporal.

- confirmar explícitamente que AI_DAILY_BUDGET_USD quedó restaurado a 2.0 al terminar.