# Revisión humana y decisión — entrega 004

## Aplicar y probar

1. Aplica este ZIP **encima de la entrega de extracción 003 que ya funcionó**, manteniendo las carpetas. No reemplaza el proyecto completo ni contiene claves.
2. Ejecuta una sola vez `supabase/migrations/202610170004_invoice_review.sql` en SQL Editor de tu proyecto. Requiere 001, 002 y 003. No repitas las anteriores.
3. Reinicia `npm run dev`. No hay dependencias ni variables de entorno nuevas. Mantén el modelo Gemini con el que ya extrajiste correctamente.
4. Abre con el usuario `admin` la misma factura DEMO-INV-001 que está `completed / needs_review`. No vuelvas a extraerla.
5. Debajo de las evidencias encontrarás **Revisar y confirmar**. Verifica/corrige número, proveedor registrado, moneda, total, acuerdo y fechas.
6. Para el ejemplo: proveedor **Andes Demo Services / DEMO-CO**, acuerdo **DEMO-USD-001**, moneda **USD**, importe **800.00**, número **DEMO-INV-001**, emisión **2026-10-17**, vencimiento **2026-10-20**.
7. La sugerencia de proveedor usa coincidencia exacta con el código; si no hay una única coincidencia, usa el nombre exacto. El acuerdo se sugiere por referencia exacta, proveedor y moneda. Estas propuestas requieren tu confirmación.
8. Revisa las advertencias y el original. Marca la casilla de confirmación y pulsa **Confirmar datos y evaluar reglas**. Autorizar puede reservar fondos de simulación. No ejecuta un pago.
9. Con los datos semilla intactos y presupuesto de octubre de 2026, debe aparecer **Autorizada · fondos reservados**. La tabla explica cada resultado. Si otros ensayos consumieron fondos o cambiaron políticas, el resultado puede variar.
10. En `/dashboard`, después de esta única reserva, espera:

| Concepto USD | Antes | Después |
|---|---:|---:|
| Saldo contable wallet | 5000.00 | 5000.00 |
| Reservado wallet | 0.00 | 800.00 |
| Disponible wallet | 5000.00 | 4200.00 |
| Total presupuesto | 4000.00 | 4000.00 |
| Reservado presupuesto | 0.00 | 800.00 |
| Consumido presupuesto | 0.00 | 0.00 |
| Disponible presupuesto | 4000.00 | 3200.00 |

El presupuesto es el del mes vigente en America/Bogota. Si el periodo actual ya cambió y no hay presupuesto configurado, la decisión requerirá revisión.

## Comportamiento

- `admin` y `operator` pueden revisar. `approver` consulta en este bloque; su aprobación se conectará en la entrega siguiente.
- El original y la extracción se conservan. Los campos confirmados se guardan en las columnas de la factura. Auditoría registra actor, valores anteriores y valores confirmados.
- La confirmación explícita cubre campos y advertencias vistos por la persona. No verifica autenticidad fiscal, datos bancarios ni que un proveedor sea legítimo. La demo usa documentos ficticios.
- La base de datos valida pertenencia de proveedor/acuerdo a la empresa, relación proveedor/moneda, campos, versión y número duplicado. Los UUID enviados desde el navegador nunca determinan por sí solos la empresa.
- La confirmación y el RPC financiero anterior se ejecutan en la misma transacción. Si hay error técnico, se revierte todo; si el resultado empresarial es `blocked`, `needs_review` o `pending_approval`, los datos revisados y la decisión sí quedan registrados.
- Se reutiliza la autoridad financiera SQL 002. El motor TypeScript anterior no toma una segunda decisión en este flujo.
- La autorización reserva en wallet y presupuesto. Un resultado bloqueado, pendiente de aprobación o de revisión no crea reserva. El saldo contable y el presupuesto consumido no cambian hasta el pago simulado, aún sin botón.
- Una misma solicitud con los mismos datos devuelve el resultado guardado sin duplicar reserva. Cambiar el contenido conservando el UUID de solicitud se rechaza. La UI conserva la solicitud cuando falla la conexión; puedes reintentar sin cambiar los campos.
- Una versión antigua se rechaza con aviso de recarga, para impedir que dos pestañas sobrescriban una revisión.
- El número duplicado se detecta por empresa + proveedor + número normalizado (trim/minúsculas), aunque el PDF tenga bytes distintos. No se fusionan ni se eliminan documentos automáticamente.
- Las facturas autorizadas, pagadas o canceladas ya no muestran el formulario. La cancelación que liberará fondos y el pago llegarán en el siguiente bloque.
- Es posible confirmar sin acuerdo: el motor responderá `needs_review`. Un importe distinto al acuerdo produce `blocked`. Seleccionar un proveedor no permitido produce bloqueo.

## Casos para ensayar

Hazlos sobre facturas distintas, con números distintos. Usa documentos ficticios. No dupliques el mismo número de proveedor.

| Caso | Cambio | Resultado esperado |
|---|---|---|
| Flujo principal | USD 800, acuerdo DEMO-USD-001 | Autorizada, reserva USD 800. |
| Discrepancia | USD 900 con acuerdo de USD 800 | Bloqueada; sin reserva. |
| Falta de acuerdo | No seleccionar acuerdo | Requiere revisión; sin reserva. |
| Duplicado semántico | Mismo proveedor y número ya existente | Error de duplicado; sin nueva reserva. |
| Revisión desactualizada | Confirmar desde una pestaña con versión anterior | Conflicto; recargar. |

Para demostrar `pending_approval`, hace falta que exista un acuerdo válido cuyo monto supere el umbral automático y no supere el absoluto, además de fondos y presupuesto suficientes. Con los datos semilla USD 800 no se activa ese caso. No inventes un acuerdo desde el formulario.

## Verificación

```bash
npm run typecheck
npm test
npm run test:invoices
npm run test:review
npm run build
```

Se verificaron localmente TypeScript, producción y 48 pruebas de dominio; SQL 001–004 con Auth/Storage simulados en PGlite; HTTP de Next con proveedores simulados. Las pruebas SQL incluyen reserva exacta, reintento idempotente, duplicado semántico, rollback, falta de confirmación, proveedor/acuerdo incompatible, versión antigua, aprobación pendiente y permisos.

No ejecutamos la migración en tu Supabase. No probamos esta confirmación contra tus cuentas reales ni concurrencia multisesión. La primera confirmación y revisión de saldos en tu entorno es la prueba de integración pendiente. No ejecutes `supabase/tests/review_checks.sql` en producción: contiene fixtures de un entorno desechable.

## Commits atómicos

```bash
git add supabase/migrations/202610170004_invoice_review.sql supabase/tests/review_checks.sql
git commit -m "feat(db): confirm reviewed invoices and evaluate atomically"
git add src/modules/invoices/domain/review.ts src/app/api/invoices/'[id]'/confirm/route.ts
git commit -m "feat(invoices): validate and submit reviewed invoice data"
git add src/app/invoices/'[id]'/page.tsx src/app/invoices/'[id]'/review-form.tsx src/app/invoices/'[id]'/decision-panel.tsx src/app/workspace.module.css src/app/dashboard/page.tsx
git commit -m "feat(invoices): add review form and explain financial decisions"
git add package.json tests/review.test.mjs docs/invoice-review-setup.md
git commit -m "test(invoices): cover human confirmation and review validation"
git push origin main
```

Si aún no has guardado en commits la entrega 003, hazlo antes para mantener separados ambos bloques. Aplica y prueba antes de desplegar en Vercel.
