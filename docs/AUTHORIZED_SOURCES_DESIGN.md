# Diseno de Fuentes Autorizadas

Fecha de referencia: 2026-03-06

## Objetivo

Separar con claridad:

- fuentes curriculares base
- fuentes incorporadas por el docente
- permisos por plan
- alcance real de cada fuente en la generacion de entregables

Este diseno busca que `generate-materials` consuma solo un universo cerrado y trazable de fuentes autorizadas.

## Regla de negocio

- La planificacion anual del curso se genera una vez y queda persistida.
- Las clases y secuencias derivan de esa planificacion.
- La generacion de materiales no debe volver a buscar el diseno curricular.
- La bibliografia y las fuentes de apoyo pueden ampliarse segun el plan.
- Toda fuente nueva debe quedar procesada y persistida antes de ser usada en prompts o entregables.

## Capacidades por plan

### FREE

- Usa fuentes curriculares base ya procesadas.
- No agrega fuentes nuevas del docente.
- No hace busqueda externa.

### BASICO

- Usa fuentes curriculares base ya procesadas.
- Puede agregar fuentes del docente por archivo.
- Formatos iniciales:
  - `PDF`
  - `JPG`
  - `JPEG`
  - `PNG`
- Las fuentes agregadas quedan ligadas a una clase o secuencia.
- No hace busqueda libre en internet.

### PREMIUM

- Incluye todo lo de `BASICO`.
- Puede agregar fuentes del docente por:
  - archivo
  - URL
  - video
  - busqueda asistida en internet
- Toda recuperacion externa debe quedar restringida por:
  - materia
  - curso
  - planificacion
  - foco pedido por el docente
- Las consultas externas las inicia siempre el docente.
- No se aceptan pedidos abiertos como "buscar informacion sobre X".
- La consulta debe apuntar a un dato concreto, recurso concreto o referente concreto.

## Modelo de datos propuesto

### Tabla `authorized_sources`

- `id uuid primary key`
- `course_id uuid not null`
- `created_by uuid not null`
- `origin_type text not null`
- `plan_scope text not null`
- `media_type text not null`
- `title text not null`
- `author_label text null`
- `source_url text null`
- `storage_path text null`
- `mime_type text null`
- `status text not null`
- `processing_error text null`
- `extracted_text text null`
- `summary_text text null`
- `metadata jsonb not null default '{}'::jsonb`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Valores sugeridos:

- `origin_type`
  - `CURRICULAR`
  - `DOCENTE_ARCHIVO`
  - `DOCENTE_URL`
  - `DOCENTE_VIDEO`
  - `BUSQUEDA_PREMIUM`
- `plan_scope`
  - `FREE`
  - `BASICO`
  - `PREMIUM`
- `media_type`
  - `PDF`
  - `IMAGE`
  - `URL`
  - `VIDEO`
  - `TEXT`
- `status`
  - `PENDING`
  - `PROCESSING`
  - `PROCESSED`
  - `FAILED`
  - `APPROVED`
  - `REJECTED`

### Tabla `authorized_source_targets`

- `id uuid primary key`
- `source_id uuid not null`
- `target_type text not null`
- `lesson_id uuid null`
- `sequence_key text null`
- `created_at timestamptz not null default now()`

Valores sugeridos:

- `target_type`
  - `LESSON`
  - `SEQUENCE`

Reglas:

- una fuente puede apuntar a una clase puntual
- una fuente puede apuntar a una secuencia
- no debe quedar global a todo el sistema
- una secuencia debe pertenecer a una misma unidad o bloque

### Tabla opcional `authorized_source_usages`

Sirve para trazabilidad fina del entregable.

- `id uuid primary key`
- `source_id uuid not null`
- `lesson_id uuid not null`
- `material_type text not null`
- `used_at timestamptz not null default now()`
- `evidence jsonb not null default '{}'::jsonb`

## Reglas de autorizacion

- `CURRICULAR` se crea al importar/procesar el documento curricular.
- `DOCENTE_ARCHIVO` solo se permite en `BASICO` y `PREMIUM`.
- `DOCENTE_URL`, `DOCENTE_VIDEO` y `BUSQUEDA_PREMIUM` solo se permiten en `PREMIUM`.
- `generate-materials` solo puede usar fuentes:
  - del mismo `course_id`
  - con `status in ('PROCESSED', 'APPROVED')`
  - vinculadas a la clase o secuencia actual

## Procesamiento por tipo

### Curricular

- ya viene del documento curricular procesado
- se mapea como fuente base
- no requiere ingestion adicional

### Archivo docente

- se sube a storage
- se extrae texto
- si es imagen, se aplica OCR
- se persiste `extracted_text`
- luego pasa a `PROCESSED`

### URL

- solo `PREMIUM`
- se descarga el contenido permitido
- se limpia y normaliza
- se persiste `extracted_text`
- luego pasa a `PROCESSED`

### Video

- solo `PREMIUM`
- se recupera transcript o metadata util
- se persiste texto usable
- luego pasa a `PROCESSED`

### Busqueda premium

- solo `PREMIUM`
- el usuario define foco concreto
- el sistema busca con filtros de materia/curso/planificacion
- la fuente elegida se persiste como `BUSQUEDA_PREMIUM`
- la incorporacion final requiere aprobacion explicita del docente

### Tolerancia de consulta concreta

- normalizar texto de consulta (acentos, mayusculas, simbolos)
- tolerar errores tipograficos en autor, canal o titulo
- aplicar matching difuso con umbrales de confianza
- priorizar coincidencias compatibles con materia, unidad y curso
- comportamiento por nivel de confianza:
  - alta: proponer resultado principal
  - media: devolver hasta 3 opciones para eleccion docente
  - baja: rechazar y pedir reformulacion

## Integracion con el brief

El brief no deberia guardar solo `curriculum_node_id[]`.

Opcion recomendada:

- mantener `bibliografia_confirmada` para compatibilidad temporal
- agregar `authorized_source_ids uuid[]`

Transicion:

1. seguir mostrando nodos curriculares actuales
2. sumar fuentes autorizadas del docente en el selector
3. hacer que `generate-materials` resuelva ambos universos
4. luego migrar a una unica seleccion de `authorized_sources`

## Integracion con `generate-materials`

`generate-materials` debe:

1. cargar la clase o secuencia
2. cargar el brief
3. resolver fuentes autorizadas para ese alcance
4. bloquear si alguna fuente requerida no esta procesada
5. construir prompt solo con:
   - planificacion
   - nodos curriculares
   - bibliografia confirmada
   - fuentes autorizadas procesadas
6. persistir que fuentes participaron del entregable

## Validaciones backend minimas

- verificar que los IDs del brief pertenezcan al `course_id`
- verificar que la fuente este habilitada para el plan del usuario
- verificar que la fuente este ligada a esa clase o secuencia
- verificar que la secuencia pertenezca a una misma unidad
- bloquear fuentes `FAILED`, `PENDING` o `PROCESSING`

## Cambios de UI propuestos

### BASICO

- boton `Adjuntar fuente`
- carga de `PDF` o imagen
- lista de fuentes procesadas para esa clase o secuencia
- seleccion para incluirlas en el brief

### PREMIUM

- todo lo de `BASICO`
- tabs adicionales:
  - `URL`
  - `Video`
  - `Busqueda`

## Orden recomendado de implementacion

1. Crear tablas `authorized_sources` y `authorized_source_targets`.
2. Agregar ingestion de archivos para `BASICO`.
3. Integrar selector mixto en el brief.
4. Endurecer `generate-materials` para universo cerrado por curso y alcance.
5. Agregar fuentes online y busqueda asistida para `PREMIUM`.

## Riesgos a evitar

- mezclar nodos curriculares con fuentes docentes en la misma tabla sin distinguir origen
- permitir fuentes sin alcance claro
- usar archivos sin texto procesado persistido
- permitir a `generate-materials` IDs arbitrarios fuera del curso
- habilitar busqueda premium sin restricciones de foco y trazabilidad
