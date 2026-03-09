# DEPLOYMENT

## Forma de despliegue esperada por el codigo

El repo esta armado para:

- frontend Vite / React
- backend Supabase
- edge functions Deno
- secretos de entorno para IA, billing y fetch externos

## Project ref visible en el repo

`supabase/config.toml` contiene:

- `project_id = "jsejuuyqjtevtoguljiv"`

Eso identifica el proyecto Supabase esperado, pero no confirma por si solo su estado actual en cloud.

## Variables del frontend

El frontend usa:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Se consumen en:

- `src/integrations/supabase/client.ts`
- `src/components/lesson/CopilotChat.tsx`

## Variables de edge functions

### Base Supabase

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

### IA

- `LOVABLE_API_KEY`
- `AI_DAILY_BUDGET_USD` (opcional, usado en `generate-materials`)

### Curriculum / fetch externo

- `FIRECRAWL_API_KEY`

### Billing

- `APP_BASE_URL`
- `MERCADO_PAGO_ACCESS_TOKEN`
- `MERCADO_PAGO_WEBHOOK_SECRET`
- `MERCADO_PAGO_BASICO_PRICE_ARS`
- `MERCADO_PAGO_PREMIUM_PRICE_ARS`
- `MERCADO_PAGO_CURRENCY_ID` (opcional)
- `MERCADO_PAGO_REASON_PREFIX` (opcional)

## Scripts de ejecucion

Desde `package.json`:

- `npm run dev`
- `npm run build`
- `npm run preview`
- `npm run test`
- `npm run import:curriculum`

## Ejecucion local minima

1. Instalar dependencias con `npm install`
2. Configurar variables Vite del frontend
3. Tener el proyecto Supabase correcto
4. Ejecutar `npm run dev`

## Despliegue backend esperado

1. Aplicar migraciones de `supabase/migrations`
2. Desplegar edge functions
3. Cargar secretos requeridos
4. Verificar buckets:
   - `reading-materials-pdf`
   - `authorized-sources`

## Lo que depende de configuracion externa

- login social
- billing automatico
- OCR por IA
- proxy Firecrawl
- copiloto y generacion de materiales

Sin secretos correctos, la UI puede cargar pero varias funciones avanzadas no van a operar.

## Hosting del frontend

El repo prueba un build Vite estandar. Tambien contiene `lovable-tagger` en desarrollo, lo que indica compatibilidad con el ecosistema Lovable. Aun asi, el codigo por si solo no fija un hosting unico.

## Comandos utiles de verificacion

- `npm run build`
- `npm run test`

## Advertencia para la carpeta tecnica

No afirmar:

- que todos los secretos de produccion estan cargados
- que el billing esta activo en un entorno especifico
- que existe staging separado

Eso requiere validacion del entorno desplegado, no solo del repo.
