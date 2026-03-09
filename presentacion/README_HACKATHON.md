# README HACKATHON

## Proyecto

**Nombre visible en la UI:** `DocencIA`  
**Repo de trabajo:** `aula-maestra-go`

DocencIA es una aplicacion web para docentes de secundaria que concentra en un mismo flujo:

- seleccion del programa oficial
- creacion del curso
- armado del plan anual
- agenda de clases
- preparacion de clases
- generacion de materiales didacticos y de lectura
- gestion de planes y upgrades

El estado descrito en este documento sale del codigo actual del repo, de sus migraciones y de sus edge functions.

## Problema que resuelve

La app esta construida para evitar que la planificacion docente quede fragmentada entre:

- documentos curriculares sueltos
- formularios manuales
- cronogramas separados
- materiales de clase armados fuera del sistema
- decisiones de bibliografia y fuentes sin trazabilidad

En la implementacion actual, el curso, el plan, las clases, el brief docente, la bibliografia confirmada y los materiales generados quedan vinculados en una misma estructura de datos.

## Solucion implementada hoy

La solucion actual no es un prototipo estatico. El codigo implementa:

- landing publica
- modo demo publico
- registro, login y auth con Supabase
- dashboard con cursos y estado del plan
- importacion y resolucion de diseños curriculares
- asistente de alta de curso
- bootstrap del plan anual con IA
- edicion y validacion del plan anual
- agenda de clases
- preparacion de clase con brief docente
- generacion de material didactico y material de lectura
- exportacion PDF de salidas validadas
- fuentes propias del docente y busqueda premium guiada
- billing con Mercado Pago y solicitudes manuales

## Usuarios objetivo inferidos desde el codigo

Los flujos implementados apuntan a:

- docentes de secundaria de Provincia de Buenos Aires
- cursos de escuela comun y tecnica
- materias con anclaje curricular formal
- usuarios con tres niveles de plan: `FREE`, `BASICO`, `PREMIUM`

La UI, los textos y el resolver curricular estan orientados especificamente a `abc.gob.ar` y a diseños curriculares de PBA.

## Funcionalidades efectivamente implementadas

- **Landing y demo:** pantallas publicas para explicar el producto y mostrar un caso ya cargado.
- **Auth:** login por email/password, registro y login con Google.
- **Dashboard:** lista cursos activos/archivados, alta de curso, acceso a billing y sincronizacion curricular.
- **Curriculum import:** seleccion de documentos verificados existentes o importacion desde URL oficial / PDF.
- **Creacion de curso:** wizard de 8 pasos con escuela, ciclo, año, horario y curriculum.
- **Plan anual:** editor estructurado con fundamentacion, objetivos, bloques, rubricas, bibliografia docente y clases.
- **Validacion:** RPC `validate_plan` para pasar un plan a estado `VALIDATED`.
- **Agenda y secuencias:** sincronizacion entre `plan_lessons` y `lessons`.
- **Clase individual:** brief docente, bibliografia, fuentes autorizadas, copiloto y generacion.
- **Materiales:** material didactico estructurado y texto de lectura validable/exportable.
- **Planes y billing:** checkout, reconciliacion, cancelacion y solicitudes manuales.

## Stack real

- Frontend: React 18, TypeScript, Vite, React Router
- UI: Tailwind CSS, shadcn/ui, Radix UI
- Estado y datos: TanStack Query, Supabase JS
- Auth: Supabase Auth + `@lovable.dev/cloud-auth-js`
- Backend: Supabase Postgres, Storage, Edge Functions
- IA: Lovable AI Gateway con modelos Gemini
- Pagos: Mercado Pago
- OCR y parsing: pdfjs-serverless, Mammoth, XLSX, OCR por IA para imagenes
- Busquedas externas: DuckDuckGo, YouTube, Wikipedia, Firecrawl, `abc.gob.ar`
- Tests: Vitest

## Estado actual verificable

- La app tiene rutas publicas y privadas operativas en el frontend.
- El backend esperado esta modelado en migraciones y types de Supabase.
- Hay edge functions para curriculum, IA, billing, premium sources y soporte QA.
- Existen tests automatizados chicos pero reales para reglas de seleccion y export PDF.
- Hay evidencia fuerte de iteracion rapida con Lovable en `.lovable/plan.md`, PRDs y commits.

## Lo que no conviene afirmar sin matiz

- No hay transcript completo de todas las conversaciones de construccion.
- El repo no prueba por si solo que todos los secretos de produccion esten cargados.
- El repo no confirma por si solo el estado actual de la nube; eso depende del proyecto Supabase desplegado.

## Archivos base usados para este resumen

- `src/App.tsx`
- `src/pages/*.tsx`
- `src/components/plan/*`
- `src/components/lesson/*`
- `src/hooks/useEntitlements.ts`
- `supabase/functions/*`
- `supabase/migrations/*`
- `src/integrations/supabase/types.ts`
- `package.json`
