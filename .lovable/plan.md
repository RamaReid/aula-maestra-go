

## Problem

The edge function `import-curriculum-pdf` crashes on boot with:
```
The requested module 'https://esm.sh/pdfjs-serverless@0.5.0' does not provide an export named 'getDocument'
```

Version `0.5.0` changed or removed the `getDocument` named export. The npm docs confirm version `0.3.2` works with `import { getDocument } from 'https://esm.sh/pdfjs-serverless'`.

Additionally, the current code does `await getDocument(bytes)` but the library returns a loading task that requires `.promise`: `await getDocument(data).promise`.

## Plan

### File: `supabase/functions/_shared/curriculumImport.ts`

1. **Change import** from `https://esm.sh/pdfjs-serverless@0.5.0` to `https://esm.sh/pdfjs-serverless@0.3.2` (known working version)

2. **Fix API call** on line 131: change `await getDocument(bytes)` to `await getDocument(bytes).promise` per the library's documented API

3. **Also check** `process-authorized-source/index.ts` for the same import and fix if needed

### File: `supabase/functions/process-authorized-source/index.ts`
- Same import fix if it uses `pdfjs-serverless@0.5.0`

### Redeploy
- Redeploy both `import-curriculum-pdf` and `process-authorized-source`

