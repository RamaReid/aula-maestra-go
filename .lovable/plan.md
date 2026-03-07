

# Fix build errors + verify ABC curriculum access

## Two build fixes

### 1. `supabase/functions/process-authorized-source/index.ts` line 4
Change `npm:mammoth@1.8.0` to `https://esm.sh/mammoth@1.8.0` (esm.sh works in Deno edge functions without deno.json config).

### 2. `src/pages/Billing.tsx` line 165
Add double-cast: `as unknown as ManualPaymentRequestRow[]` to fix the TypeScript overlap error.

## Verify ABC curriculum access

After fixing the build, invoke the `resolve-curriculum-document` edge function to test connectivity to the official ABC index URLs:
- `https://abc.gob.ar/secretarias/areas/subsecretaria-de-educacion/educacion-secundaria/educacion-secundaria/disenos-curriculares`
- `https://servicios.abc.gov.ar/lainstitucion/organismos/consejogeneral/disenioscurriculares/secundaria/`

I will fetch both URLs to verify they are reachable and returning curriculum content.

## Files to modify
- `supabase/functions/process-authorized-source/index.ts` (line 4)
- `src/pages/Billing.tsx` (line 165)

