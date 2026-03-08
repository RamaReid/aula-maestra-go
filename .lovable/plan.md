

# Plan: Limpiar nodos de índice desde la app (sin script manual)

## Problema
El script `import-curriculum-pdfs.mjs` requiere ejecución local con Node.js y acceso al service role key. Eso no es práctico para el usuario.

## Solución
Crear una backend function que re-procese los `curriculum_nodes` existentes directamente en la base de datos:

1. **Nueva edge function `repair-curriculum-nodes`**: 
   - Lee el `raw_text` de cada `curriculum_document`
   - Detecta y elimina nodos que son entradas de índice (contienen `...` + número de página)
   - Re-extrae los módulos reales del `raw_text` (buscando patrones como `Módulo 1`, `MÓDULO 1`, seguidos de contenido real)
   - Reemplaza los nodos viejos con los nuevos

2. **Botón en la UI** (pestaña Contenidos del PlanEditor): 
   - Cuando los contenidos parecen ser de índice (detectando `....` en los nombres), mostrar un aviso con botón "Corregir contenidos del programa"
   - Al hacer clic, invoca la edge function y recarga

## Archivos a crear/modificar

| Archivo | Cambio |
|---|---|
| `supabase/functions/repair-curriculum-nodes/index.ts` | Nueva function que limpia nodos de índice y re-extrae módulos reales del raw_text |
| `src/components/plan/PlanEditor.tsx` | Botón de corrección en pestaña Contenidos cuando se detectan nodos de índice |

## Detección de nodos de índice
Un nodo se considera "de índice" si su `name` contiene `\.{3,}` (3+ puntos seguidos) o el patrón `... número`.

## Extracción de módulos reales
La function buscará en `raw_text` patrones como:
- `Módulo N` o `MÓDULO N` seguido de texto que no sea puntos suspendidos
- Bullets (`•`, `-`) como sub-contenidos del módulo
- Secciones hasta el siguiente módulo o fin de documento

