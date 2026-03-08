# PRD Lovable: ABC-Only Curriculum Source

## Objetivo

Forzar que todo el circuito curricular de PBA use exclusivamente `abc.gob.ar` como fuente oficial de diseños curriculares.

Esto aplica a:

- resolucion de documento curricular
- ingesta/importacion administrativa
- validacion de URLs oficiales
- persistencia de `curriculum_documents`
- mensajes de error y UI que dependen del backend Supabase

## Estado esperado

El sistema no debe aceptar:

- `servicios.abc.gov.ar`
- URLs externas aunque apunten a un PDF valido
- documentos curriculares manuales mezclados en la resolucion automatica global

El sistema si debe aceptar:

- URLs `https://abc.gob.ar/...`
- documentos ya resueltos o ingeridos desde `abc.gob.ar`
- reuso de `curriculum_documents` existentes que ya tengan `official_url` en `abc.gob.ar`
- PDFs manuales solo para planes `BASICO` y `PREMIUM`

## Cambios requeridos en Supabase / Lovable

### 1. Dominio oficial unico

Actualizar helpers compartidos para que la validacion de fuente oficial acepte solo:

- host exacto: `abc.gob.ar`

No aceptar:

- `servicios.abc.gov.ar`
- otros subdominios
- mirrors o repositorios externos

### 2. Resolve curriculum document

La function `resolve-curriculum-document` debe:

- consultar solo el indice principal de `abc.gob.ar`
- dejar de recorrer `servicios.abc.gov.ar`
- devolver `official_index_url` apuntando siempre al indice principal de ABC
- mantener la logica de `resolved`, `ambiguous` y `not_found`

### 3. Importacion administrativa

La function `import-curriculum-pdf` debe cambiar de contrato:

- `FREE` solo puede usar `official_url`
- `BASICO` y `PREMIUM` pueden usar `official_url` o `file_base64`
- la URL debe validar contra `abc.gob.ar`
- `allow_external_url` debe quedar en `false`

Mensajes sugeridos:

- `La carga manual de PDF requiere un plan BASICO o PREMIUM.`
- `Debe enviar file_base64 o official_url, ademas de subject, cycle y year_level`

### 4. Ingesta compartida

La logica compartida de `curriculumImport.ts` debe:

- aceptar `file_base64` solo cuando la function ya valido un plan pago
- descargar por URL solo desde `abc.gob.ar`
- persistir `source_provider = 'ABC_PBA_WEB'` para documentos por URL oficial
- persistir `source_provider = 'MANUAL_UPLOAD'` para PDFs manuales
- excluir `MANUAL_UPLOAD` de la resolucion automatica global

### 5. Remediacion de datos existentes

Lovable debe ejecutar una remediacion sobre `curriculum_documents`:

- detectar filas con `official_url` nula que no sean `MANUAL_UPLOAD`
- detectar filas con host distinto de `abc.gob.ar`
- detectar filas con `source_provider` manual/no oficial que hoy puedan filtrarse al resolver global

Resultado esperado:

- marcarlas como `DEPRECATED`, o
- excluirlas de toda resolucion automatica si no se quiere tocar historial

La resolucion futura no debe volver a ofrecer documentos manuales como candidatos automaticos.

### 6. UI dependiente del backend

Una vez desplegado el backend, la UI debe quedar consistente:

- `CourseNew` no debe ofrecer “Importar programa” como salida para documentos no resueltos
- `CurriculumImport` debe funcionar como sincronizacion administrativa por URL oficial de ABC y como importacion manual solo para planes pagos
- `Dashboard` puede conservar acceso administrativo, pero con copy de sincronizacion, no de carga manual

## Criterios de aceptacion

1. Una URL `https://abc.gob.ar/...pdf` se importa correctamente.
2. Una URL `https://servicios.abc.gov.ar/...pdf` es rechazada.
3. Un `file_base64` enviado a `import-curriculum-pdf` es rechazado para `FREE` y aceptado para `BASICO/PREMIUM`.
4. `resolve-curriculum-document` no usa ni devuelve enlaces de `servicios.abc.gov.ar`.
5. `curriculum_documents` nuevos por URL quedan con `source_provider = 'ABC_PBA_WEB'`.
6. `curriculum_documents` nuevos por PDF manual quedan con `source_provider = 'MANUAL_UPLOAD'`.
7. La resolucion automatica de curso solo usa documentos `ABC_PBA_WEB`.

## Deploy requerido por Lovable

Redeploy de:

- `resolve-curriculum-document`
- `import-curriculum-pdf`

Y cualquier function que consuma:

- `supabase/functions/_shared/curriculumCommon.ts`
- `supabase/functions/_shared/curriculumImport.ts`

## Riesgo operativo

Si ABC mueve PDFs a otro host oficial, el sistema fallara por diseño hasta actualizar el allowlist. Eso es aceptable: priorizamos trazabilidad y control de fuente antes que flexibilidad.
