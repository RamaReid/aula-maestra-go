
## Understanding the problem

The user's point is clear and correct: the URL path doesn't work (server blocks automated fetches), and the manual PDF upload is currently gated behind paid plans (BASICO/PREMIUM). The user wants ALL users — including FREE plan — to be able to upload a PDF manually, since they can download the files themselves from Google or ABC directly.

This is a policy change, not a technical problem. Two places need to change:

1. **Edge function** `import-curriculum-pdf/index.ts` — line 100-108 blocks `file_base64` for FREE plan users with a 403
2. **Frontend** `CurriculumImport.tsx` — line 75 sets `canUploadManualPdf = planType === "BASICO" || planType === "PREMIUM"`, which hides the file upload field and the submit button for FREE users

## Plan

### 1. Edge Function: remove the FREE plan block on manual upload

Remove lines 100–108 in `import-curriculum-pdf/index.ts`:
```typescript
// DELETE THIS BLOCK:
if (wantsManualUpload && planType === "FREE") {
  return new Response(
    JSON.stringify({ error: "La carga manual de PDF requiere un plan BASICO o PREMIUM." }),
    { status: 403, ... }
  );
}
```

The validation that `file_base64` or `official_url` must be present stays. The plan check is simply removed.

### 2. Frontend: show the file upload field to all users

- Change line 75: `const canUploadManualPdf = true;` (all plans can upload)  
- Remove the `{!canUploadManualPdf && (...)}` block that shows the "Plan FREE: Solo sincronización por URL" banner — it no longer applies
- Keep the optional URL field for all users (for traceability)
- Update `canSubmit` to accept a file from any user: `!!file || (officialUrl.trim().startsWith("https://abc.gob.ar/") && ...)`
- Simplify the instructions text to just say "download PDF from ABC and upload it here"

### Files to modify

| File | Change |
|------|--------|
| `supabase/functions/import-curriculum-pdf/index.ts` | Remove FREE plan gate on `file_base64` (lines 100–108) |
| `src/pages/CurriculumImport.tsx` | Open file upload to all plans, simplify UI |
