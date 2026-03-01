

# Implementacion: Landing + Demo + Google OAuth + Sistema Visual Canonico

## Confirmaciones

- **READY_FOR_PRODUCTION** -> label **"Listo"**, tone **success** en todos los mapeos (StatusBadge, StepHeader, lesson rows, demo).
- En Lesson, si brief es null o IN_PROGRESS -> CTA primario **"Completar brief"** con scroll suave a `#brief-form`.

---

## Fase 1: CSS Tokens + Tailwind (2 archivos)

### `src/index.css` -- agregar tokens de estado en `:root` y `.dark`

Variables nuevas: `--success`, `--warning`, `--danger`, `--archived` (con foreground).

### `tailwind.config.ts` -- mapear tokens

Agregar `success`, `warning`, `danger`, `archived` en `extend.colors`.

---

## Fase 2: 5 Componentes UI (crear)

### `src/components/ui/StatusBadge.tsx`

- Props: `tone: "success" | "warning" | "danger" | "archived" | "neutral"`, `label: string`
- Helpers exportados:
  - `briefLabel(status)`: null -> "Borrador", IN_PROGRESS -> "En progreso", READY_FOR_PRODUCTION -> **"Listo"**, PRODUCED -> "Producido"
  - `briefTone(status)`: READY_FOR_PRODUCTION/PRODUCED -> success, IN_PROGRESS -> warning, null -> neutral
  - `materialLabel(status)`: null -> "Sin generar", GENERATED -> "Generado", VALIDATED -> "Validado", INVALIDATED -> "Invalidado"
  - `materialTone(status)`: GENERATED/VALIDATED -> success, INVALIDATED -> danger, null -> neutral
  - `planLabel(status)`: VALIDATED -> "Validado", else "Incompleto"
  - `planTone(status)`: VALIDATED -> success, else warning

### `src/components/ui/StepHeader.tsx`

"Paso {n} -- {title}" con StatusBadge a la derecha.

### `src/components/ui/EmptyState.tsx`

Card centrada con icono, titulo, descripcion, CTA opcional.

### `src/components/ui/SkeletonList.tsx`

N Skeleton rectangles usando componente Skeleton existente.

### `src/components/ui/InlineValidationSummary.tsx`

Bloque con borde danger, lista de errores con AlertCircle.

---

## Fase 3: Paginas publicas (crear)

### `src/pages/Landing.tsx`

- Si user autenticado: redirect a /dashboard
- Header minimal + Hero con CTAs "Probar demo" y "Crear cuenta gratis"
- Secciones: 3 beneficios, 3 pasos, FAQ (Accordion), footer
- Solo import de useAuth para redirect check

### `src/pages/Demo.tsx`

- Banner sticky: "Modo demo -- no se guarda" + CTA "Crear cuenta"
- Tabs: Planificacion | Lecciones | Materiales | Agenda
- **CERO imports de supabase, CERO calls a edge functions**
- Datos 100% mock en constantes locales
- Tab Planificacion: CTA "Validar plan (demo)" toggle local
- Tab Lecciones: StatusBadge por brief/material (READY_FOR_PRODUCTION = "Listo")
- Tab Materiales: ejemplo + "Exportar" mock
- Tab Agenda: tabla readonly

---

## Fase 4: Google OAuth

### `src/pages/Login.tsx` (modificar)

- Boton "Continuar con Google" como CTA primario arriba del form
- `supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } })`
- Separador "o" + form email como alternativa

### `src/pages/Register.tsx` (modificar)

- Mismo patron: Google arriba + separador + email abajo

---

## Fase 5: Router

### `src/App.tsx` (modificar)

- Eliminar HomeRedirect (solo tenia Navigate condicional)
- Agregar rutas publicas: `/` -> Landing, `/demo` -> Demo
- Mantener todas rutas privadas sin cambios

---

## Fase 6: Aplicar componentes canonicos

### `src/pages/Dashboard.tsx`

- Spinner -> SkeletonList
- Empty state hardcoded -> EmptyState con CTA "Crear primer curso"
- Badge -> StatusBadge (planTone/planLabel)

### `src/pages/Course.tsx`

- Badge "Archivado" -> StatusBadge tone="archived"
- Spinner -> SkeletonList
- Empty states -> EmptyState
- Lesson rows: StatusBadge con briefLabel/briefTone

### `src/pages/Lesson.tsx`

- h2 "Paso 1" -> StepHeader con briefLabel/briefTone
- h2 "Paso 2" -> StepHeader con materialLabel/materialTone
- Agregar `id="brief-form"` al section de BriefForm
- CTA canonico:
  - brief null/IN_PROGRESS: **"Completar brief"** -> scroll a #brief-form
  - brief READY_FOR_PRODUCTION + no material: GenerateButton (ya existe)
  - material GENERATED: "Ver materiales" scroll
  - material INVALIDATED: "Revisar y regenerar"
- Spinner -> SkeletonList
- Badge status -> StatusBadge

### `src/components/plan/PlanEditor.tsx`

- Agregar estado validationErrors
- Mostrar InlineValidationSummary arriba de Tabs cuando validate_plan falla

---

## Archivos afectados (16 total)

| Archivo | Accion |
|---------|--------|
| `src/index.css` | Modificar |
| `tailwind.config.ts` | Modificar |
| `src/components/ui/StatusBadge.tsx` | Crear |
| `src/components/ui/StepHeader.tsx` | Crear |
| `src/components/ui/EmptyState.tsx` | Crear |
| `src/components/ui/SkeletonList.tsx` | Crear |
| `src/components/ui/InlineValidationSummary.tsx` | Crear |
| `src/pages/Landing.tsx` | Crear |
| `src/pages/Demo.tsx` | Crear |
| `src/pages/Login.tsx` | Modificar |
| `src/pages/Register.tsx` | Modificar |
| `src/App.tsx` | Modificar |
| `src/pages/Dashboard.tsx` | Modificar |
| `src/pages/Course.tsx` | Modificar |
| `src/pages/Lesson.tsx` | Modificar |
| `src/components/plan/PlanEditor.tsx` | Modificar |

**NO se toca**: DB, migraciones, edge functions, ProtectedRoute, AuthContext.

---

## QA Checklist (post-implementacion)

| # | Test | Esperado |
|---|------|----------|
| 1 | Incognito: / | Landing publica |
| 2 | /demo sin auth | Funciona, tabs navegables |
| 3 | /demo Network | 0 writes Supabase, 0 edge function calls |
| 4 | /login | "Continuar con Google" CTA primario |
| 5 | Post-login Google | Redirect a /dashboard |
| 6 | Dashboard carga | SkeletonList |
| 7 | Dashboard 0 cursos | EmptyState + CTA |
| 8 | Dashboard cards | StatusBadge plan |
| 9 | Course header | StatusBadge ACTIVE/ARCHIVED |
| 10 | Lesson header | StepHeader paso 1 y 2 |
| 11 | Lesson brief null | CTA "Completar brief" + scroll |
| 12 | PlanEditor validate fail | InlineValidationSummary |
| 13 | Auth user visita / | Redirect /dashboard |

