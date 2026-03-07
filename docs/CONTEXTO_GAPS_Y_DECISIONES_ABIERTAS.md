# Contexto: Gaps y Decisiones Abiertas

## Cabecera de evidencia

| Campo | Valor |
|---|---|
| Fecha/hora | 2026-03-07 |
| project_ref | `jsejuuyqjtevtoguljiv` |
| Branch | main |
| commit_sha | N/A |
| Autor | Lovable AI — fase de contexto |

---

## 1. Gaps criticos con evidencia verificable

| # | Gap | Evidencia | Impacto |
|---|---|---|---|
| G1 | 5 migraciones no aplicadas en Cloud | `SELECT table_name FROM information_schema.tables WHERE table_schema='public'` retorna 19 tablas; faltan `billing_events`, `manual_payment_requests`, `authorized_sources`, `authorized_source_targets`, `premium_query_requests`. `SELECT column_name FROM information_schema.columns WHERE table_name='subscriptions'` retorna 8 columnas; faltan 12. | **CRITICO** — billing, authorized_sources y premium_query no funcionan. 20+ errores de build en edge functions. |
| G2 | `npm:pdfjs-dist` en imports Deno | `supabase/functions/_shared/curriculumImport.ts:2` usa `import ... from "npm:pdfjs-dist"`. `supabase/functions/process-authorized-source/index.ts:3` idem. Deno en Supabase Edge no soporta `npm:` specifiers sin configuracion adicional. | **CRITICO** — `import-curriculum-pdf` y `process-authorized-source` fallan en deploy. |
| G3 | types.ts desincronizado con codigo (no con DB) | `src/integrations/supabase/types.ts` refleja correctamente las 19 tablas reales de Cloud (8 cols en subscriptions). Los errores de build ocurren porque el **codigo** (edge functions + frontend) referencia columnas/tablas que no existen en la base. | **ALTO** — resolver G1 regenera types.ts y elimina la mayoria de errores. |
| G4 | Secretos Mercado Pago no configurados | `fetch_secrets` retorna 6 secretos; faltan `MERCADO_PAGO_ACCESS_TOKEN`, `MERCADO_PAGO_WEBHOOK_SECRET`, `MERCADO_PAGO_BASICO_PRICE_ARS`, `MERCADO_PAGO_PREMIUM_PRICE_ARS`. | **ALTO** — billing completamente inoperativo. |
| G5 | 0 flujos E2E ejecutados | `SELECT count(*) FROM courses` = 0. `SELECT count(*) FROM reading_materials` = 0. No hay evidencia de que el flujo principal (crear curso → bootstrap → brief → generar) funcione end-to-end. | **ALTO** — riesgo de bugs no detectados en integracion. |
| G6 | `schools` join retorna array en lugar de objeto | `generate-materials/index.ts:821`: `courses.select("..., schools(school_type)")` retorna `schools` como `{school_type}[]` pero el tipo `CourseSummary` espera `{school_type} | null`. Mismo patron en `bootstrap-course-plan/index.ts:752`. | **MEDIO** — error de tipos, puede causar runtime failure en `.schools.school_type`. |
| G7 | Datos legacy contaminados | Con 0 cursos y 0 plan_lessons en Cloud, no hay mappings legacy contaminados con nodos bibliograficos. El diff reciente ya corrigio `bootstrap-course-plan` para no incluir bibliografia en `nodesForMappings`. | **RESUELTO** — no hay datos legacy que remediar. |

---

## 2. Supuestos eliminados (con evidencia)

| # | Supuesto previo | Realidad verificada | Evidencia |
|---|---|---|---|
| 1 | "Los tipos estan desincronizados con la base" | FALSO — los tipos reflejan correctamente la base real. El problema es que el codigo asume migraciones que no se aplicaron. | `types.ts` tiene 8 cols en subscriptions; Cloud tiene 8 cols. |
| 2 | "Hay cursos legacy contaminados con bibliografia en mappings" | FALSO — 0 cursos en la base. | `SELECT count(*) FROM courses` = 0. |
| 3 | "La trazabilidad mezcla bibliografia y contenidos" | CORREGIDO — diff reciente elimino bibliografia de `nodesForMappings` y `plan_lesson_content_links`. | `bootstrap-course-plan/index.ts:212` ahora usa `uniqueNodes(safeCoreNodes)`. |
| 4 | "Las migraciones de billing estan aplicadas" | FALSO — 5 migraciones pendientes verificadas por query directa. | `SELECT table_name...` no incluye `billing_events`. |

---

## 3. Supuestos abiertos — Log de decisiones

| ID | Decision | Opciones | Responsable | Deadline sugerido | Estado |
|---|---|---|---|---|---|
| D1 | Aplicar 5 migraciones pendientes a Cloud | (a) Aplicar todas en orden (b) Aplicar solo authorized_sources (c) No aplicar | Owner producto | **Inmediato** — bloqueante para billing y authorized_sources | PENDIENTE |
| D2 | Resolver `npm:` imports en Deno | (a) Cambiar a `https://esm.sh/pdfjs-dist` (b) Agregar `deno.json` con npm config (c) Ambos | Dev | **Pre-deploy** de import-curriculum-pdf | PENDIENTE |
| D3 | Configurar secretos Mercado Pago en Cloud | (a) Configurar ahora con credenciales de test (b) Postergar billing al roadmap (c) Usar mock local | Owner producto | Segun roadmap billing | PENDIENTE |
| D4 | Politica fallback `authorized_source_ids` faltante | (a) Aceptar que brief funciona solo con bib curricular (b) Bloquear brief sin la columna (c) No aplica post-D1 | Owner producto | Post-D1 | PENDIENTE |
| D5 | Entorno staging separado | (a) Crear staging en Supabase (b) Seguir con entorno unico (c) Feature flags | Owner producto + DevOps | Antes de UAT real | PENDIENTE |
| D6 | Errores de tipos en Billing.tsx y edge functions | (a) Cast con `as any` como workaround (b) Esperar a que migraciones se apliquen y tipos se regeneren (c) Ambos | Dev | Post-D1 | PENDIENTE |

---

## 4. Orden de dependencias

```
D1: Aplicar migraciones ──┬──> types.ts se regenera automaticamente (G3 resuelto)
                          ├──> billing_events + subscriptions cols existen (G1 parcial)
                          ├──> authorized_sources + targets existen (G1 parcial)
                          └──> premium_query_requests existe (G1 completo)
                               │
D2: Fix npm: imports ─────────> import-curriculum-pdf operativo (G2 resuelto)
                               > process-authorized-source operativo (G2 resuelto)
                               │
D3: Secretos MP ──────────────> create-checkout responde con init_point (G4 resuelto)
                               > billing-webhook procesa notificaciones
                               > cancel-subscription + reconcile-billing operativos
                               │
D1 + D2 + D3 ────────────────> UAT E2E posible (G5 resuelto)
```

---

## 5. Opciones posteriores (no ejecutadas en esta fase)

| Prioridad | Paso | Precondicion | DoD verificable |
|---|---|---|---|
| P0 | Aplicar migraciones `20260306170000` a `20260307113000` | Aprobacion D1 | `SELECT count(*) FROM authorized_sources` no falla; `types.ts` regenerado con 20 cols en subscriptions |
| P1 | Fix `npm:pdfjs-dist` → `https://esm.sh/pdfjs-dist` en `curriculumImport.ts:2` y `process-authorized-source/index.ts:3` | Ninguna | `import-curriculum-pdf` responde 200 con PDF de prueba |
| P2 | Fix errores de tipos en edge functions (casts o refactor post-types) | P0 completado | Build sin errores de tipo en `supabase/functions/` |
| P3 | Fix `Billing.tsx` errores de tipos | P0 completado | `npm run build` sin errores |
| P4 | Configurar secretos Mercado Pago | Aprobacion D3 | `create-checkout` responde con `init_point` de MP |
| P5 | Ejecutar UAT minimo: crear curso → bootstrap → validar → brief → generar | P0 + P1 + P2 + P3 | Curso con materiales VALIDATED en DB |

---

## 6. Criterio de salida de la fase contexto

| Criterio | Estado |
|---|---|
| 0 fixes ejecutados | **CUMPLIDO** |
| 0 propuestas de implementacion | **CUMPLIDO** — solo "opciones posteriores" listadas |
| 0 contradicciones entre documentos | **CUMPLIDO** |
| 100% de gaps con evidencia verificable | **CUMPLIDO** |
| Inventario unico: 13 edge functions | **CUMPLIDO** |
