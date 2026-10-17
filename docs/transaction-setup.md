# Operaciones transaccionales: segunda entrega

## Instalar

1. Extraer el ZIP en la raiz del repositorio.
2. En Supabase SQL Editor, ejecutar completo `supabase/migrations/202610170002_transactions.sql`, una sola vez y despues de la migracion 001.
3. Ejecutar completo `supabase/tests/transaction_checks.sql` como postgres. Crea datos ficticios aislados y los revierte al finalizar. No ejecutar fragmentos sueltos. Resultado final: OK. La consulta con rol authenticated devuelve blocked para un caso con fondos insuficientes.
4. Guardar los archivos en Git con el commit indicado al final.

No volver a ejecutar la migracion 001. No contiene DROP ni reemplaza tablas del usuario. Si la migracion falla, no continuar: revisar el error. ROLLBACK permite salir de una transaccion abortada.

## Que implementa

`payguard_process_invoice` es el unico RPC para evaluar, aprobar, rechazar, cancelar y pagar en simulacion. La implementacion privilegiada esta en payguard_private, con search_path fijo. El wrapper publico usa security invoker. Se revocan permisos anon y service_role para invocar; authenticated necesita identidad y membresia validas.

La clave secreta NO sustituye una identidad humana. Desde Next.js se invocara con cliente Supabase sujeto a la sesion del usuario (publishable key + JWT de Auth). Antes debe implementarse el login y asignar miembros de la empresa. Los miembros del dashboard Supabase no son usuarios de esta aplicacion.

| Accion | Roles | Resultado |
| --- | --- | --- |
| evaluate | admin/operator/approver | Reevalua y registra; reserva si cumple todo |
| approve | admin/approver | Revalida factura, politica, fondos y presupuesto; autoriza solo si cumple todo |
| reject | admin/approver | Registra rechazo y cancela de forma terminal |
| cancel | admin/approver | Cancela y libera reservas no consumidas |
| pay | admin/approver | Revalida, debita wallet, consume presupuesto y registra pago simulado |

Cada solicitud requiere UUID de idempotencia. Reintentar la misma solicitud con el mismo usuario y parametros devuelve la respuesta original sin repetir efectos. Reutilizar el UUID para otra accion o factura genera error. Un pago ya completado no admite un segundo pago con otro UUID.

## Cambios del esquema

- operation_requests: respuesta persistida por empresa/request_id y trazabilidad del actor.
- invoices.review_reasons: array con ambiguedades o verificaciones pendientes. Si no esta vacio, no autoriza automaticamente. Lo administra el backend de extraccion/validacion, nunca una orden procedente del documento.
- decisions.decision_order: orden de decisiones que permite identificar la ultima aun si varias tienen la misma fecha.
- Trigger de factura: aumenta version al corregir campos relevantes; impide editar campos de una factura autorizada/con reserva activa o pagada. Cancelar primero una autorizacion; una factura cancelada queda terminal.
- Trigger de politica: importes y version no se sobrescriben. Para cambiarla, desactivar la anterior e insertar nueva version.
- La clave service_role pierde INSERT/UPDATE/DELETE/TRUNCATE sobre wallets, budgets, reservations y wallet_movements. El SQL administrativo conserva privilegios. Los cambios de configuracion financiera necesitaran operaciones autorizadas propias.

El procesamiento se serializa por empresa mediante un advisory transaction lock. Tambien bloquea factura, fondos y presupuesto. Es una eleccion deliberada para el volumen del MVP; no es una arquitectura optimizada para alta concurrencia.

Se usa el presupuesto del mes actual en America/Bogota. El seed inicial contiene octubre 2026: si se utiliza en otro mes, crear el presupuesto correspondiente desde SQL administrativo hasta implementar su gestion.

El valor disponible incluye la reserva propia al reevaluar y evita descontarla dos veces. Solo se reserva al autorizar; pendientes de aprobacion no apartan fondos. Una aprobacion no garantiza que siga habiendo fondos al aceptarla. Una reevaluacion que deja de cumplir libera reservas previas.

El SQL es la autoridad final de autorizacion. El evaluador TypeScript anterior sirve como referencia de dominio; la integracion de ejecucion debe delegar al RPC, sin confiar en decisiones calculadas en navegador o en un LLM. Falta ajustar el adaptador TypeScript al contrato SQL y comprobar equivalencia de casos comunes.

## Contrato del RPC

Parametros:
- p_invoice: UUID de factura.
- p_action: evaluate, approve, reject, cancel o pay.
- p_request: UUID nuevo por intencion; conservarlo al reintentar.
- p_decision: UUID de la ultima decision pending_approval; obligatorio solo para approve/reject.
- p_reason: motivo de 1 a 1000 caracteres para approve/reject; omitir para otras acciones.

Salida JSON: invoice_id, status, simulation=true; para evaluacion/pago tambien decision_id, reservation_id, movement_id y checks segun corresponda. simulation=true identifica el entorno, no confirma que hubo pago: comprobar status=paid_simulated.

Estados: authorized, blocked, needs_review, pending_approval, cancelled, paid_simulated. Prioridad de controles: bloqueo > revision > aprobacion > autorizacion.

Si alguien rechaza una factura, la cancelacion es terminal. Los bloqueos por fondos o reglas pueden reevaluarse con un request nuevo cuando se resuelva la condicion. Cambios en documento/politica invalidan aprobaciones anteriores; siempre se vuelven a verificar acuerdo, beneficiario y recursos.

## Evidencia de prueba

Probado en PostgreSQL embebido/PGlite con auth.uid, auth.users, roles y storage.buckets simulados. Se instalaron ambas migraciones y se probaron:
- autorizacion y reserva conjunta de wallet/presupuesto;
- evaluacion y pago idempotentes;
- rechazo de claves reutilizadas y pagos repetidos;
- proteccion de campos de facturas reservadas y pagadas;
- cancelacion y liberacion;
- umbral de aprobacion, permisos de operador, aprobacion y pago;
- limite absoluto, fondos, presupuesto y discrepancia del acuerdo;
- datos incompletos/ambiguos;
- versiones obsoletas de factura/politica;
- rechazo humano terminal;
- dos facturas compitiendo secuencialmente por fondos insuficientes;
- aislamiento por empresa, falta de identidad, RPC autenticado, bloqueo anon y escritura directa de service_role.

NO se realizo una prueba con sesiones concurrentes reales ni con Supabase remoto. El bloqueo se implemento, pero su comportamiento bajo carga y la integracion JWT real requieren pruebas del despliegue. Tampoco se implementaron login/interfaz, extraccion Gemini, gestion de politicas, reembolsos o envio real de dinero.

## Commit

```bash
git add supabase/migrations/202610170002_transactions.sql supabase/tests/transaction_checks.sql docs/transaction-setup.md
git commit -m "feat(payments): add transactional invoice decisions and simulated payments"
git push origin main
```

Siguiente etapa: login y membresias de la empresa, cliente Supabase de servidor con sesion y pantallas para consultar politicas/wallets. Despues, carga y extraccion Gemini con evidencias y review_reasons.
