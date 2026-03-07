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
- PDFs subidos manualmente desde PC
- URLs externas aunque apunten a un PDF valido
- documentos curriculares persistidos con proveedor manual o dominio no oficial

El sistema si debe aceptar:

- URLs `https://abc.gob.ar/...`
- documentos ya resueltos o ingeridos desde `abc.gob.ar`
- reuso de `curriculum_documents` existentes que ya tengan `official_url` en `abc.gob.ar`

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

- `official_url` pasa a ser obligatorio
- `file_base64` debe rechazarse con error explicito
- la URL debe validar contra `abc.gob.ar`
- `allow_external_url` debe quedar en `false`

Mensaje sugerido:

`La carga manual de PDF fue deshabilitada. Usa solo URLs oficiales de abc.gob.ar.`

### 4. Ingesta compartida

La logica compartida de `curriculumImport.ts` debe:

- rechazar `file_base64`
- descargar solo desde `abc.gob.ar`
- persistir `source_provider = 'ABC_PBA_WEB'`
- dejar de producir `MANUAL_URL` o variantes equivalentes

### 5. Remediacion de datos existentes

Lovable debe ejecutar una remediacion sobre `curriculum_documents`:

- detectar filas con `official_url` nula
- detectar filas con host distinto de `abc.gob.ar`
- detectar filas con `source_provider` manual/no oficial

Resultado esperado:

- marcarlas como `DEPRECATED`, o
- excluirlas de toda resolucion automatica si no se quiere tocar historial

La resolucion futura no debe volver a ofrecer estos documentos como candidatos.

### 6. UI dependiente del backend

Una vez desplegado el backend, la UI debe quedar consistente:

- `CourseNew` no debe ofrecer “Importar programa” como salida para documentos no resueltos
- `CurriculumImport` debe funcionar como sincronizacion administrativa por URL oficial de ABC
- `Dashboard` puede conservar acceso administrativo, pero con copy de sincronizacion, no de carga manual

## Criterios de aceptacion

1. Una URL `https://abc.gob.ar/...pdf` se importa correctamente.
2. Una URL `https://servicios.abc.gov.ar/...pdf` es rechazada.
3. Un `file_base64` enviado a `import-curriculum-pdf` es rechazado.
4. `resolve-curriculum-document` no usa ni devuelve enlaces de `servicios.abc.gov.ar`.
5. `curriculum_documents` nuevos quedan con `source_provider = 'ABC_PBA_WEB'`.
6. Un curso nuevo solo puede vincularse a documentos resueltos desde la base oficial ABC.

## Deploy requerido por Lovable

Redeploy de:

- `resolve-curriculum-document`
- `import-curriculum-pdf`

Y cualquier function que consuma:

- `supabase/functions/_shared/curriculumCommon.ts`
- `supabase/functions/_shared/curriculumImport.ts`

## Riesgo operativo

Si ABC mueve PDFs a otro host oficial, el sistema fallara por diseño hasta actualizar el allowlist. Eso es aceptable: priorizamos trazabilidad y control de fuente antes que flexibilidad.
