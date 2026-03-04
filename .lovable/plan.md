

# Diagnostico: No se pueden importar programas

## Problemas encontrados

Hay dos bloqueantes principales:

### 1. Faltan columnas en la tabla `curriculum_documents`

La tabla en la base de datos solo tiene: `id`, `province`, `subject`, `cycle`, `year_level`, `status`, `official_url`, `content_hash`, `created_at`, `updated_at`.

Pero el codigo (tanto el frontend como las edge functions) esperan columnas que no existen:
- `source_provider`
- `school_type`
- `orientation`
- `speciality`
- `official_title`
- `fetched_at`

Esto causa los errores 400 que se ven en los network requests: `"column curriculum_documents.source_provider does not exist"`.

### 2. Errores de compilacion en las Edge Functions

Hay 4 errores de TypeScript que impiden el deploy de las funciones:
- Re-export de tipos sin `export type` (isolatedModules)
- `ArrayBufferLike` no asignable a `BufferSource`
- Argumento `string | null` donde se espera `string`

Esto hace que `import-curriculum-pdf` y `resolve-curriculum-document` no esten activas, por eso las llamadas fallan con "Failed to fetch".

## Plan de correccion

### Paso 1: Migracion de base de datos
Agregar las 6 columnas faltantes a `curriculum_documents`:

```sql
ALTER TABLE public.curriculum_documents
  ADD COLUMN IF NOT EXISTS source_provider text NOT NULL DEFAULT 'MANUAL',
  ADD COLUMN IF NOT EXISTS school_type text,
  ADD COLUMN IF NOT EXISTS orientation text,
  ADD COLUMN IF NOT EXISTS speciality text,
  ADD COLUMN IF NOT EXISTS official_title text,
  ADD COLUMN IF NOT EXISTS fetched_at timestamptz;
```

### Paso 2: Fixes de tipado en Edge Functions
En `supabase/functions/_shared/curriculumImport.ts`:
- Cambiar `export { ... }` a `export type { ... }`
- Castear el buffer a `ArrayBuffer` para `crypto.subtle.digest`
- Manejar el `null` en `deriveOfficialTitle` con fallback

### Paso 3: Fix de tipos en el frontend
En `Course.tsx`, `CourseNew.tsx` y `CurriculumImport.tsx`: los tipos se alinean automaticamente cuando se regenere `types.ts` tras la migracion.

