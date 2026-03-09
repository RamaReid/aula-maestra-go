
## Diagnóstico del error

**"Edge Function returned a non-2xx status code"** al importar desde `https://abc.gob.ar/.../disenos-curriculares`

### Causa raíz — 3 problemas encadenados

**Problema 1 (principal): La URL del índice no es un PDF**
La función `import-curriculum-pdf` recibe en `official_url` la URL de la página índice de ABC (`/disenos-curriculares`), pero el código en `curriculumImport.ts` (`downloadPdfBytesFromUrl`, línea 763-769) valida que la respuesta sea un PDF mediante:
```ts
if (!contentType.includes("pdf") && !url.toLowerCase().endsWith(".pdf")) {
  throw new Error("La URL no devolvio un PDF.");
}
```
Esa URL es HTML, no termina en `.pdf` y devuelve `text/html`. Por eso la función lanza 500.

**Problema 2: El frontend usa esa URL como `official_url` sin diferenciarla de un PDF directo**
En `CurriculumImport.tsx`, la UI tiene un solo campo "URL oficial del programa en ABC" que acepta tanto URLs de índice como de PDF directos, pero el backend solo acepta PDFs directos.

**Problema 3 (secundario): Los datos de semilla no tienen `raw_text`**
La mayoría de los documentos seeded (`MANUAL`, `source_provider`) tienen `raw_text_len: 0`, lo que explica el error anterior de `repair-curriculum-bibliography`.

---

## Plan de corrección

### 1. `supabase/functions/_shared/curriculumImport.ts` — Manejar URLs de índice HTML
Modificar `downloadPdfBytesFromUrl` para que cuando la URL no sea un PDF directo, intente hacer scraping del HTML para encontrar el primer enlace a un PDF en el mismo dominio `abc.gob.ar`. Si lo encuentra, descarga ese PDF. Así el flujo soporta tanto:
- URL directa de PDF: `https://abc.gob.ar/.../historia.pdf` → descarga directa
- URL de página/índice: `https://abc.gob.ar/.../disenos-curriculares` → scraping → primer PDF que coincida

### 2. `supabase/functions/import-curriculum-pdf/index.ts` — Pasar `subject` y `year_level` al descargador
Para que el scraping pueda filtrar el PDF correcto por materia/año cuando la URL es una página índice.

### 3. `src/pages/CurriculumImport.tsx` — Mejorar el mensaje de ayuda en el campo URL
Aclarar que la URL puede ser tanto la del PDF directamente como la del índice. El botón "Abrir índice oficial de ABC" ya existe; agregar un tooltip/helper text que indique que ambos formatos funcionan.

### 4. Deploy
Redesplegar `import-curriculum-pdf` y el shared `curriculumImport.ts`.

---

## Cambios de archivos

```text
supabase/functions/_shared/curriculumImport.ts
  downloadPdfBytesFromUrl():
    - Si el content-type es HTML o la URL no termina en .pdf:
      → parsear el HTML buscando <a href="...pdf"> dentro de abc.gob.ar
      → filtrar por subject/year_level si se pasan como parámetros opcionales
      → descargar el primer PDF encontrado
    - Si no encuentra PDF: throw con mensaje claro

supabase/functions/import-curriculum-pdf/index.ts
  - Pasar subject + year_level a ingestCurriculumDocument para filtrado de scraping

src/pages/CurriculumImport.tsx
  - Helper text del campo "URL oficial": indicar que puede ser la URL del índice o del PDF
  - Mejorar el mensaje de error para que sea más descriptivo
```

---

## Riesgo

Bajo. El scraping solo ocurre si la URL no es un PDF directo. Si la URL ya es un PDF, el comportamiento actual no cambia.
