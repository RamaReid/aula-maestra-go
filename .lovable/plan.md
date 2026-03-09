

## Diagnóstico

Hay **dos problemas** que impiden importar el PDF:

### 1. Gate de plan FREE no fue eliminado (líneas 100-108 del edge function)
El código del edge function `import-curriculum-pdf/index.ts` todavía tiene el bloqueo que rechaza uploads manuales para usuarios FREE con un 403. El cambio anterior no se aplicó correctamente.

### 2. Error de pdfjs-dist: `No "GlobalWorkerOptions.workerSrc" specified`
La librería `pdfjs-dist` importada desde `esm.sh` falla en el entorno Deno Edge Function. La opción `disableWorker: true` no está funcionando con esta versión. La solución es migrar a `pdfjs-serverless`, una distribución específica para entornos serverless (Deno, Cloudflare Workers) que no requiere worker ni configuración adicional.

## Plan

### Archivo 1: `supabase/functions/import-curriculum-pdf/index.ts`
- **Eliminar líneas 100-108**: el bloque `if (wantsManualUpload && planType === "FREE")` que devuelve 403

### Archivo 2: `supabase/functions/_shared/curriculumImport.ts`
- **Cambiar el import** de `pdfjs-dist` a `pdfjs-serverless`:
  ```
  // Antes:
  import { getDocument } from "https://esm.sh/pdfjs-dist@4.10.38/legacy/build/pdf.mjs";
  
  // Después:
  import { getDocument } from "https://esm.sh/pdfjs-serverless";
  ```
- **Actualizar `extractPdfText`** para usar la API de `pdfjs-serverless` (que es compatible pero no necesita `disableWorker`, `useSystemFonts`, ni `isEvalSupported`)

### Archivo 3: `supabase/functions/process-authorized-source/index.ts`
- Verificar si también importa `pdfjs-dist` y actualizarlo igualmente

### Deploy
- Redesplegar `import-curriculum-pdf` después de los cambios

