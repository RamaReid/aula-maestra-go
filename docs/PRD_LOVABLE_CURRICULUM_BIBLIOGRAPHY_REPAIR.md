# PRD Lovable: Reparacion de Bibliografia Curricular

## Objetivo

Verificar y corregir en Lovable/Supabase el circuito completo de bibliografia curricular para que:

- la bibliografia del diseno curricular se detecte desde documentos oficiales de `abc.gob.ar`
- los documentos viejos importados sin nodos bibliograficos puedan repararse
- el brief permita seleccionar bibliografia real del diseno
- `generate-materials` use solo bibliografia valida segun el protocolo actual

## Problema actual

Hoy existe un desacople entre:

1. el PDF oficial de ABC, que si contiene una seccion explicita `BIBLIOGRAFÍA`
2. algunos `curriculum_documents` historicos en cloud, que quedaron con `raw_text` pero sin nodos bibliograficos utilizables en `curriculum_nodes`
3. el selector del brief, que ya no acepta nodos de contenido como reemplazo de bibliografia

Resultado visible:

- el brief muestra `No se encontro bibliografia extraida del diseno curricular`
- no se puede confirmar relevamiento si no hay fuentes del docente
- la generacion queda bloqueada

## Evidencia de referencia

Documento oficial validado de ABC:

- indice oficial de disenos curriculares: `https://abc.gob.ar/secretarias/areas/subsecretaria-de-educacion/educacion-secundaria/educacion-secundaria/disenos-curriculares`
- PDF oficial de Filosofia: `https://abc.gob.ar/secretarias/sites/default/files/2021-05/Filosof%C3%ADa.pdf`

En ese PDF existe una seccion clara:

- `BIBLIOGRAFÍA`

y luego entradas bibliograficas reales, por ejemplo:

- `Arendt, Hannah, Qué es la política. Barcelona, Paidós, 1997.`
- `Cerletti, Alejandro, La enseñanza de la filosofía como problema filosófico. Buenos Aires, Libros del Zorzal, 2008.`

Mi inferencia a partir de esa evidencia es que el problema no es el PDF sino el parseo o la persistencia historica de nodos en cloud.

## Protocolo correcto de bibliografia

Una entrada debe considerarse bibliografia valida solo si cumple una de estas condiciones:

### Regla principal

Pertenece a la seccion bibliografica explicita del diseno curricular:

- `Bibliografía`
- `Fuentes bibliográficas`
- variantes equivalentes detectadas por normalizacion

### Regla de respaldo

Si el arbol no trae bien marcada esa seccion, solo se aceptan entradas con forma de cita real:

- autor o institucion identificable
- titulo de la obra
- y usualmente ano, editorial, edicion o datos equivalentes

### Regla negativa

No son bibliografia:

- `UNIDAD`
- `EJE`
- `BLOQUE`
- `CONTENIDO`
- temas, problemas o nodos curriculares del plan

## Estado esperado del sistema

### En frontend

- `BibliographySelector` debe mostrar solo bibliografia del documento curricular
- no debe mostrar nodos curriculares de contenido como fallback
- si el documento esta viejo y no tiene bibliografia persistida, debe intentar una reparacion automatica

### En backend

- `generate-materials` debe validar que las fuentes confirmadas pertenecen al protocolo bibliografico
- debe rechazar contenidos curriculares usados como si fueran bibliografia
- debe tolerar documentos reparados desde `raw_text`

### En datos

- `curriculum_documents.raw_text` debe ser suficiente para reparsear documentos viejos
- `curriculum_nodes` debe poder regenerarse desde `raw_text`
- los documentos reparados deben quedar consistentes para usos futuros

## Cambios que Lovable debe verificar y desplegar

### 1. Shared parser

Lovable debe confirmar que en cloud esta desplegada la version actual de:

- `supabase/functions/_shared/curriculumImport.ts`

Esa version debe:

- detectar heading de bibliografia
- extraer citas reales
- persistir nodos bibliograficos en `curriculum_nodes`

### 2. Nueva edge function de reparacion

Lovable debe desplegar:

- `repair-curriculum-bibliography`

Contrato esperado:

- input: `course_id`
- resuelve `curriculum_document_id` del curso del usuario autenticado
- toma `curriculum_documents.raw_text`
- reejecuta el parser curricular
- reemplaza `curriculum_nodes`
- devuelve:
  - `success`
  - `node_count`
  - `bibliography_count`

### 3. Selector del brief

Lovable debe confirmar que el frontend desplegado ya contiene:

- `src/components/lesson/BibliographySelector.tsx`
- `src/lib/bibliographyProtocol.ts`

Comportamiento esperado:

- si hay bibliografia persistida, la muestra
- si no hay, invoca `repair-curriculum-bibliography`
- luego recarga nodos y vuelve a intentar

### 4. Pantalla de leccion

Lovable debe confirmar que:

- `Lesson.tsx` ya no muestra `UNIDAD` o `CONTENIDO` como si fueran bibliografia confirmada
- solo renderiza nodos que pasen el protocolo bibliografico

### 5. Generacion de materiales

Lovable debe confirmar que `generate-materials` desplegada en cloud:

- valida bibliografia contra el protocolo real
- no usa `autor/titulo` como unica condicion
- no acepta nodos curriculares de contenido como bibliografia

## Verificaciones obligatorias

### V1. Documento oficial nuevo

1. importar o resolver un documento oficial de `abc.gob.ar`
2. abrir una clase del curso
3. verificar que el selector muestra bibliografia

### V2. Documento manual historico sin bibliografia persistida

1. usar un curso ya creado con documento `MANUAL_UPLOAD` o historico
2. abrir el brief
3. verificar que el selector invoca reparacion
4. verificar que luego aparecen entradas bibliograficas

### V3. Confirmacion de brief

1. seleccionar 1 a 5 entradas bibliograficas reales
2. confirmar relevamiento
3. verificar que el brief queda `READY_FOR_PRODUCTION`

### V4. Generacion

1. generar materiales con esas fuentes
2. verificar que no aparece el error:
   - `La bibliografia confirmada no contiene fuentes validas`
3. verificar que reading/teaching quedan persistidos

### V5. Regresion negativa

1. intentar usar nodos de contenido como si fueran bibliografia
2. verificar que el backend lo rechaza

## Consultas / evidencia que Lovable debe entregar

### Q1. Documento reparado

Para el `curriculum_document_id` del curso afectado:

- cantidad total de `curriculum_nodes`
- cantidad de nodos bibliograficos utilizables
- evidencia de que existe al menos una raiz `Bibliografía` o equivalente

### Q2. Function deploy

- SHA o version desplegada de:
  - `repair-curriculum-bibliography`
  - `generate-materials`
  - `_shared/curriculumImport.ts`

### Q3. Caso real

Lovable debe adjuntar evidencia de un caso real con:

- `course_id`
- `curriculum_document_id`
- `bibliography_count` antes
- `bibliography_count` despues

## Definition of Done

Este PRD se considera cumplido solo si:

1. un curso afectado hoy deja de mostrar `No se encontro bibliografia extraida del diseno curricular`
2. el brief vuelve a poder confirmarse con bibliografia real del diseno
3. `generate-materials` funciona con esas fuentes
4. los documentos viejos pueden repararse sin reimportacion manual
5. Lovable confirma deploy de la function nueva y de la version correcta de `generate-materials`

## Riesgos y notas

- si el entorno cloud no despliega automaticamente edge functions, el push en GitHub no alcanza
- si un documento historico no tiene `raw_text` usable, la reparacion automatica no va a funcionar y habra que reimportarlo
- si ABC cambia el formato del heading bibliografico, el parser debera ampliarse

## Relacion con otros documentos

Complementa:

- `docs/PRD_LOVABLE_ABC_ONLY_CURRICULUM.md`
- `docs/PRD_LOVABLE_SUPABASE_AI_AUDIT.md`

Orden recomendado:

1. verificar deploy de `repair-curriculum-bibliography`
2. verificar deploy de `generate-materials`
3. correr caso real sobre un curso afectado
4. remediar documentos historicos faltantes
