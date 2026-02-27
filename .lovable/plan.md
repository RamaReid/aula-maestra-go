

# PRD 3 — Planes, Entitlements y Gating

## Resumen

Implementar sistema de suscripciones (FREE/BASICO/PREMIUM), entitlements derivados, contadores de uso semanal, gating server-side, watermark en PDF, y persistencia condicional de PDF. Sin tocar PRD 1.2 ni PRD 2.3.

---

## Fase 1: Migracion de base de datos

### 1.1 Crear enums

```text
plan_type: FREE | BASICO | PREMIUM
subscription_status: ACTIVE | CANCELED | EXPIRED
copiloto_mode: none | limited | full
```

### 1.2 Tabla `subscriptions`

| Columna | Tipo | Constraint |
|---------|------|-----------|
| id | uuid PK | default gen_random_uuid() |
| user_id | uuid NOT NULL | unique (1 active per user enforced by trigger) |
| plan_type | plan_type NOT NULL | default 'FREE' |
| status | subscription_status NOT NULL | default 'ACTIVE' |
| start_date | timestamptz NOT NULL | default now() |
| end_date | timestamptz | nullable |
| created_at | timestamptz | default now() |
| updated_at | timestamptz | default now() |

RLS: owner can SELECT own rows. No direct INSERT/UPDATE/DELETE from client (managed by triggers and admin).

### 1.3 Tabla `user_entitlements`

| Columna | Tipo | Default |
|---------|------|---------|
| id | uuid PK | gen_random_uuid() |
| user_id | uuid NOT NULL UNIQUE | |
| max_courses | int NOT NULL | 1 |
| max_students_per_course | int NOT NULL | 35 |
| max_weekly_sessions | int NOT NULL | 2 |
| max_classes_per_session | int NOT NULL | 3 |
| watermark_enabled | bool NOT NULL | true |
| history_enabled | bool NOT NULL | false |
| copiloto_mode | copiloto_mode NOT NULL | 'none' |
| auto_complete_forms_enabled | bool NOT NULL | false |
| persistent_storage_enabled | bool NOT NULL | false |
| created_at | timestamptz | now() |
| updated_at | timestamptz | now() |

RLS: owner can SELECT. No direct mutations from client.

### 1.4 Tabla `usage_counters`

| Columna | Tipo | Default |
|---------|------|---------|
| id | uuid PK | gen_random_uuid() |
| user_id | uuid NOT NULL UNIQUE | |
| week_start_date | date NOT NULL | (computed to current Monday) |
| sessions_used_this_week | int NOT NULL | 0 |
| created_at | timestamptz | now() |
| updated_at | timestamptz | now() |

RLS: owner can SELECT. No direct mutations.

### 1.5 Trigger: auto-crear subscription + entitlements + counter al registrarse

Modificar `handle_new_user()` para que ademas de crear profile y role, tambien:
1. Inserte `subscriptions` con plan_type=FREE, status=ACTIVE
2. Inserte `user_entitlements` con valores FREE
3. Inserte `usage_counters` con week_start_date = lunes de la semana actual, sessions_used=0

### 1.6 Funcion: `recalculate_entitlements(user_id, plan_type)`

Funcion PL/pgSQL que actualiza `user_entitlements` segun plan_type:

```text
FREE:  max_courses=1, max_students=35, max_weekly=2, max_classes=3, watermark=true, history=false, copiloto=none, auto_complete=false, persistent_storage=false
BASICO: max_courses=15, max_students=9999, max_weekly=9999, max_classes=9999, watermark=false, history=true, copiloto=limited, auto_complete=false, persistent_storage=true
PREMIUM: max_courses=9999, max_students=9999, max_weekly=9999, max_classes=9999, watermark=false, history=true, copiloto=full, auto_complete=true, persistent_storage=true
```

### 1.7 Trigger: recalcular entitlements al cambiar plan_type

Trigger on `subscriptions` AFTER UPDATE: si `NEW.plan_type != OLD.plan_type`, llamar `recalculate_entitlements(NEW.user_id, NEW.plan_type)`.

### 1.8 Funcion: reset semanal de counters

Funcion `reset_weekly_counters()` que se puede invocar via cron o edge function. Actualiza `week_start_date` al lunes actual y `sessions_used_this_week = 0` para todos los usuarios cuyo `week_start_date < date_trunc('week', now())`.

No se configura cron automaticamente (Lovable Cloud no lo soporta nativamente), pero se agrega logica lazy en el edge function: antes de verificar limites, si `week_start_date` del counter es anterior al lunes actual, resetear inline.

---

## Fase 2: Edge Function — Gating server-side

### 2.1 Modificar `generate-materials/index.ts`

Agregar al inicio del flujo (despues de auth, antes de validaciones de leccion):

1. **Fetch entitlements** del usuario (`user_entitlements` + `usage_counters`)
2. **Lazy reset semanal**: si `usage_counters.week_start_date < lunes_actual` → resetear via adminClient
3. **Validar sesiones semanales**: si `sessions_used_this_week >= max_weekly_sessions` → 403 con mensaje claro
4. **Validar clases por sesion** (FREE): contar `teaching_materials` VALIDATED esta semana para este curso. Si >= `max_classes_per_session` → 403
5. **Watermark**: si `watermark_enabled`, agregar watermark diagonal en cada pagina del PDF usando pdf-lib (texto "DEMO - Plan Gratuito", opacidad 0.08, rotado 45 grados, repetido 3 veces por pagina)
6. **Persistencia condicional**: si `persistent_storage_enabled === false`, NO subir PDF al bucket, NO setear `pdf_url`. En su lugar, devolver `pdf_base64` en la respuesta para visualizacion temporal
7. **Incrementar counter**: solo al finalizar con exito (status VALIDATED), incrementar `sessions_used_this_week` via adminClient

### 2.2 Respuesta actualizada

```text
{
  "success": true,
  "teaching_status": "VALIDATED" | "skipped",
  "reading_status": "VALIDATED" | "INVALIDATED" | "skipped",
  "reading_word_count": 1234,
  "reading_pdf_pages": 3,
  "reading_pdf_url": "..." | null,
  "reading_pdf_base64": "..." | null,  // solo FREE
  "reading_validation_issues": [],
  "watermark_applied": true | false
}
```

---

## Fase 3: Gating de creacion de cursos

### 3.1 Edge function `check-course-limit`

Nuevo edge function que:
1. Obtiene `user_entitlements.max_courses` del usuario
2. Cuenta cursos ACTIVE del usuario
3. Retorna `{ can_create: boolean, current: N, max: M }`

### 3.2 Dashboard — boton "Nuevo curso"

Actualmente el boton esta `disabled`. Al habilitarlo:
- Antes de crear curso, llamar `check-course-limit`
- Si `can_create === false`, mostrar toast con "Alcanzaste el limite de cursos de tu plan (N/M)"
- Si puede, proceder con la creacion

---

## Fase 4: Frontend — Context de entitlements

### 4.1 Hook `useEntitlements`

Nuevo hook que:
- Fetch `subscriptions` (plan_type, status) y `user_entitlements` del usuario logueado
- Expone: `planType`, `entitlements`, `loading`, `refetch`
- Se usa en AuthContext o como provider separado

### 4.2 UI de plan actual

En Dashboard header, mostrar badge con plan actual (FREE / BASICO / PREMIUM).

### 4.3 Gating visual en Copiloto

Si `copiloto_mode === "none"`:
- Ocultar o deshabilitar los controles de regeneracion selectiva y ajuste de profundidad
- Mostrar mensaje "Actualiza tu plan para usar el Copiloto"

Si `copiloto_mode === "limited"`:
- Permitir regeneracion pero no auto-complete

### 4.4 ReadingMaterialView — PDF temporal para FREE

Si `pdf_url` es null pero la respuesta incluyo `pdf_base64`:
- Mostrar boton "Ver PDF (temporal)" que abre un blob URL
- Mostrar aviso "Este PDF no se guarda. Actualiza tu plan para almacenamiento permanente."

---

## Fase 5: Upgrade en caliente

### 5.1 Mecanismo

No hay pasarela de pago en este PRD. El upgrade se simula:
- Funcion admin `upgrade_user_plan(user_id, new_plan_type)` que actualiza `subscriptions.plan_type`
- El trigger recalcula entitlements automaticamente
- En el frontend, `useEntitlements` refetches al detectar cambio (polling cada 30s o realtime)

### 5.2 Sin logout

El recalculo es automatico. El frontend refresca entitlements sin necesidad de logout/login.

---

## Archivos a crear/modificar

| Archivo | Accion |
|---------|--------|
| Migracion SQL | Crear tablas, enums, triggers, funciones |
| `supabase/functions/generate-materials/index.ts` | Gating, watermark, persistencia condicional |
| `supabase/functions/check-course-limit/index.ts` | Nuevo edge function |
| `src/hooks/useEntitlements.ts` | Nuevo hook |
| `src/contexts/AuthContext.tsx` | Agregar entitlements al context |
| `src/pages/Dashboard.tsx` | Badge de plan, gating en "Nuevo curso" |
| `src/components/lesson/CopilotPanel.tsx` | Gating visual segun copiloto_mode |
| `src/components/lesson/ReadingMaterialView.tsx` | PDF temporal para FREE |
| `src/pages/Lesson.tsx` | Pasar entitlements a componentes hijos |

## Confirmaciones

- No se crean roles nuevos (todos siguen siendo DOCENTE)
- Gating es server-side (edge function valida entitlements antes de actuar)
- FREE sin storage persistente (no sube PDF, no guarda pdf_url)
- Watermark server-side via pdf-lib en el edge function
- Upgrade en caliente sin logout (trigger recalcula, frontend refresca)
- PRD 1.2 no se modifica (no se tocan tablas existentes de Foundation)
- PRD 2.3 no se modifica (solo se integra watermark y persistencia condicional al pipeline existente)

