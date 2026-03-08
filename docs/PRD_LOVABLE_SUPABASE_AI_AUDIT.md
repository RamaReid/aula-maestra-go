# PRD Lovable: Auditoria Supabase + IA

## 1. Objetivo

Verificar que el entorno Lovable conectado a Supabase ejecute exactamente lo que este repo espera en:

- schema y migraciones
- edge functions
- secretos y red
- storage y auth
- uso real de IA
- contratos de runtime entre frontend, DB y functions

Este PRD no pide features nuevas. Pide evidencia, alineacion y correcciones de entorno para evitar que el repo local y Lovable diverjan.

## 2. Contexto

El repo ya fue saneado localmente:

- `lint` sin errores
- `build` ok
- `test` ok

Por lo tanto, el siguiente riesgo principal ya no es el codigo local sino el desacople entre:

1. lo que el repo implementa
2. lo que Lovable tiene desplegado
3. lo que Supabase realmente expone en cloud

## 3. Alcance

Incluye:

- Supabase DB
- edge functions desplegadas
- variables y secretos
- buckets y politicas
- integracion con `ai.gateway.lovable.dev`
- integracion con Mercado Pago
- observabilidad minima

No incluye:

- rediseno UX
- cambios de pricing
- nuevas features pedagogicas

## 4. Inventario esperado por el repo

### 4.1 Edge functions esperadas

Lovable debe confirmar deploy, version activa y fecha de despliegue de:

- `billing-webhook`
- `bootstrap-course-plan`
- `cancel-subscription`
- `check-course-limit`
- `create-checkout`
- `generate-materials`
- `import-curriculum-pdf`
- `process-authorized-source`
- `reconcile-billing`
- `resolve-curriculum-document`
- `resolve-premium-query`
- `set-test-plan`

### 4.2 Secretos y variables esperadas

Lovable debe confirmar presencia y validez de:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `LOVABLE_API_KEY`
- `APP_BASE_URL`
- `MERCADO_PAGO_ACCESS_TOKEN`
- `MERCADO_PAGO_WEBHOOK_SECRET`
- `MERCADO_PAGO_BASICO_PRICE_ARS`
- `MERCADO_PAGO_PREMIUM_PRICE_ARS`

Opcionales usados por billing:

- `MERCADO_PAGO_CURRENCY_ID`
- `MERCADO_PAGO_REASON_PREFIX`

### 4.3 Conectividad saliente esperada

Lovable debe poder salir a:

- `https://abc.gob.ar`
- `https://ai.gateway.lovable.dev`
- `https://api.mercadopago.com`

### 4.4 Buckets / storage esperados

Lovable debe confirmar existencia y permisos de:

- `authorized-sources`
- `reading-materials-pdf`

## 5. Contratos funcionales que deben validarse

### C1. Curricular

El repo espera que:

- `resolve-curriculum-document` use solo `abc.gob.ar` como fuente oficial
- `FREE` solo use URL oficial
- `BASICO` y `PREMIUM` permitan URL oficial o PDF manual
- `MANUAL_UPLOAD` no contamine la resolucion automatica global
- `courses.curriculum_document_id` exista y este sincronizado con runtime

### C2. Plan anual

El repo espera que:

- `bootstrap-course-plan` pueda rearmar plan y mappings
- `validate_plan` opere sobre schema actualizado
- los estados `INCOMPLETE`, `EDITED`, `VALIDATED` se preserven

### C3. Brief y fuentes

El repo espera que:

- `lesson_briefs` soporte `authorized_source_ids`
- `authorized_sources`, `authorized_source_targets` y `premium_query_requests` existan y respondan
- `process-authorized-source` y `resolve-premium-query` esten alineadas con el frontend actual

### C4. Generacion IA

El repo espera que:

- `generate-materials` reciba contexto de `school_type`, `orientation` y `speciality`
- teaching y reading se generen desde el mismo entorno IA de Lovable
- la function pueda usar herramientas / tool calling
- se persistan estados `VALIDATED` o `INVALIDATED` segun validacion estructural

### C5. Billing

El repo espera que:

- `subscriptions`, `billing_events` y `manual_payment_requests` existan en cloud
- `create-checkout`, `billing-webhook`, `cancel-subscription` y `reconcile-billing` esten desplegadas juntas
- Mercado Pago pueda redirigir a `APP_BASE_URL`

## 6. Preguntas que Lovable debe responder

### Q1. Schema real

- Que migraciones estan aplicadas hoy por entorno.
- Si existe alguna migracion pendiente respecto de este repo.
- Si PostgREST ya refresco cache despues de las ultimas migraciones.

### Q2. Functions reales

- Que commit o SHA corresponde al deploy actual de cada function.
- Si todas las functions core vienen del mismo SHA o hay mezcla de versiones.
- Si existe alguna function vieja aun publicada con contrato incompatible.

### Q3. Tipos y tablas

- Si el schema cloud ya incluye `authorized_sources`, `authorized_source_targets`, `premium_query_requests`, `billing_events`, `manual_payment_requests` y los campos nuevos de `subscriptions`.
- Si `lesson_briefs.authorized_source_ids` existe en cloud.
- Si `courses.curriculum_document_id` existe y esta operativo.

### Q4. IA

- Que proveedor/modelo usa realmente Lovable para `generate-materials`, `bootstrap-course-plan` y `process-authorized-source`.
- Si el runtime soporta function calling/tool calling en el formato que usa el repo.
- Si hay limites de tokens, rate limit o timeouts distintos por entorno.
- Si existen logs de prompt/request id y de respuesta truncada o fallida.

### Q5. Storage y archivos

- Si los buckets existen en todos los entornos.
- Si las politicas permiten upload y lectura segun lo que usan las functions.
- Si hay limites de tamano efectivos distintos de los asumidos en el repo.

### Q6. Billing

- Si Mercado Pago webhook ya esta configurado y con que URL.
- Si el secret coincide con `MERCADO_PAGO_WEBHOOK_SECRET`.
- Si sandbox y produccion estan separados o mezclados.

## 7. Evidencia pedida a Lovable

Lovable debe entregar:

1. lista de migraciones aplicadas por entorno
2. listado de functions desplegadas con SHA o referencia de release
3. tabla de secretos cargados, sin valores pero con estado presente/ausente
4. evidencia de reachability a `abc.gob.ar`, `ai.gateway.lovable.dev` y Mercado Pago
5. listado de buckets y politicas activas
6. smoke test de:
   - resolver curriculum
   - importar curriculum
   - bootstrap plan
   - generar materiales
   - aprobar fuente del docente
   - busqueda premium
   - checkout y webhook de billing
7. logs o request ids de al menos un caso exitoso y uno fallido por function core

## 8. Casos de prueba obligatorios

### T1. Curricular oficial

- resolver documento de PBA desde `abc.gob.ar`
- crear curso
- persistir `curriculum_document_id`

### T2. Manual pago

- usuario `BASICO` o `PREMIUM`
- importar PDF manual
- verificar `source_provider = MANUAL_UPLOAD`
- confirmar que ese documento no aparece en resolucion automatica global

### T3. Bootstrap + validacion

- reconstruir plan
- validar plan
- confirmar lecciones y mappings

### T4. Generacion

- brief listo con bibliografia
- opcion con fuentes del docente
- generar teaching y reading
- verificar trazabilidad y estados persistidos

### T5. Premium query

- resolver consulta
- aprobar candidato
- persistir fuente aprobada y request premium

### T6. Billing

- iniciar checkout
- recibir webhook
- reconciliar
- cancelar
- recalcular entitlements

## 9. Definition of Done

Este PRD se considera cumplido solo si:

1. no hay diferencias no explicadas entre schema del repo y schema cloud
2. no hay functions core desalineadas en version
3. no faltan secretos obligatorios
4. Lovable confirma el contrato real de IA y sus limites
5. los casos T1-T6 tienen evidencia ejecutada
6. cualquier gap pendiente queda documentado con owner y fecha

## 10. Riesgos que deben quedar explicitados

- functions desplegadas desde commits distintos
- schema parcial respecto del repo
- soporte incompleto de tool calling
- secretos presentes pero invalidos
- buckets sin politicas correctas
- billing sandbox mezclado con produccion
- prompts o modelos distintos entre local y cloud

## 11. Salida esperada despues de esta auditoria

Al cerrar esta auditoria, debemos poder responder con precision:

1. que parte del sistema depende del repo y que parte depende de Lovable
2. que falta corregir en cloud para igualar el comportamiento local
3. que datos o contratos siguen siendo inciertos
4. que PRD o runbook operativo sigue despues

## 12. Relacion con otros documentos

Este documento complementa:

- `docs/PRD_LOVABLE_ENV_BASE.md`
- `docs/PRD_LOVABLE_CORE_FLOW.md`
- `docs/PRD_LOVABLE_ABC_ONLY_CURRICULUM.md`
- `docs/PRD_BILLING_FOUNDATION.md`
- `docs/BILLING_DEPLOY_RUNBOOK.md`

Orden recomendado:

1. entorno base
2. auditoria Supabase + IA (este documento)
3. core flow
4. billing deploy
