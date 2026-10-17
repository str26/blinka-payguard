# Supabase: primera migracion

## Alcance y estado

Esta entrega crea el esquema y datos ficticios de Atlas Demo Global LLC. No conecta aun la interfaz, no llama Gemini y no habilita autorizaciones, pagos ni reembolsos. Las tablas de aprobaciones, reservas y movimientos son la base de las siguientes operaciones transaccionales.

Validacion local realizada en PostgreSQL embebido (PGlite), con auth.uid(), roles, auth.users y storage.buckets simulados. Migracion, seed ejecutado dos veces y 21 comprobaciones SQL de restricciones/privilegios/RLS pasaron. Esto no verifica el servicio Supabase Auth real, Storage real, politicas preexistentes, concurrencia ni pagos. No se ejecutaron cambios en tu proyecto remoto.

## Archivos y orden

1. `supabase/migrations/202610170001_initial_schema.sql`: copiar entero en SQL Editor y ejecutar una sola vez en el proyecto correcto.
2. `supabase/seed.sql`: ejecutar despues, en otra consulta. Se puede repetir sin modificar filas existentes.
3. `supabase/tests/schema_checks.sql`: ejecutar entero como postgres en SQL Editor. Las entidades y usuarios sinteticos de prueba se eliminan mediante ROLLBACK. No dividir el script en consultas sueltas. El mensaje final esperado es OK con 21 comprobaciones.

La migracion es transaccional. No borra ni reemplaza tablas existentes. Si aparece `relation already exists`, no borrar tablas: comprobar si ya se ejecuto, o si hay objetos ajenos con esos nombres. Si falla dentro de la transaccion, ejecutar ROLLBACK antes de volver a intentar y revisar el error.

## Tablas

- companies, company_members: empresa ficticia y usuarios propios de la app.
- suppliers, agreements, policies: beneficiarios, acuerdos y versiones de reglas por moneda.
- wallets: saldo contable, reservado y disponible calculado.
- budgets: presupuesto mensual por moneda; disponible = total - reservado - consumido.
- documents, invoices: archivo original privado y datos normalizados/versionados.
- decisions, approvals: evaluaciones y decisiones humanas vinculadas.
- reservations, wallet_movements: compromisos y movimientos simulados.
- audit_events: eventos de trazabilidad.

Las claves compuestas impiden vincular proveedores, facturas, wallets o presupuestos de empresas distintas. Monedas permitidas: USD, COP, MXN. No se convierten automaticamente. Importes exactos NUMERIC(20,2); la aplicacion debe rechazar mas de dos decimales antes de insertar, porque PostgreSQL puede redondearlos.

La unicidad de factura usa empresa + proveedor + numero normalizado (minusculas y espacios extremos). Un duplicado debe registrarse como evento/rechazo asociado al registro original; no insertar otra factura con esa identidad. La deteccion de similitudes es trabajo posterior del backend.

## Fondos ficticios

| Moneda | Wallet | Presupuesto octubre 2026 | Umbral automatico | Limite absoluto |
| --- | ---: | ---: | ---: | ---: |
| USD | 5000 | 4000 | 1000 | 3000 |
| COP | 20000000 | 16000000 | 4000000 | 12000000 |
| MXN | 100000 | 80000 | 20000 | 60000 |

No representan equivalencias cambiarias. Son configuraciones independientes para demostrar reglas. No hay facturas sembradas ni documentos inexistentes: se incorporaran por carga.

## Usuarios: dashboard no equivale a aplicacion

Ser Owner/Developer de la organizacion Supabase NO crea un usuario en Authentication ni una membresia de Atlas Demo Global LLC.

Cuando implementemos el login, crear dos usuarios de prueba en Authentication > Users. Copiar sus UUID, nunca contrasenas, y asignar membresia desde SQL Editor. No anadir usuarios a company_members desde el navegador. Ejemplo a completar y ejecutar solo con UUID reales de Auth:

```sql
insert into public.company_members(company_id,user_id,role)
values
('10000000-0000-4000-8000-000000000001','UUID_AUTH_ADMIN','admin'),
('10000000-0000-4000-8000-000000000001','UUID_AUTH_APPROVER','approver');
```

Los placeholders no son SQL ejecutable hasta sustituirlos. No compartir passwords ni claves del proyecto. El permiso real de aprobacion lo verificara el backend; las tablas no validan por si solas la autoridad funcional de un actor.

## Acceso y Storage

RLS activa en las 14 tablas. Usuarios autenticados pueden leer solo registros de sus empresas. Ninguna escritura de estas tablas se permite al rol authenticated; anon no tiene acceso. La clave secreta del backend omite RLS: cada endpoint debera comprobar identidad, empresa y rol antes de ejecutar acciones.

Se crea bucket privado `payguard-invoices`, limite 10 MiB por archivo, tipos PDF/JPEG/PNG. Todavia no tiene politicas para acceso directo del navegador. El backend validara el archivo real y emitira accesos firmados con autorizacion. documents.storage_path comienza con el UUID de empresa seguido de `/`.

Decisions, approvals, wallet_movements y audit_events solo permiten SELECT/INSERT al rol service_role; el administrador SQL conserva capacidad de modificarlos. Esto es trazabilidad de aplicacion, no almacenamiento inviolable.

## Proxima entrega

Operaciones transaccionales de evaluacion/reserva, aprobacion, cancelacion y pago simulado: bloqueos de filas, revalidacion con registros vigentes, idempotencia y actualizacion conjunta de wallet, presupuesto, estado y auditoria. Hasta implementarlas, no modificar los saldos manualmente para simular pagos. La coherencia entre sumas de reservas/movimientos y saldos agregados requiere esas operaciones y sus pruebas de concurrencia.

## Verificacion de instalacion

```sql
select currency,balance,reserved,available from public.wallets order by currency;
select currency,period,total,reserved,spent,available from public.budgets order by currency;
select currency,version,automatic_limit,absolute_limit from public.policies order by currency;
select id,public,file_size_limit from storage.buckets where id='payguard-invoices';
```

## Commit sugerido

```bash
git add supabase/migrations/202610170001_initial_schema.sql supabase/seed.sql supabase/tests/schema_checks.sql docs/supabase-setup.md
git commit -m "feat(db): add Supabase schema and synthetic demo data"
```
