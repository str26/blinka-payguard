# Aprobación, cancelación y pago simulado — entrega 005

## Aplicación

1. Aplica este ZIP sobre las entregas 003 y 004. Mantén sus carpetas. La migración 004 debe estar ejecutada antes de confirmar datos.
2. Ejecuta una sola vez **`supabase/migrations/202610170005_terminal_extraction_guard.sql`** en SQL Editor. Conserva el resto de migraciones ya aplicadas.
3. Reinicia `npm run dev`. No hay dependencias, claves o variables nuevas.
4. Entra como `admin` o `approver`, abre una factura autorizada y revisa la reserva y los datos confirmados.
5. Pulsa **Ejecutar pago simulado**. Debe pasar a **Pagada en simulación**, mostrar importe debitado e identificador de movimiento, y dejar de mostrar botones de pago.
6. Usa **Ver saldos actualizados** para comprobar wallet y presupuesto.

Si la factura de USD 800 aún está `needs_review`, primero aplica la entrega 004, confirma proveedor/acuerdo/campos y verifica que resulte autorizada. No necesitas volver a llamar a Gemini.

## Resultado del caso USD 800

Supone que partes de los datos semilla intactos y que no hay otras operaciones. Una reserva previa de la misma factura no se suma de nuevo al pagar.

| Concepto USD | Inicial | Autorizada | Pagada en simulación |
|---|---:|---:|---:|
| Saldo contable wallet | 5000.00 | 5000.00 | 4200.00 |
| Reservado wallet | 0.00 | 800.00 | 0.00 |
| Disponible wallet | 5000.00 | 4200.00 | 4200.00 |
| Total presupuesto | 4000.00 | 4000.00 | 4000.00 |
| Reservado presupuesto | 0.00 | 800.00 | 0.00 |
| Consumido presupuesto | 0.00 | 0.00 | 800.00 |
| Disponible presupuesto | 4000.00 | 3200.00 | 3200.00 |

El disponible no vuelve a disminuir al consumir la reserva: el importe que ya estaba apartado pasa a débito/gasto. No hay transferencia real ni conexión a la API bancaria de Blinka.

## Acciones por estado y rol

| Estado | admin / approver | operator |
|---|---|---|
| Autorizada | Reevaluar, pagar en simulación, cancelar | Reevaluar |
| Pendiente de aprobación | Reevaluar, aprobar/rechazar con motivo, cancelar | Reevaluar; puede corregir mediante el formulario de revisión |
| Bloqueada / requiere revisión | Reevaluar, cancelar | Reevaluar; puede corregir mediante el formulario |
| Pagada / cancelada | Consultar comprobante e historial | Consultar |

`approver` no modifica los datos revisados; `admin` y `operator` sí pueden revisarlos mientras no estén autorizados/pagados/cancelados. No se exige que quien revisa y quien aprueba sean personas diferentes: el motor actual admite que un administrador haga ambas tareas.

- Aprobar vuelve a evaluar política, proveedor, acuerdo, fondos y presupuesto. Solo reserva si el resultado es `authorized`. Si cambiaron los datos, la política o la decisión, se debe reevaluar antes.
- Rechazar requiere motivo y deja la factura **cancelada definitivamente**.
- Cancelar libera reservas activas de wallet y presupuesto. No cambia el saldo contable ni el gasto consumido. No permite reabrir la misma factura desde la UI y no equivale a reembolso.
- Pagar solo funciona sobre una factura autorizada y vuelve a comprobar las reglas. Si alguna dejó de cumplirse, puede responder `blocked`, `needs_review` o `pending_approval`: la pantalla muestra ese resultado, sin afirmar que hubo pago.
- Reevaluar puede cambiar la decisión y liberar una reserva que ya no cumpla reglas. Usa los datos confirmados actuales; no invoca Gemini.
- Cada solicitud tiene UUID de idempotencia. Ante una respuesta perdida, la UI conserva el UUID para reintentar la misma acción y motivo. El backend devuelve el resultado previo sin otro débito. Un UUID nuevo sobre una factura pagada también se rechaza.
- Los movimientos e historial se consultan con la sesión del usuario y RLS. Los comandos financieros usan el RPC existente con el JWT del usuario; no usan la clave secreta ni aceptan importes/saldos desde el navegador.

## Qué agrega la migración 005

Protege un caso de respuesta tardía de Gemini: si se cancela una factura mientras la extracción está en curso, su resultado no puede cambiarla nuevamente a `needs_review`. La extracción tardía se marca fallida con código `CLOSED` y se registra como ignorada; el estado financiero permanece cerrado. La función conserva los permisos de la migración 003.

## Pruebas manuales recomendadas

1. **Pago principal:** confirmar USD 800, pagar y verificar comprobante y tabla anterior.
2. **Cancelación:** en otra factura autorizada con número único, cancelar. Debe liberar reserva, mantener saldo y no crear pago.
3. **Permisos:** una cuenta `operator` no debe poder aprobar, pagar ni cancelar, incluso llamando a la API directamente. El RPC vuelve a comprobar el rol.
4. **Aprobación:** requiere un acuerdo real de la empresa ficticia por encima del umbral automático (USD 1000) y dentro del absoluto (USD 3000), con presupuesto suficiente. El acuerdo semilla USD 800 no activa aprobación. No alteres solo el importe: eso provoca discrepancia y bloqueo.
5. **Rechazo:** sobre una factura pendiente de aprobación, indicar motivo y rechazar. Debe quedar cancelada sin pago.
6. **Segunda petición de pago:** la factura pagada no muestra el botón; el servidor también rechaza un intento adicional. Recargar o reintentar no debe crear otro movimiento.

No se incluyó una pantalla para crear acuerdos, recargar wallets, cambiar políticas o reembolsar. No uses los tests SQL como datos de demo de producción: crean fixtures y hacen rollback.

## Verificación realizada

```bash
npm run typecheck
npm test
npm run test:invoices
npm run test:review
npm run test:actions
npm run build
```

56 pruebas de dominio y compilación. PostgreSQL local PGlite con Auth/Storage simulados, migraciones 001–005 y regresiones de extracción, revisión, pagos, roles, idempotencia, aprobación, rechazo, cancelación y monedas independientes. Se verificó específicamente el caso de extracción tardía sobre factura cancelada.

Pruebas HTTP sobre Next.js de producción con Supabase/Gemini simulados verificaron el endpoint financiero, control de rol, validación de motivo, pago/reintento, conflictos, comprobante, ausencia de botones terminales y aprobación/rechazo/cancelación. No se probaron navegador completo, concurrencia real multisesión, Vercel ni tus credenciales reales. Falta validar la operación completa en tu Supabase.

## Commits atómicos

```bash
git add supabase/migrations/202610170005_terminal_extraction_guard.sql supabase/tests/payment_flow_checks.sql src/modules/invoices/server/gemini.ts
git commit -m "fix(invoices): ignore extraction results after invoice closure"
git add src/modules/invoices/domain/actions.ts src/app/api/invoices/'[id]'/actions/route.ts
git commit -m "feat(payments): expose authenticated invoice financial commands"
git add src/app/invoices/'[id]'/financial-actions.tsx src/app/invoices/'[id]'/page.tsx src/app/invoices/'[id]'/decision-panel.tsx src/app/workspace.module.css src/app/dashboard/page.tsx
git commit -m "feat(payments): add approval controls and simulated payment receipt"
git add package.json tests/actions.test.mjs docs/payment-actions-setup.md
git commit -m "test(payments): cover financial action validation and document setup"
git push origin main
```

Guarda primero los cambios de la entrega 004 en sus propios commits si aún no lo has hecho. Aplica la migración y prueba antes del despliegue en Vercel.
