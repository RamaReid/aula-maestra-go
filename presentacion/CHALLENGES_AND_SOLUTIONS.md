# CHALLENGES AND SOLUTIONS

## 1. Descarga de PDFs oficiales de ABC

**Problema:** los diseños oficiales no siempre se descargan bien desde edge functions Deno.  
**Evidencia:** existencia de `firecrawl-proxy-abc`, commits sobre Firecrawl y parsing PDF.

**Solucion implementada:**

- restriccion al dominio `abc.gob.ar`
- uso de Firecrawl como proxy de descarga
- parsing posterior del PDF con `pdfjs-serverless`

**Resultado:** el flujo curricular no depende de una sola estrategia de fetch.

## 2. Importacion curricular con documentos heterogeneos

**Problema:** los PDFs oficiales tienen ruido, tablas de contenido, encabezados y bibliografia poco limpia.

**Solucion implementada:**

- heuristicas de limpieza en `_shared/curriculumImport.ts`
- deteccion de headings, unidades, contenidos y bibliografia
- normalizacion por hash / metadatos
- repair de bibliografia curricular

## 3. Trazabilidad curricular demasiado tecnica para la UI

**Problema:** mostrar nodos crudos ensucia la experiencia docente.

**Solucion implementada:**

- el editor mantiene la trazabilidad
- la presenta como capa secundaria expandible

**Evidencia:** `.lovable/plan.md` y `PlanEditor.tsx`.

## 4. Reglas distintas segun plan

**Problema:** el producto necesita cambiar limites y capacidades sin duplicar toda la app.

**Solucion implementada:**

- tablas `subscriptions` y `user_entitlements`
- hook `useEntitlements`
- validaciones en frontend y backend
- recalculo por RPC y trigger

## 5. Generacion de materiales con control de calidad

**Problema:** no alcanza con pedir a la IA que escriba; la salida debe ser usable y consistente.

**Solucion implementada:**

- prompts distintos para plan, material didactico y lectura
- validaciones estructurales posteriores
- reintentos para lectura si falla validacion
- tracking de uso IA en `ai_usage_logs`

## 6. Incorporar fuentes propias del docente

**Problema:** los docentes usan PDFs, docs, planillas e imagenes, no solo bibliografia curricular.

**Solucion implementada:**

- bucket `authorized-sources`
- tabla `authorized_sources`
- extraccion de texto por tipo de archivo
- OCR por IA para imagenes
- vinculacion por lesson o sequence

## 7. Busqueda premium sin abrir la puerta a cualquier URL

**Problema:** una busqueda libre degrada calidad y control.

**Solucion implementada:**

- `resolve-premium-query` exige consultas concretas
- devuelve candidatos
- el docente aprueba uno
- luego recien se guarda como fuente autorizada

## 8. Billing con sincronizacion confiable

**Problema:** el estado del plan no puede depender solo del retorno al frontend.

**Solucion implementada:**

- checkout por edge function
- webhook con firma HMAC
- tabla `billing_events`
- reconciliacion manual
- cancelacion desde la app

## 9. Separar intencion de producto de estado real

**Problema:** en proyectos de hackathon es facil sobre-vender features no cerradas.

**Solucion aplicada en esta documentacion:**

- se documento solo lo presente en codigo, migraciones y functions
- cuando hay evidencia parcial o historica, se marca explicitamente

## Riesgos o caveats todavia visibles

- billing depende de secretos y configuracion externa
- no hay transcript completo de prompts de construccion
- algunas docs internas del repo reflejan estados historicos de cloud, no necesariamente el actual
