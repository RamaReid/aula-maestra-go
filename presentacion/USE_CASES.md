# USE CASES

## Caso 1. Crear un curso con programa oficial

**Objetivo:** iniciar una materia con curriculum trazable.  
**Actor:** docente autenticado.

Flujo:

1. entra a `Nuevo curso`
2. completa escuela, ciclo, año y materia
3. resuelve el documento curricular
4. confirma horarios
5. crea el curso

Resultado esperado:

- curso persistido
- plan anual creado
- 28 clases base creadas

## Caso 2. Importar un diseño curricular faltante

**Objetivo:** incorporar un PDF que todavia no estaba verificado.  
**Actor:** docente autenticado.

Flujo:

1. entra a `Sincronizar ABC`
2. pega una URL oficial o sube un archivo
3. completa metadatos minimos
4. importa
5. selecciona el documento verificado para usarlo en un curso

Resultado esperado:

- nuevo `curriculum_document`
- nuevos `curriculum_nodes`

## Caso 3. Validar el plan anual

**Objetivo:** convertir el borrador en una planificacion utilizable.  
**Actor:** docente autenticado.

Flujo:

1. entra al curso
2. revisa fundamentacion, objetivos, bloques, rubricas y clases
3. ejecuta `Validar plan`

Resultado esperado:

- `plans.status = VALIDATED`
- queda habilitado el flujo normal de generacion

## Caso 4. Preparar una secuencia de clases

**Objetivo:** pedir materiales para varias clases.

Flujo:

1. desde el curso selecciona clases
2. la app valida las reglas segun el plan
3. ejecuta `generate-materials`

Resultado esperado:

- secuencia aceptada solo si cumple las reglas del plan

## Caso 5. Preparar una clase individual

**Objetivo:** producir materiales concretos para una clase.

Flujo:

1. abre una `lesson`
2. completa el brief
3. confirma bibliografia
4. genera materiales

Resultado esperado:

- material didactico guardado
- texto de lectura guardado

## Caso 6. Agregar fuentes propias del docente

**Objetivo:** enriquecer la generacion con material propio.

Flujo:

1. sube PDF, imagen, documento, planilla o texto
2. la app guarda el archivo en `authorized-sources`
3. `process-authorized-source` extrae texto
4. vincula la fuente a la leccion o secuencia

Resultado esperado:

- fuente procesada y disponible para el prompt

## Caso 7. Buscar recursos premium

**Objetivo:** sumar una fuente online concreta y aprobada.  
**Actor:** usuario `PREMIUM`.

Flujo:

1. formula una consulta concreta
2. `resolve-premium-query` devuelve candidatos
3. el docente aprueba uno
4. se crea la fuente autorizada

Resultado esperado:

- nuevo registro en `premium_query_requests`
- nueva `authorized_source`

## Caso 8. Exportar un PDF validado

**Objetivo:** obtener un material listo para compartir o imprimir.

Flujo:

1. entra a una lesson con lectura validada
2. usa las acciones de exportacion

Resultado esperado:

- descarga directa si el PDF esta persistido
- fallback si solo existe HTML o base64 temporal

## Caso 9. Cambiar de plan

**Objetivo:** ampliar capacidad de uso.

Flujo:

1. entra a `Billing`
2. inicia checkout
3. Mercado Pago redirige
4. webhook o reconciliacion actualiza estado

Resultado esperado:

- `subscriptions` sincronizada
- `user_entitlements` recalculado

## Caso 10. Cancelar una suscripcion automatica

**Objetivo:** detener renovacion administrada por Mercado Pago.

Flujo:

1. entra a `Billing`
2. ejecuta `Cancelar suscripcion`
3. la function actualiza el estado remoto y luego sincroniza localmente

Resultado esperado:

- suscripcion cancelada en proveedor y en la base
