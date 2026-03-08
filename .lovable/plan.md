

## Plan: Bibliografía curricular genérica para cualquier materia

### Problema

`PlanEditor.fetchCurriculumBibliography` usa una heurística local (`isLikelyBibliographyNode`) que solo detecta nodos ya formateados como "Autor, Título, Año". Si el documento curricular no tiene esos nodos (la mayoría no los tiene), la sección queda vacía.

Mientras tanto, `BibliographySelector` (usado en clases) ya resuelve esto: usa `extractBibliographyProtocolNodes` del protocolo compartido y, si no encuentra nada, invoca `repair-curriculum-bibliography` para reparsear el `raw_text` y generar los nodos faltantes.

### Solución

Alinear `PlanEditor` con la misma lógica que ya funciona en `BibliographySelector`:

**Archivo: `src/components/plan/PlanEditor.tsx`**

1. Importar `extractBibliographyProtocolNodes` desde `@/lib/bibliographyProtocol`
2. Reemplazar `fetchCurriculumBibliography` para:
   - Traer todos los nodos del documento curricular
   - Filtrarlos con `extractBibliographyProtocolNodes`
   - Si el resultado es vacío, invocar `repair-curriculum-bibliography` con el `courseId`
   - Tras la reparación, volver a consultar y filtrar
3. Eliminar las funciones locales `isLikelyBibliographyNode` y `isAuthorityOrNoiseNode` (ya cubiertas por el protocolo compartido)
4. Actualizar `visibleMappedNodes` para usar `shouldHideBibliographyNode` del protocolo en lugar de la heurística local eliminada

### Resultado

Cualquier materia con `raw_text` en su documento curricular mostrará bibliografía automáticamente, sin necesidad de insertar nodos manualmente por materia.

