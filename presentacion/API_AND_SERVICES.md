# API AND SERVICES

## Frontend to backend contract

La app no usa un backend propio separado. Usa:

- consultas directas a tablas Supabase
- RPCs de Postgres
- Edge Functions de Supabase
- Storage buckets de Supabase

## RPCs usados desde el frontend o las functions

### `validate_plan`

- valida y actualiza el estado del plan anual
- usada desde `Course.tsx` y `PlanEditor.tsx`

### `recalculate_entitlements`

- recalcula limites efectivos por plan
- usada por triggers y por `set-test-plan`

### `admin_upsert_billing_subscription`

- actualiza o inserta la suscripcion de billing
- usada desde `billingCommon.ts`

## Edge functions presentes en el repo

### Curriculum

- `resolve-curriculum-document`
  - busca candidatos curriculares verificados
  - consulta indice oficial de ABC y prioriza dominio oficial

- `import-curriculum-pdf`
  - importa curriculum desde URL oficial o archivo base64
  - llama a `_shared/curriculumImport.ts`

- `repair-curriculum-bibliography`
  - corrige nodos de bibliografia curricular

- `repair-curriculum-nodes`
  - funcion de reparacion sobre nodos curriculares

- `firecrawl-proxy-abc`
  - proxy para descargar PDFs de `abc.gob.ar`

### Plan y materiales

- `bootstrap-course-plan`
  - genera borrador anual del plan
  - escribe bloques, objetivos, rubricas y clases

- `generate-materials`
  - genera material didactico
  - genera lectura
  - valida reglas por plan
  - registra consumo IA

### Copiloto

- `copilot-autocomplete`
  - sugiere campos del brief docente

- `copilot-chat`
  - chat con streaming para usuarios premium

### Fuentes autorizadas y premium

- `process-authorized-source`
  - extrae texto de PDF, DOCX, XLSX, TXT e imagenes
  - usa OCR por IA para imagenes

- `resolve-premium-query`
  - valida una consulta premium
  - busca candidatos en web y devuelve opciones

### Planes y billing

- `check-course-limit`
  - verifica si el usuario puede crear otro curso

- `create-checkout`
  - crea checkout Mercado Pago

- `billing-webhook`
  - recibe notificaciones firmadas de Mercado Pago

- `reconcile-billing`
  - sincronizacion manual con proveedor

- `cancel-subscription`
  - cancela la suscripcion automatica

- `set-test-plan`
  - helper QA para cambiar plan en cuentas permitidas

## Tablas consumidas directamente por la UI

La UI lee o escribe en:

- `profiles`
- `subscriptions`
- `user_entitlements`
- `courses`
- `schools`
- `curriculum_documents`
- `curriculum_nodes`
- `course_schedule_slots`
- `plans`
- `plan_lessons`
- `plan_content_blocks`
- `plan_content_mappings`
- `plan_lesson_content_links`
- `plan_objectives`
- `plan_rubrics`
- `plan_teacher_bibliography_entries`
- `lessons`
- `lesson_briefs`
- `teaching_materials`
- `reading_materials`
- `authorized_sources`
- `authorized_source_targets`
- `premium_query_requests`
- `manual_payment_requests`

## Storage

- `reading-materials-pdf`
- `authorized-sources`

## Servicios externos reales

### Supabase

- Auth
- Postgres
- Storage
- Edge Functions

### Lovable AI Gateway

Endpoint usado: `https://ai.gateway.lovable.dev/v1/chat/completions`

Modelos vistos en codigo:

- `google/gemini-2.5-flash`
- `google/gemini-2.5-pro`
- `google/gemini-3-flash-preview`

### Mercado Pago

Uso real:

- `preapproval`
- sincronizacion de suscripcion
- cancelacion

### Firecrawl

Uso real:

- fetch indirecto de PDFs de `abc.gob.ar`

### DuckDuckGo

Uso real:

- autocomplete
- resultados HTML

### YouTube

Uso real:

- busqueda de videos
- obtencion de metadata via oEmbed

### Wikipedia

Uso real:

- busqueda de candidatos para consultas premium

### Librerias de parsing

- `pdfjs-serverless`
- `mammoth`
- `xlsx`

## Servicios que no conviene sobredimensionar

- No hay una API REST propia separada del stack Supabase.
- No hay microservicios independientes.
- No se ve un panel admin dedicado en este repo.
