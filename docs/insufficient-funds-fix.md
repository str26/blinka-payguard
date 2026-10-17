# Fondos insuficientes — corrección 008

## Aplicar

1. Copiar el ZIP sobre el proyecto con la entrega 007 ya instalada. Incluye también los tres archivos de interfaz corregidos en la entrega anterior de aprobación.
2. Ejecutar UNA VEZ `supabase/migrations/202610170008_insufficient_funds_messages.sql` en Supabase SQL Editor. No volver a ejecutar migraciones anteriores. No modifica saldos, límites, permisos ni acuerdos.
3. Reiniciar `npm run dev` y abrir la factura existente.
4. Si ya está bloqueada, pulsar **Reevaluar y continuar con el agente** para actualizar la decisión y la traza. Con USD 1300 disponibles y factura USD 1500 debe seguir bloqueada y mostrar:

> Fondos insuficientes. Requerido: USD 1500.00. Disponible: USD 1300.00. Faltante: USD 200.00. No se ejecutó el pago.

5. Verificar que no aparece comprobante de pago ni otro débito. La aprobación humana no evita este bloqueo. Después de resolver legítimamente la falta de fondos en la simulación, reevaluar; si supera el umbral automático todavía requiere la aprobación correspondiente.

## Comportamiento

- Alerta visible en el detalle, antes de la traza del agente, basada en la última decisión de la versión actual. No se muestra como un error activo en facturas pagadas/canceladas.
- Las decisiones nuevas y las trazas guardan un mensaje con requerido, disponible y faltante. No se sustituye un bloqueo por una excepción técnica: se conserva el estado bloqueado y su auditoría.
- El disponible corresponde a la wallet de la moneda, descontando reservas de otras facturas. El saldo contable puede diferir del disponible.
- La insuficiencia de presupuesto tiene un mensaje separado; una wallet con fondos no permite gastar por encima del presupuesto.
- Los importes mostrados pertenecen a la evaluación guardada. Si cambia el disponible, reevaluar para actualizarlo.
- Los cálculos de presentación usan enteros BigInt en centavos y cadenas decimales. Los cálculos autorizantes continúan en PostgreSQL numeric bajo los bloqueos existentes.
- Los snapshots antiguos con números enteros seguros permiten la misma alerta. Los datos incompletos o con precisión no verificable producen un mensaje genérico y piden reevaluar; no inventan importes.

## Pruebas

Se aplicaron migraciones 001–008 en una base desechable PGlite y pasaron las regresiones financieras y del agente. Se comprobó explícitamente wallet USD 1300 frente a factura USD 1500: bloqueada, faltante USD 200, ninguna reserva ni movimiento y saldo intacto. También se probó presupuesto insuficiente con wallet suficiente. Seis pruebas de presentación verifican precisión decimal, snapshots anteriores y ausencia de alertas en controles aprobados. Compilación de producción verificada. Pendiente aplicar en el entorno del usuario.

Para ejecutar las pruebas nuevas de presentación:

```bash
npx tsc -p tsconfig.invoices-tests.json
node --test tests/liquidity.test.mjs
```

`supabase/tests/agent_checks.sql` es solo para una base desechable que tenga 001–008. No ejecutarlo en el proyecto de demostración: contiene fixtures y ajustes de saldos para pruebas, todos dentro de una transacción con rollback.

## Commits atómicos

Si la corrección anterior de aprobación ya está versionada:

```bash
git add supabase/migrations/202610170008_insufficient_funds_messages.sql supabase/tests/agent_checks.sql
git commit --only -m "fix(agent): explain insufficient funds and budget blocks" -- supabase/migrations/202610170008_insufficient_funds_messages.sql supabase/tests/agent_checks.sql
git add src/modules/invoices/domain/liquidity.ts 'src/app/invoices/[id]/page.tsx' tests/liquidity.test.mjs docs/insufficient-funds-fix.md
git commit --only -m "fix(invoices): display payment shortfalls from decision snapshots" -- src/modules/invoices/domain/liquidity.ts 'src/app/invoices/[id]/page.tsx' tests/liquidity.test.mjs docs/insufficient-funds-fix.md
```

Si la corrección anterior aún no está versionada, revisar primero los cambios de sus tres componentes de interfaz para no dejar archivos sin guardar. Este ZIP incluye sus versiones acumuladas. No contiene claves.
