

# PRD 3 — Planes, Entitlements y Gating

Implementacion completa en 5 fases. No se modifican tablas de PRD 1.2 ni logica de validacion/PDF de PRD 2.3.

---

## Fase 1: Migracion SQL

Una sola migracion que crea:

**Enums:**
- `plan_type` (FREE, BASICO, PREMIUM)
- `subscription_status` (ACTIVE, CANCELED, EXPIRED)
- `copiloto_mode` (none, limited, full)

**Tablas:**
- `subscriptions` (id, user_id UNIQUE, plan_type default FREE, status default ACTIVE, start_date, end_date nullable, created_at, updated_at)
- `user_entitlements` (id, user_id UNIQUE, max_courses, max_students_per_course, max_weekly_sessions, max_classes_per_session, watermark_enabled, history_enabled, copiloto_mode, auto_complete_forms_enabled, persistent_storage_enabled, created_at, updated_at)
- `usage_counters` (id, user_id UNIQUE, week_start_date, sessions_used_this_week, created_at, updated_at)

**RLS:** Cada tabla con SELECT solo para owner (user_id = auth.uid()). Sin INSERT/UPDATE/DELETE desde cliente.

**Funciones:**
- `recalculate_entitlements(p_user_id uuid, p_plan plan_type)` — hardcodea valores segun plan
- `reset_weekly_counters()` — resetea counters cuyo week_start_date sea anterior al lunes actual

**Triggers:**
- Modificar `handle_new_user()` para insertar subscription FREE + entitlements FREE + usage_counter
- `on_subscription_plan_change` AFTER UPDATE en subscriptions: si plan_type cambio, llama recalculate_entitlements
- `updated_at` triggers en las 3 tablas nuevas

**Funcion admin:**
- `upgrade_user_plan(p_user_id uuid, p_new_plan plan_type)` — actualiza subscriptions.plan_type (el trigger recalcula)

**Backfill:** INSERT para usuarios existentes que no tengan subscription/entitlements/counter.

---

## Fase 2: Edge Function — Gating en generate-materials

Modificar `supabase/functions/generate-materials/index.ts`. Insertar despues de auth y antes de validaciones de leccion:

1. Fetch `user_entitlements` y `usage_counters` del usuario via adminClient
2. **Lazy reset semanal**: si `week_start_date < lunes_actual`, resetear counter inline
3. **Validar sesiones semanales**: si `sessions_used_this_week >= max_weekly_sessions` retornar 403
4. **Validar clases por sesion**: contar teaching_materials VALIDATED de esta semana para el curso; si >= `max_classes_per_session` retornar 403
5. **Watermark**: despues de generar PDF, si `watermark_enabled`, overlay diagonal "DEMO - Plan Gratuito" en cada pagina (pdf-lib, opacidad 0.08, rotado 45 grados, 3 repeticiones por pagina)
6. **Persistencia condicional**: si `persistent_storage_enabled === false`, NO subir PDF al bucket, NO setear pdf_url. Convertir pdfBytes a base64 y devolver como `reading_pdf_base64`
7. **Incrementar counter**: solo al finalizar con VALIDATED, incrementar `sessions_used_this_week`

Respuesta actualizada incluye `reading_pdf_base64` (null si no es FREE) y `watermark_applied`.

Agregar a `supabase/config.toml`:
```text
[functions.generate-materials]
verify_jwt = false
```

---

## Fase 3: Edge Function — check-course-limit

Nuevo archivo `supabase/functions/check-course-limit/index.ts`:
- Autenticar usuario
- Fetch `user_entitlements.max_courses`
- Contar cursos ACTIVE del usuario
- Retornar `{ can_create, current, max }`

Agregar a config.toml:
```text
[functions.check-course-limit]
verify_jwt = false
```

---

## Fase 4: Frontend

### 4.1 Hook useEntitlements
Nuevo `src/hooks/useEntitlements.ts`:
- Fetch `subscriptions` (plan_type, status) y `user_entitlements` del usuario logueado
- Expone: `planType`, `entitlements`, `loading`, `refetch`
- Polling cada 30s para detectar upgrades

### 4.2 Dashboard (src/pages/Dashboard.tsx)
- Badge con plan actual (FREE/BASICO/PREMIUM) al lado del nombre
- Boton "Nuevo curso": ya no `disabled` fijo. Al click, llama `check-course-limit`. Si `can_create === false`, toast de limite. Si puede, proceder (la creacion de curso en si queda pendiente, el boton hoy esta deshabilitado)

### 4.3 CopilotPanel (src/components/lesson/CopilotPanel.tsx)
- Recibe nueva prop `copilotoMode: "none" | "limited" | "full"`
- Si `none`: deshabilitar controles de regeneracion y profundidad, mostrar mensaje "Actualiza tu plan para usar el Copiloto"
- Si `limited`: permitir regeneracion, no auto-complete (auto-complete no esta implementado aun, solo se prepara el gating)

### 4.4 Lesson.tsx (src/pages/Lesson.tsx)
- Usar `useEntitlements` para obtener `copilotoMode`
- Pasar `copilotoMode` a CopilotPanel

### 4.5 ReadingMaterialView (src/components/lesson/ReadingMaterialView.tsx)
- Recibe nueva prop opcional `pdfBase64?: string | null`
- Si `pdf_url` es null pero `pdfBase64` existe: mostrar boton "Ver PDF (temporal)" que crea blob URL y abre en nueva pestana
- Mostrar aviso amarillo: "Este PDF no se guarda. Actualiza tu plan para almacenamiento permanente."

---

## Fase 5: Upgrade en caliente

- Funcion SQL `upgrade_user_plan()` ya creada en Fase 1
- El trigger recalcula entitlements automaticamente
- `useEntitlements` con polling 30s detecta cambios sin logout
- No hay pasarela de pago en este PRD

---

## Archivos a crear/modificar

| Archivo | Accion |
|---------|--------|
| Migracion SQL | Crear enums, tablas, funciones, triggers, backfill |
| `supabase/functions/generate-materials/index.ts` | Gating, watermark, persistencia condicional |
| `supabase/functions/check-course-limit/index.ts` | Nuevo |
| `src/hooks/useEntitlements.ts` | Nuevo |
| `src/pages/Dashboard.tsx` | Badge plan, gating curso |
| `src/pages/Lesson.tsx` | Pasar copilotoMode |
| `src/components/lesson/CopilotPanel.tsx` | Gating visual |
| `src/components/lesson/ReadingMaterialView.tsx` | PDF temporal FREE |

## Confirmaciones

- No se crean roles nuevos (todos DOCENTE)
- Gating server-side en edge function
- FREE sin storage persistente (pdf_base64 temporal)
- Watermark server-side via pdf-lib
- Upgrade en caliente sin logout
- PRD 1.2 intacto
- PRD 2.3 intacto (solo se integra watermark y persistencia condicional al pipeline existente)

