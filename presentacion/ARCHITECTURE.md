# ARCHITECTURE

## Vista general

La arquitectura real es una SPA en React que consume Supabase para auth, datos, storage y edge functions. La logica pesada del dominio vive en:

- tablas y RPCs de Postgres
- edge functions para IA, curriculum, pagos y procesamiento de fuentes

## Capas

### 1. Frontend

El frontend esta en `src/` y usa:

- `App.tsx` para router y providers
- `AuthContext.tsx` para sesion y perfil
- `useEntitlements.ts` para plan efectivo y limites
- paginas por dominio: landing, demo, dashboard, billing, curso, leccion
- componentes especializados para plan anual, agenda, brief y materiales

Las rutas privadas relevantes son:

- `/dashboard`
- `/curriculum/import`
- `/billing`
- `/course/new`
- `/course/:courseId`
- `/lesson/:lessonId`

### 2. Auth

La autenticacion se resuelve con Supabase Auth. El contexto de auth:

- escucha cambios de sesion
- carga `profiles`
- expone login, signup y logout

Ademas existe integracion con `@lovable.dev/cloud-auth-js` para login Google y sincronizacion del token hacia Supabase.

### 3. Base de datos

La base principal es Postgres en Supabase. La app separa claramente:

- identidad y suscripciones
- contexto escolar y curriculum
- planificacion anual
- ejecucion de clases
- materiales generados
- billing y trazabilidad
- fuentes premium / fuentes propias

La relacion central del dominio es:

`profile -> course -> plan -> plan_lessons -> lessons -> lesson_briefs/materials`

Y en paralelo:

`course -> curriculum_document -> curriculum_nodes`

## Arquitectura funcional

### Flujo de curso y plan

1. El docente crea o selecciona un documento curricular.
2. Crea un curso con escuela, materia, año y horarios.
3. Se crea un `plan` asociado y 28 `plan_lessons`.
4. `bootstrap-course-plan` genera contenido base del plan anual.
5. El docente edita y valida el plan con `validate_plan`.
6. Desde el curso o la agenda se crean / sincronizan `lessons`.
7. Cada lesson puede recibir brief, fuentes y materiales.

### Flujo de materiales

1. El docente completa `lesson_briefs`.
2. Puede confirmar bibliografia curricular.
3. Puede agregar `authorized_sources`.
4. `generate-materials` construye material didactico y lectura.
5. La salida se guarda en `teaching_materials` y `reading_materials`.
6. La lectura validada puede descargarse o abrirse como PDF.

### Flujo de billing

1. La pagina `Billing` muestra suscripcion y entitlements.
2. `create-checkout` inicia un `preapproval` en Mercado Pago.
3. `billing-webhook` recibe la notificacion firmada.
4. `admin_upsert_billing_subscription` sincroniza `subscriptions`.
5. `recalculate_entitlements` actualiza `user_entitlements`.
6. `reconcile-billing` permite resync manual.
7. `cancel-subscription` cancela desde la app si el proveedor es Mercado Pago.

## Servicios externos realmente usados

### IA

Las edge functions llaman al gateway de Lovable:

- `bootstrap-course-plan`: `google/gemini-2.5-flash`
- `generate-materials`: `google/gemini-2.5-flash` para material didactico y `google/gemini-2.5-pro` para lectura
- `copilot-autocomplete`: `google/gemini-3-flash-preview`
- `copilot-chat`: `google/gemini-3-flash-preview`
- `process-authorized-source`: `google/gemini-2.5-flash` para OCR de imagenes

### Curriculum y fetch externo

- `abc.gob.ar` como dominio oficial admitido
- `Firecrawl` para sortear problemas de descarga de PDFs oficiales
- `pdfjs-serverless` para extraer texto de PDF

### Fuentes premium

- DuckDuckGo autocomplete y resultados HTML
- YouTube search + oEmbed
- Wikipedia API

### Pagos

- Mercado Pago `preapproval`

## Storage

Buckets usados por la app:

- `reading-materials-pdf`
- `authorized-sources`

## Seguridad y control de acceso

El esquema implementa RLS y ownership helpers para varias tablas criticas:

- `lesson_briefs`
- `teaching_materials`
- `reading_materials`
- `authorized_sources`
- `authorized_source_targets`
- `premium_query_requests`
- `subscriptions`
- `user_entitlements`
- `usage_counters`
- `manual_payment_requests`

## Despliegue inferido desde el repo

La forma de despliegue que el codigo espera es:

- frontend Vite
- backend Supabase
- edge functions Deno
- secretos en Supabase Functions / entorno Lovable

El repo incluye `supabase/config.toml` con `project_id = jsejuuyqjtevtoguljiv`, pero el codigo por si solo no confirma el estado actual del proyecto cloud.
