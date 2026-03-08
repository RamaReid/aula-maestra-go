

## Plan: Reparación transversal de extracción curricular

### Diagnóstico

Hay **dos parsers divergentes** para extraer contenidos del raw_text:

1. **`curriculumImport.ts` → `extractCurriculumNodes()`**: Parser completo con jerarquía EJE/UNIDAD/BLOQUE/CONTENIDO, detección de bibliografía, merge de continuaciones. Usado en importación y en `repairCurriculumDocumentNodes()`.

2. **`repair-curriculum-nodes/index.ts` → `parseModulesFromRawText()`**: Parser alternativo simplificado que solo detecta "Módulo N" / "Unidad N" / "Bloque N", genera UNIDAD+CONTENIDO planos, sin EJE ni bibliografía. No reutiliza nada del shared.

El parser 2 es el problema: produce nodos sin jerarquía real, sin bibliografía, y con lógica de merge limitada.

### Cambios

#### 1. Eliminar parser duplicado en `repair-curriculum-nodes`

**Archivo: `supabase/functions/repair-curriculum-nodes/index.ts`**

- Eliminar `parseModulesFromRawText()` y `isTocLine()` locales (~120 líneas)
- Importar `repairCurriculumDocumentNodes` de `../_shared/curriculumImport.ts`
- Delegar toda la lógica al parser compartido, manteniendo la misma interfaz HTTP (auth, validación de ownership, response)

#### 2. Mejorar el parser compartido para contenidos robustos

**Archivo: `supabase/functions/_shared/curriculumImport.ts`**

Mejoras puntuales en `extractCurriculumNodes()`:

- **Merge de continuaciones en contenidos**: líneas que empiezan con minúscula tras un CONTENIDO deben concatenarse al nodo anterior (ya existe para bibliografía, falta para contenidos generales)
- **Detección de contenidos sin bullet**: líneas > 20 chars bajo una UNIDAD/BLOQUE que no son heading ni artifact deben registrarse como CONTENIDO (actualmente solo detecta líneas con bullet `•/-` o numeración `1.`)
- **Filtro de TOC mejorado**: excluir líneas con `...` seguido de número (ya está en repair-curriculum-nodes, falta en el shared)

#### 3. Bibliografía en planificación: ya resuelta, verificar paridad

**Archivo: `src/components/plan/PlanEditor.tsx`** — El cambio previo ya usa `extractBibliographyProtocolNodes` + auto-repair. Solo falta:

- Si el repair falla, mostrar "Requiere reparación curricular" con un botón manual que invoque `repair-curriculum-bibliography`
- No tocar la lógica de `BibliographySelector.tsx` (clases), ya funciona correctamente

#### 4. Frontend: estado explícito de reparación

**Archivo: `src/components/plan/PlanEditor.tsx`**

- En la pestaña Bibliografía, si `curriculumBibliographyNodes.length === 0` tras el auto-repair, mostrar un botón "Reparar bibliografía curricular" que reintente la invocación
- Agregar estado `bibliographyRepairStatus: 'idle' | 'repairing' | 'failed'`

### Archivos a modificar

| Archivo | Cambio |
|---|---|
| `supabase/functions/repair-curriculum-nodes/index.ts` | Reemplazar parser local por delegación al shared |
| `supabase/functions/_shared/curriculumImport.ts` | Mejorar merge de continuaciones + filtro TOC + contenidos sin bullet |
| `src/components/plan/PlanEditor.tsx` | Botón de reparación manual si auto-repair falla |

### Criterios de aceptación cubiertos

1. Nodos no cortados: merge de continuaciones en el parser compartido
2. Estructura jerárquica: un solo parser con EJE/UNIDAD/BLOQUE/CONTENIDO
3. Paridad bibliografía clases-planificación: mismo protocolo, mismo repair
4. Sin regresión: `repair-curriculum-nodes` delega al mismo `extractCurriculumNodes` que ya usa importación

