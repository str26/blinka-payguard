# Demo PayGuard con agente autónomo

Esta versión sustituye el guion manual anterior. Instalación y límites: `docs/agent-setup.md`.

## Preparación

1. Migraciones 001–007 aplicadas; `supabase/setup/enable_demo_agent.sql` ejecutado. Panel con agente habilitado.
2. Proveedor DEMO-CO permitido, acuerdos DEMO-USD-001 (USD 800) y DEMO-USD-1500 (USD 1500), política USD automática hasta 1000 y absoluta hasta 3000.
3. Fondos y presupuesto disponibles para el ensayo: al menos USD 2300 para AUTO y APPROVAL. Si los ensayos anteriores consumieron fondos, el resultado puede ser un bloqueo correcto; revisa saldos antes de presentar.
4. Usa los PDF nuevos de `output/pdf/`: sus números son AGENTE-AUTO-001, AGENTE-APPROVAL-001 y AGENTE-BLOCK-001. `examples/demo-invoices.json` contiene los campos y estados esperados.
5. Ejecuta `npm run check:mvp` y la consulta de solo lectura `supabase/tests/installation_readiness.sql`. Son diagnósticos, no pruebas de movimientos reales. La instalación ahora tiene 17 tablas y 7 funciones públicas relevantes.
6. Ten listas las sesiones admin y approver. Comprueba la extracción con tu cuota antes de cronometrar. No presentes una extracción almacenada como una nueva llamada en vivo.

## Casos

| PDF | Resultado tras cargar | Intervención humana |
|---|---|---|
| demo-auto-001.pdf · USD 800 | Pagada en simulación | Solo cargar. No confirmar datos ni pulsar Pagar. |
| demo-approval-001.pdf · USD 1500 | Pendiente de aprobación | Aprobar con motivo; el agente revalida y paga directamente. |
| demo-block-001.pdf · USD 900 | Bloqueada y enviada a revisión | Resolver discrepancia con el acuerdo USD 800; no se paga. |

La reserva puede no verse como estado intermedio en AUTO porque se crea y consume dentro de la misma transacción. La decisión, operaciones y comprobante dejan la trazabilidad; no hace falta detener artificialmente al agente para mostrar un botón de pago.

## Guion propuesto de tres minutos

| Tiempo | Mostrar | Mensaje |
|---|---|---|
| 0:00–0:20 | Problema | Las facturas deben convertirse en pagos con control de proveedor, acuerdo, límites y fondos. |
| 0:20–1:20 | Cargar AUTO; resultado y traza del agente | Una carga dispara extracción, identificación, reglas y pago simulado. La IA extrae; las herramientas financieras aplican la política. |
| 1:20–2:10 | BLOCK y motivo de acuerdo | El agente se detiene ante una discrepancia y deja el caso a revisión humana. |
| 2:10–2:45 | APPROVAL y aprobación ya preparada | Una persona autoriza el caso que supera el umbral. El agente continúa hasta el pago, sin otro clic de ejecución. |
| 2:45–3:00 | Comprobante e historial | Proponemos un piloto para medir tiempo de revisión, exactitud de extracción y errores detectados. |

Ajusta duración a lo que indique la organización; este guion no afirma un tiempo oficial. Si Gemini tarda demasiado para tres casos, prioriza AUTO en vivo y muestra una excepción previamente procesada identificándola como tal. Guarda una grabación de respaldo de una ejecución real del MVP.

El reembolso parcial es un caso de respaldo: sobre un pago ficticio, registrar USD 200 y comprobar wallet +200 y gasto del presupuesto original -200. No es necesario para explicar la autonomía principal.

## Saldos para un inicio intacto

Con wallet USD 5000 y presupuesto USD 4000, ambos casos válidos pagados, y BLOCK sin movimiento:

| Momento | Wallet | Reservado | Presupuesto consumido | Presupuesto disponible |
|---|---:|---:|---:|---:|
| Inicial | 5000 | 0 | 0 | 4000 |
| AUTO pagada por el agente | 4200 | 0 | 800 | 3200 |
| APPROVAL pendiente | 4200 | 0 | 800 | 3200 |
| APPROVAL aprobada y pagada por el agente | 2700 | 0 | 2300 | 1700 |
| BLOCK retenida | 2700 | 0 | 2300 | 1700 |
| Devolución opcional de USD 200 | 2900 | 0 | 2100 | 1900 |

Si ya hay otras operaciones, aplica estos importes como cambios sobre los saldos actuales. No prometas exactamente estos valores en una empresa que ya gastó fondos.

## Repetición y reparto

Los documentos pagados no se pagan de nuevo. Para otro lote, genera números nuevos con `python scripts/generate-demo-invoices.py --batch AGENTE-B` (requiere Python/reportlab); cambiar solo el nombre del archivo no basta. No borres el historial para repetir.

- Esther: comparar PDF y extracción, validar excepciones y saldos, medir tiempos y preparar evidencia visual.
- John Harold: revisar diagnóstico/migraciones, conducir la demo y explicar política, herramientas e idempotencia.
- Ambos: un ensayo local y otro en Vercel; registrar los resultados y la latencia real.

No atribuyas ahorros, precisión porcentual, autenticidad fiscal o integración bancaria real sin medirlos. El MVP usa una empresa y movimientos ficticios. Es un agente de flujo acotado orquestado en el servidor, con una petición síncrona y recuperación por reintento; no una cola duradera o un LLM con acceso libre a cuentas.
