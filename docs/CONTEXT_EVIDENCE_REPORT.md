# Reporte de Evidencia — Verificación Integral QA + Operación

| Campo | Valor |
|---|---|
| Fecha/hora | 2026-03-07T21:55:00Z |
| project_ref | `jsejuuyqjtevtoguljiv` |
| Entorno | Test (Lovable Cloud, single environment) |
| Responsable | Lovable AI |

---

## Resumen ejecutivo

Se ejecutaron exitosamente las 6 migraciones pendientes, se corrigieron los imports Deno (`npm:` → `esm.sh`), se desplegaron 3 edge functions afectadas, y se verificó el estado completo del schema Cloud.

### Resultados

| Paso | Estado | Evidencia |
|---|---|---|
| D1 — 6 migraciones | ✅ Aplicadas | [sql_outputs.txt](evidence/sql_outputs.txt) |
| D2 — Fix imports Deno | ✅ Corregidos | [functions_deploy_status.txt](evidence/functions_deploy_status.txt) |
| D3 — Deploy 3 functions | ✅ Exitoso | [functions_deploy_status.txt](evidence/functions_deploy_status.txt) |
| D4 — Upgrade QA PREMIUM | ✅ Aplicado | [e2e_run_ids.txt](evidence/e2e_run_ids.txt) |
| C1 — Schema verificado | ✅ 5 tablas + 12 cols + 3 RPCs + RLS + bucket | [sql_outputs.txt](evidence/sql_outputs.txt) |
| C2 — Functions respondiendo | ✅ 3/3 retornan 401 (no error de import) | [functions_deploy_status.txt](evidence/functions_deploy_status.txt) |
| C3 — Secrets | ⚠️ LOVABLE_API_KEY presente; 5 MP secrets faltantes | [secrets_names.txt](evidence/secrets_names.txt) |
| C4 — E2E precondiciones | ✅ Todas satisfechas | [e2e_run_ids.txt](evidence/e2e_run_ids.txt) |

---

## Migraciones aplicadas (D1)

| # | Versión | Contenido | Resultado |
|---|---|---|---|
| 1 | 20260302212000 | validate_plan con v_mapping_count | ✅ CREATE OR REPLACE exitoso |
| 2 | 20260306170000 | authorized_sources + targets + RLS | ✅ Tablas, indices, policies, trigger creados |
| 3 | 20260306171000 | lesson_briefs.authorized_source_ids | ✅ Columna agregada |
| 4 | 20260306172000 | Bucket authorized-sources + storage policies | ✅ Bucket y 4 policies creadas |
| 5 | 20260307010000 | premium_query_requests + RLS | ✅ Tabla, funcion, policies, trigger creados |
| 6 | 20260307113000 | Billing foundation completa | ✅ Tipos, columnas, tablas, funcion admin_upsert |

---

## Bloqueos

### Bloqueo técnico
- Secretos `MERCADO_PAGO_ACCESS_TOKEN`, `MERCADO_PAGO_WEBHOOK_SECRET`, `MERCADO_PAGO_BASICO_PRICE_ARS`, `MERCADO_PAGO_PREMIUM_PRICE_ARS`, `APP_BASE_URL` no configurados
- Functions billing no invocables funcionalmente

### Gap de producto
- Límites custom de costo IA para QA (max 1 curso, max 3 generate/día, expiración 7 días) no implementados en el sistema actual

---

## Archivos de evidencia

| Archivo | Contenido |
|---|---|
| [evidence/sql_outputs.txt](evidence/sql_outputs.txt) | Queries + resultados C1 (tablas, columnas, funciones, RLS, bucket) |
| [evidence/functions_deploy_status.txt](evidence/functions_deploy_status.txt) | Deploy + invocación prueba + diff D2 |
| [evidence/secrets_names.txt](evidence/secrets_names.txt) | Secretos presentes + faltantes |
| [evidence/e2e_run_ids.txt](evidence/e2e_run_ids.txt) | Precondiciones + ruta E2E + IDs disponibles |
| [evidence/logs_extract.txt](evidence/logs_extract.txt) | Logs edge functions post-deploy |

---

## Nota sobre seguridad

El linter reporta 1 warning pre-existente: "Leaked Password Protection Disabled". Esto no fue introducido por estas migraciones y requiere configuración en el panel de autenticación.

La tabla `billing_events` tiene RLS habilitado sin policies — es por diseño (acceso admin-only via service_role_key desde edge functions).
