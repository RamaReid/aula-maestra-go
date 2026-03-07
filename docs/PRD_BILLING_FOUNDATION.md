# PRD Billing Foundation

Fecha de referencia: 2026-03-07

## 1. Objetivo

Agregar una capa de billing real sobre el modelo existente de planes (`FREE`, `BASICO`, `PREMIUM`) sin romper el flujo pedagogico principal.

El objetivo no es solo cobrar. El objetivo es que el upgrade, la renovacion, la cancelacion y las vias de pago alternativas impacten de forma consistente en:

- `subscriptions`
- `user_entitlements`
- UX de planes dentro de la app
- soporte operativo

## 2. Estado actual

La aplicacion ya tiene:

- tabla `subscriptions`
- tabla `user_entitlements`
- tabla `usage_counters`
- gating funcional por plan en frontend y edge functions

La aplicacion todavia no tiene:

- checkout automatico
- webhook de proveedor
- reconciliacion de pagos
- cancelacion al fin de periodo
- pagos manuales o institucionales con trazabilidad
- pagina de facturacion para el usuario

## 3. Decision de producto

### Canal principal recomendado

Para el mercado actual de Argentina, el canal principal recomendado es `Mercado Pago`.

Motivos:

- menor friccion local
- mejor adopcion para docentes y familias de pago comunes en Argentina
- habilita suscripciones y tambien links de pago puntuales

### Canales alternativos requeridos

No alcanza con un checkout self-serve. Deben existir vias alternativas:

1. `Transferencia / manual`
   - para docentes que prefieren coordinacion directa
   - para colegios que requieren aprobacion administrativa

2. `Institucional`
   - alta manual por factura, orden de compra o transferencia
   - puede terminar en el mismo modelo de `subscriptions`, pero con `provider = MANUAL`

3. `Anual prepago`
   - puede resolverse por link de pago o activacion manual
   - reduce churn y evita friccion mensual

## 4. Flujo esperado

### F1. Upgrade self-serve

1. El usuario abre `Billing`.
2. Elige `BASICO` o `PREMIUM`.
3. La app invoca `create-checkout`.
4. El proveedor completa el cobro.
5. El proveedor emite webhook a `billing-webhook`.
6. El backend actualiza `subscriptions`.
7. El backend recalcula `user_entitlements`.
8. La app refleja el nuevo plan sin intervencion manual.

### F2. Cancelacion al fin de periodo

1. El usuario solicita cancelacion.
2. La suscripcion queda `ACTIVE` con `cancel_at_period_end = true`.
3. El usuario mantiene beneficios hasta `current_period_end`.
4. Cuando vence el periodo, el backend marca `EXPIRED`.
5. Los entitlements vuelven a `FREE`.

### F3. Pago manual o institucional

1. El usuario deja una solicitud desde `Billing`.
2. Se crea `manual_payment_requests`.
3. Soporte revisa el caso.
4. Si se aprueba, un operador o webhook administrativo actualiza `subscriptions`.
5. Los entitlements se recalculan.

### F4. Pago rechazado o vencido

1. El proveedor informa fallo de cobro o vencimiento.
2. El sistema persiste el evento en `billing_events`.
3. Si el estado final implica perdida de acceso, la suscripcion pasa a `EXPIRED`.
4. La app vuelve a `FREE` y deja trazabilidad para soporte.

## 5. Modelo de datos

### `subscriptions`

Se mantiene como tabla principal de estado actual del usuario y se extiende con:

- `provider`
- `provider_customer_id`
- `provider_subscription_id`
- `provider_plan_id`
- `billing_email`
- `current_period_start`
- `current_period_end`
- `cancel_at_period_end`
- `last_payment_status`
- `last_payment_at`
- `last_invoice_url`
- `metadata`

### `billing_events`

Tabla append-only para auditoria y debugging.

Debe guardar:

- proveedor
- id de evento externo
- tipo de evento
- payload recibido
- estado de procesamiento
- error si hubo fallo

### `manual_payment_requests`

Tabla para solicitudes no automaticas.

Debe guardar:

- usuario
- plan solicitado
- datos de facturacion basicos
- notas
- estado de revision
- observaciones administrativas

## 6. Regla critica de entitlements

El sistema actual recalcula entitlements solo cuando cambia `plan_type`.

Eso es insuficiente para billing real.

Nueva regla:

- si `subscriptions.status = ACTIVE`, los entitlements siguen el `plan_type`
- si `subscriptions.status != ACTIVE`, los entitlements vuelven a `FREE`

Casos especiales:

- `cancel_at_period_end = true` no baja beneficios por si solo
- la baja ocurre cuando la suscripcion deja de estar `ACTIVE`

## 7. Funciones backend requeridas

### Fase 1

- `admin_upsert_billing_subscription`
  - sincroniza `subscriptions` desde webhook u operacion administrativa
  - recalcula entitlements

- `billing-webhook`
  - valida firma
  - persiste `billing_events`
  - normaliza estado del proveedor al estado interno
  - llama a `admin_upsert_billing_subscription`

- `create-checkout`
  - crea checkout para `BASICO` o `PREMIUM`
  - persiste metadata minima para correlacion

### Secretos y configuracion minima

- `MERCADO_PAGO_ACCESS_TOKEN`
- `MERCADO_PAGO_WEBHOOK_SECRET`
- `MERCADO_PAGO_BASICO_PRICE_ARS`
- `MERCADO_PAGO_PREMIUM_PRICE_ARS`
- `MERCADO_PAGO_CURRENCY_ID` opcional, por defecto `ARS`
- `MERCADO_PAGO_REASON_PREFIX` opcional
- `APP_BASE_URL`

### Fase 2

- `cancel-subscription`
- `resume-subscription`
- `expire-past-due-subscriptions`
- `approve-manual-payment`

## 8. UX minima

La pantalla `Billing` debe mostrar:

- plan actual
- estado de suscripcion
- limites operativos actuales
- comparativa resumida entre planes
- CTA para upgrade
- CTA o formulario para pago alternativo
- historial basico de solicitudes manuales

## 9. Criterios de aceptacion

### A1. Upgrade

- Un usuario `FREE` puede iniciar upgrade a `BASICO` o `PREMIUM`.
- Cuando el pago se confirma, la app refleja el nuevo plan.

### A2. Cancelacion

- La cancelacion no corta acceso antes del fin de periodo.
- Al vencer el periodo, el usuario vuelve a `FREE`.

### A3. Manual

- El usuario puede solicitar activacion manual desde la app.
- Soporte puede revisar la solicitud con trazabilidad.

### A4. Auditoria

- Todo webhook recibido queda registrado.
- Si falla el procesamiento, queda error persistido.

### A5. Coherencia

- `subscriptions` y `user_entitlements` no pueden quedar desalineadas de forma silenciosa.

## 10. Riesgos abiertos

- Falta definir catalogo comercial final de precios.
- La integracion con proveedor requiere secretos y webhook validation.
- La diferencia visible entre `BASICO` y `PREMIUM` todavia debe reforzarse en producto.
- Los tipos generados de Supabase quedaran desactualizados hasta regenerarlos tras aplicar migraciones.
