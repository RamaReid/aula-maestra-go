

# PRD 2.3 — PATCH CRITICO

## Resumen de cambios

7 correcciones al edge function `generate-materials` y al componente `ReadingMaterialView`. No se toca PRD 1.2.

---

## 1. PDF server-side con `pdf-lib`

**Archivo:** `supabase/functions/generate-materials/index.ts`

Se agrega una funcion `generatePdfFromHtml(html: string)` que:

1. Importa `pdf-lib` via `https://cdn.skypack.dev/pdf-lib@^1.11.1?dts`
2. Limpia el HTML: elimina `<span data-ref="..."></span>` tags
3. Convierte HTML a texto plano via `stripHtml()`
4. Separa en parrafos (split por `</p>`)
5. Renderiza cada parrafo con:
   - Pagina A4 (595.28 x 841.89 pts)
   - Fuente Helvetica 12pt (embebida por defecto en pdf-lib)
   - Interlineado 1.2 (14.4pt)
   - Margenes: 72pt (aprox 2.5cm) en cada lado
   - Word-wrap manual: mide ancho de texto con `font.widthOfTextAtSize()`, corta lineas al ancho disponible
6. Cuando el cursor Y baja del margen inferior, agrega nueva pagina
7. Retorna `{ pdfBytes: Uint8Array, pageCount: number }`

**Subida a Storage:**
- Bucket existente: `reading-materials-pdf` (publico)
- Path: `{lessonId}/reading-material.pdf`
- Usa `adminClient.storage.from('reading-materials-pdf').upload(path, pdfBytes, { contentType: 'application/pdf', upsert: true })`
- Obtiene URL publica con `getPublicUrl(path)`
- Guarda en `reading_materials.pdf_url`

**Conteo de paginas:**
- `pdfDoc.getPageCount()` de pdf-lib retorna el numero real de paginas
- Si `pageCount < 2 || pageCount > 4` → agrega razon de validacion y reintenta

## 2. Reintentos: maximo 2 reintentos (3 intentos totales)

**Ya esta correcto.** `maxAttempts = 3` significa 1 intento inicial + 2 reintentos. No hay cambio en la variable pero se agrega la validacion de paginas PDF al loop de reintentos.

**Nuevo flujo del loop:**

```text
while (!readingValid && attempts < 3) {
  attempts++
  1. Llamar AI para generar HTML
  2. Validar estructura (listas, palabras, cierre, matematica, data-ref)
  3. Si estructura valida → generar PDF → validar paginas (2-4)
  4. Si paginas invalidas → agregar razon y reintentar
}
```

La generacion de PDF solo se ejecuta si la validacion estructural pasa, para no desperdiciar recursos.

## 3. Estados finales corregidos

- Si reading pasa todas las validaciones (estructura + paginas) → `status = 'VALIDATED'`
- Si falla despues de 3 intentos → `status = 'INVALIDATED'`
- Se elimina el estado intermedio `GENERATED` como resultado final
- Teaching material: se setea `status = 'VALIDATED'` al generarse exitosamente (en lugar de `GENERATED`)

## 4. Validaciones corregidas

### Listas HTML
El regex actual `/<ul[\s>]/i` ya es correcto y funcional. Se confirma que detecta `<ul>`, `<ul class="...">`, `<ol>`, `<li>`.

### Ultimo parrafo (cierre en Sociales)
Se corrige la logica para obtener el ultimo parrafo real:

```text
// Antes (incorrecto): split por </p>, el ultimo elemento puede ser basura
const paragraphs = html.split(/<\/p>/i).filter(p => p.trim().length > 0);

// Despues (correcto): extraer contenido de cada <p>...</p>, filtrar vacios
const pMatches = html.match(/<p[^>]*>([\s\S]*?)<\/p>/gi) || [];
const paragraphs = pMatches
  .map(p => stripHtml(p))
  .filter(t => t.length > 0);
const lastParagraph = paragraphs[paragraphs.length - 1]?.toLowerCase() || "";
```

Se agregan 2 frases prohibidas adicionales:
- "se puede afirmar que"
- "asi se demuestra que"

## 5. Pipeline completo de validacion

Orden dentro del loop de reintentos:

```text
1. Generar HTML via AI
2. Limpiar markdown artifacts
3. Validar estructura:
   a. Sin listas HTML (<ul>, <ol>, <li>)
   b. Sin listas numeradas en texto
   c. Sin resolucion matematica
   d. Conteo de palabras 1000-1300
   e. Todos los data-ref presentes
   f. Cierre en Sociales (ultimo parrafo real)
4. Si estructura invalida → reintentar con hint
5. Si estructura valida → generar PDF con pdf-lib
6. Contar paginas del PDF
7. Si paginas < 2 o > 4 → agregar razon, reintentar
8. Si todo valida → subir PDF a storage, setear pdf_url, status VALIDATED
```

## 6. Respuesta del endpoint actualizada

```text
{
  "success": true,
  "teaching_status": "VALIDATED" | "skipped",
  "reading_status": "VALIDATED" | "INVALIDATED" | "skipped",
  "reading_word_count": 1234,
  "reading_pdf_pages": 3,
  "reading_pdf_url": "https://...",
  "reading_validation_issues": []
}
```

## 7. UI: ReadingMaterialView actualizado

**Archivo:** `src/components/lesson/ReadingMaterialView.tsx`

- Eliminar la funcion `handlePrintPDF` (window.print)
- El boton "Descargar como PDF" ahora es un link `<a href={material.pdf_url}>` que abre/descarga el PDF real desde storage
- Solo se muestra si `pdf_url` no es null
- Se mantiene el badge de status y el alert de validacion (ya implementados)

---

## Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `supabase/functions/generate-materials/index.ts` | PDF server-side, pipeline validacion, estados VALIDATED, cierre corregido, respuesta actualizada |
| `src/components/lesson/ReadingMaterialView.tsx` | Eliminar window.print, usar pdf_url real |

## Confirmaciones

- PDF ya no depende de window.print()
- pdf_url se llena al validar exitosamente
- Paginas 2-4 validadas por conteo real via pdf-lib
- Reintentos automaticos = max 2 reintentos (3 intentos totales)
- Status final = VALIDATED o INVALIDATED (nunca GENERATED)
- Regex listas HTML confirmadas correctas
- Cierre Sociales corregido: ultimo parrafo real via regex `<p>...</p>` + 5 frases prohibidas
- PRD 1.2 no se modifica

