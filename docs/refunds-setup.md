# Reembolsos recibidos de proveedores — entrega 006

## Aplicar

1. Aplica este ZIP encima de la entrega 005 de acciones y pago simulado.
2. Ejecuta una vez `supabase/migrations/202610170006_simulated_refunds.sql` en Supabase SQL Editor. Requiere las migraciones 001–005 ya aplicadas. No las repitas.
3. Reinicia `npm run dev`. No hay dependencias ni variables nuevas.
4. Entra como `admin` o `approver` y abre una factura con **pago simulado completado**. Si aún no está pagada, termina la revisión y el pago de las entregas 004/005.
5. Debajo del comprobante verás **Devoluciones recibidas**, los totales y **Registrar devolución recibida**.
6. Para el caso USD 800, escribe `200.00`, indica un motivo y pulsa **Registrar reembolso recibido · simulación**.
7. Comprueba el historial, el máximo restante `600.00`, la wallet y el presupuesto original.
8. Puedes registrar después `600.00` como segundo reembolso. Al agotarse el importe, se muestra **Reembolso total registrado** y desaparece el formulario.

Esta operación simula dinero que regresa del proveedor a la empresa. No inicia una transferencia real ni un pago nuevo al proveedor. No necesita llamar a Gemini.

## Resultado del ejemplo

Supone saldo inicial USD 5000 y presupuesto USD 4000, sin otras operaciones. El pago original fue USD 800.

| Concepto USD | Después de pagar | Devueltos 200 | Devueltos 800 en total |
|---|---:|---:|---:|
| Saldo wallet | 4200.00 | 4400.00 | 5000.00 |
| Reserva activa | 0.00 | 0.00 | 0.00 |
| Gasto consumido del presupuesto original | 800.00 | 600.00 | 0.00 |
| Disponible del presupuesto original | 3200.00 | 3400.00 | 4000.00 |
| Total devuelto | 0.00 | 200.00 | 800.00 |
| Máximo aún reembolsable | 800.00 | 600.00 | 0.00 |

Si el pago corresponde a otro mes, cambia el presupuesto de ese periodo original; no aumenta artificialmente el presupuesto del mes actual. La wallet se acredita en la moneda del pago, sin conversión de divisas.

## Reglas y trazabilidad

- Solo `admin` y `approver` pueden registrar devoluciones. `operator` puede consultar el historial.
- El importe debe ser positivo y expresarse como string decimal sin separadores de miles, con máximo dos decimales. Motivo obligatorio de hasta 1000 caracteres.
- La suma de reembolsos nunca puede superar el pago original. La base de datos vuelve a comprobar el máximo, aunque el formulario esté desactualizado.
- Solo se reembolsa una factura `paid_simulated` con movimiento de pago y reserva consumida válidos.
- La wallet, moneda, presupuesto y pago original se obtienen de registros internos. El navegador no los elige.
- Se acredita la wallet y se reduce el gasto consumido del presupuesto original, en la misma transacción que el movimiento y la auditoría. Las reservas activas de otras facturas no cambian.
- El movimiento original no se borra ni modifica. Cada devolución es un movimiento `refund_received` ligado a su `original_movement_id`, con motivo y UUID de idempotencia. Auditoría registra actor y resultado.
- La factura conserva `paid_simulated` para mantener cerrado el pago original. La pantalla distingue los reembolsos parciales y el total; un reembolso completo no permite pagar de nuevo esa factura.
- Repetir la misma solicitud y contenido devuelve el resultado anterior sin otro crédito. Reutilizar el UUID con otros datos se rechaza. La UI conserva la solicitud si falla la conexión para que puedas reintentar sin cambiar importe/motivo.
- El mismo bloqueo por empresa usado para los pagos serializa estas operaciones. La consistencia multisesión real aún debe validarse en un entorno de integración.
- La UI calcula los totales del historial con enteros de precisión arbitraria. La autoridad financiera es PostgreSQL. Si el historial no se puede leer completo o es incoherente, no habilita otra devolución.
- Esta entrega no implementa comisiones, FX, fondos reales, aprobación adicional del propio reembolso ni reglas de cierre contable.

## Casos de prueba manual

| Caso | Resultado esperado |
|---|---|
| Devolver USD 200 de un pago USD 800 | Wallet +200, gasto original -200, máximo restante 600. |
| Devolver luego USD 600 | Total devuelto 800, formulario oculto. |
| Intentar USD 601 cuando solo quedan USD 600 | Rechazo, sin cambios de saldo. |
| Reintentar la misma solicitud tras perder la respuesta | Un único crédito/movimiento. |
| Cuenta `operator` | Consulta; no puede registrar reembolso. |
| Intentar otro pago tras reembolso total | Rechazo: el pago original sigue cerrado. |

## Verificación

```bash
npm run typecheck
npm test
npm run test:invoices
npm run test:review
npm run test:actions
npm run test:refunds
npm run build
```

Se probaron 64 casos de dominio, compilación de producción y SQL 001–006 en PGlite con Auth/Storage simulados. Las pruebas SQL incluyen reembolso parcial y total, idempotencia, exceso acumulado, permisos, referencia al pago, preservación del movimiento y presupuesto original incluso en otro periodo.

39 pruebas HTTP de Next.js de producción con Supabase/Gemini simulados abarcan el flujo previo y los nuevos endpoints, permisos, recibos y reintentos de reembolso. No se ejecutó esta migración en tu Supabase ni se probaron tus credenciales, Vercel, navegador completo o concurrencia real multisesión. La primera devolución en tu entorno es la prueba de integración pendiente.

No ejecutes `supabase/tests/refund_checks.sql` en producción; usa fixtures y revierte sus cambios en una base desechable.

## Commits atómicos

```bash
git add supabase/migrations/202610170006_simulated_refunds.sql supabase/tests/refund_checks.sql
git commit -m "feat(db): record bounded idempotent supplier refunds"
git add src/modules/invoices/domain/refunds.ts src/app/api/invoices/'[id]'/refund/route.ts
git commit -m "feat(refunds): validate and submit authenticated refund requests"
git add src/app/invoices/'[id]'/refund-form.tsx src/app/invoices/'[id]'/page.tsx
git commit -m "feat(refunds): show supplier returns and refundable balance"
git add package.json tests/refunds.test.mjs docs/refunds-setup.md
git commit -m "test(refunds): cover exact totals and document integration checks"
git push origin main
```

Guarda antes las entregas anteriores en sus commits. Prueba localmente, aplica las migraciones pendientes en orden y después verifica el despliegue de Vercel.
