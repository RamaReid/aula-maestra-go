# Billing Deploy Runbook

Fecha de referencia: 2026-03-07

## 1. Estado actual del repo

Implementado en codigo:

- migracion base de billing
- checkout self-serve con Mercado Pago
- webhook de sincronizacion
- pantalla `Billing`
- solicitudes manuales de upgrade

No implementado todavia:

- cancelacion desde la app
- cancelacion al fin de periodo automatizada
- reanudacion
- cron de reconciliacion periodica
- UI admin para aprobar solicitudes manuales

## 2. Alcance de este runbook

Este runbook deja el billing operativo en sandbox o produccion con:

- upgrade `FREE -> BASICO`
- upgrade `FREE -> PREMIUM`
- upgrade `BASICO -> PREMIUM`
- sincronizacion por webhook
- trazabilidad en `billing_events`

No cubre todavia baja automatizada al fin de periodo.

## 3. Archivos implicados

- `supabase/migrations/20260307113000_add_billing_foundation.sql`
- `supabase/functions/_shared/billingCommon.ts`
- `supabase/functions/create-checkout/index.ts`
- `supabase/functions/billing-webhook/index.ts`
- `src/pages/Billing.tsx`

## 4. Precondiciones

Antes de deploy:

1. Confirmar que el proyecto Supabase correcto este linkeado.
2. Confirmar que el dominio de app final este definido para `APP_BASE_URL`.
3. Confirmar que la cuenta de Mercado Pago tenga:
   - credenciales sandbox o produccion
   - webhook secret
   - capacidad para `preapproval`
4. Confirmar que el ambiente tenga HTTPS.

## 5. Secretos y variables requeridas

### Supabase Edge Functions

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `APP_BASE_URL`
- `MERCADO_PAGO_ACCESS_TOKEN`
- `MERCADO_PAGO_WEBHOOK_SECRET`
- `MERCADO_PAGO_BASICO_PRICE_ARS`
- `MERCADO_PAGO_PREMIUM_PRICE_ARS`

Opcionales:

- `MERCADO_PAGO_CURRENCY_ID`
- `MERCADO_PAGO_REASON_PREFIX`

## 6. Orden correcto de salida

### Paso 1. Aplicar migracion

Aplicar:

- `supabase/migrations/20260307113000_add_billing_foundation.sql`

Validar luego:

- existen columnas nuevas en `subscriptions`
- existe `billing_events`
- existe `manual_payment_requests`
- existe la funcion `admin_upsert_billing_subscription`

### Paso 2. Cargar secretos

Cargar todos los secretos listados arriba.

Validar especialmente:

- `APP_BASE_URL` apunta al frontend real
- `MERCADO_PAGO_ACCESS_TOKEN` corresponde al ambiente elegido
- `MERCADO_PAGO_WEBHOOK_SECRET` coincide exactamente con el configurado en Mercado Pago
- precios numericos validos

### Paso 3. Deploy de functions

Deploy minimo:

- `create-checkout`
- `billing-webhook`

Recomendacion:

- deployar ambas desde el mismo commit

### Paso 4. Configurar webhook en Mercado Pago

Configurar la URL final:

- `https://<SUPABASE_PROJECT>.functions.supabase.co/billing-webhook`

Validar:

- notificaciones habilitadas para suscripciones/preapproval
- firma habilitada
- secret alineado con `MERCADO_PAGO_WEBHOOK_SECRET`

### Paso 5. Smoke test en app

Desde un usuario real de prueba:

1. abrir `/billing`
2. iniciar checkout `BASICO`
3. completar suscripcion sandbox
4. volver a la app
5. esperar webhook
6. confirmar upgrade visible en dashboard y billing

## 7. Checklist de validacion tecnica

### DB

- `subscriptions.provider` existe
- `subscriptions.provider_subscription_id` se completa despues del webhook
- `subscriptions.status` cambia a `ACTIVE` cuando corresponde
- `user_entitlements` refleja el plan sincronizado

### Webhook

- cada notificacion entra en `billing_events`
- el evento queda en `PROCESSED`, `IGNORED` o `FAILED`
- nunca queda silenciosamente sin registro

### UI

- `Billing` abre
- el CTA de checkout redirige a Mercado Pago
- al volver, la app no rompe aunque la confirmacion tarde
- la solicitud manual sigue funcionando

## 8. Consultas utiles para soporte

### Ultimos eventos de billing

```sql
select id, provider, event_type, provider_event_id, status, error_message, created_at
from public.billing_events
order by created_at desc
limit 20;
```

### Estado de una suscripcion por usuario

```sql
select user_id, plan_type, status, provider, provider_subscription_id, current_period_end, cancel_at_period_end, updated_at
from public.subscriptions
where user_id = '<USER_ID>';
```

### Entitlements efectivos

```sql
select user_id, max_courses, max_weekly_sessions, max_classes_per_session, persistent_storage_enabled, copiloto_mode
from public.user_entitlements
where user_id = '<USER_ID>';
```

### Solicitudes manuales

```sql
select id, user_id, requested_plan, status, billing_name, tax_id, created_at
from public.manual_payment_requests
order by created_at desc
limit 20;
```

## 9. UAT sandbox minimo

### Caso B1. Upgrade a BASICO

- usuario `FREE`
- inicia checkout
- Mercado Pago devuelve `init_point`
- webhook procesa preapproval
- `subscriptions.plan_type = BASICO`
- `subscriptions.status = ACTIVE`
- `user_entitlements.max_courses = 15`

### Caso B2. Upgrade a PREMIUM

- usuario `FREE` o `BASICO`
- inicia checkout
- webhook procesa preapproval
- `subscriptions.plan_type = PREMIUM`
- `copiloto_mode = full`

### Caso B3. Solicitud manual

- usuario crea solicitud manual
- aparece en `manual_payment_requests`
- la UI la lista correctamente

### Caso B4. Firma invalida

- enviar webhook con firma incorrecta
- respuesta `401`
- no se sincroniza la suscripcion

### Caso B5. Evento no soportado

- entra webhook con topic no relacionado a suscripciones
- queda auditado como `IGNORED`

## 10. Riesgos y gaps operativos

### G1. Cancelacion al fin de periodo

Gap actual:

- el repo no implementa aun baja automatica al fin de periodo
- Mercado Pago debe revisarse con cuidado para no prometer un comportamiento que el flujo actual no materializa

Decision operativa recomendada por ahora:

- no exponer boton de cancelacion automatica en la app
- resolver bajas manualmente desde soporte hasta implementar el flujo completo

### G2. Reconciliacion

Gap actual:

- si un webhook externo falla y no reintenta, no existe aun job periodico de reconciliacion

Mitigacion:

- revisar `billing_events`
- agregar luego un job de sync diario con Mercado Pago

### G3. Admin manual

Gap actual:

- no existe UI administrativa para aprobar `manual_payment_requests`

Mitigacion:

- aprobar desde SQL o funcion admin futura

## 11. Rollback

Si el deploy falla:

1. quitar CTA comercial del frontend o volver al commit previo
2. desactivar webhook en Mercado Pago si genera ruido
3. mantener `subscriptions` de usuarios ya cobrados y revisar manualmente
4. no borrar `billing_events`; sirven para auditoria

## 12. Estado de este entorno local

En este workspace:

- `npm run build` paso correctamente
- no hay CLI `supabase`
- no hay `deno`
- no se hizo deploy real
- no se aplico la migracion en un backend remoto desde aqui

Conclusion:

- el codigo esta preparado
- la salida operativa depende de deploy, secretos y prueba sandbox fuera de este entorno
