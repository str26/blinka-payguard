# Reglas y estados del MVP

Esta es la política inicial propuesta para una empresa ficticia. Los importes son configurables; no corresponden a reglas oficiales de Blinka. Los datos reales de empresas y clientes quedan excluidos.

## Estados

- `authorized`: propuesta de autorización automática; requiere persistencia transaccional y reserva antes de ser efectiva.
- `blocked`: existe una restricción obligatoria incumplida. Una aprobación ordinaria no la anula.
- `needs_review`: información incompleta, ambigua o insuficiente. Corregir y volver a evaluar.
- `pending_approval`: supera el umbral automático, pero las demás verificaciones pasan. La aprobación debe validarse en servidor y volver a comprobar fondos, presupuesto y versión de factura/política.

Prioridad: bloqueo > revisión > aprobación > autorización automática. Se conservan todas las comprobaciones, aunque una ya determine el resultado.

## Política ficticia de ejemplo USD

| Parámetro | Valor |
| --- | --- |
| Umbral automático inclusivo | 1.000,00 USD |
| Límite absoluto inclusivo | 3.000,00 USD |
| Fondos disponibles del ejemplo | 5.000,00 USD |
| Presupuesto disponible del ejemplo | 4.000,00 USD |

COP y MXN usan sus propias políticas y saldos. No hay conversión ni suma implícita entre monedas. Importes canónicos como cadenas con punto decimal y máximo dos decimales; el extractor normaliza el texto fuente. Una moneda o separador ambiguo requiere revisión. El motor representa cantidades en unidades menores con BigInt; serializa esos valores como cadenas.

## Reglas

| Condición | Resultado |
| --- | --- |
| Falta proveedor, número, moneda, importe positivo o vencimiento válido | Revisión |
| Duplicado confirmado | Bloqueo |
| Posible duplicado | Revisión |
| Beneficiario no permitido | Bloqueo hasta alta autorizada y reevaluación |
| Acuerdo inexistente o no verificable | Revisión |
| Diferencia confirmada con el acuerdo | Bloqueo hasta corrección o actualización autorizada del acuerdo |
| Moneda sin política y saldo correspondientes | Revisión |
| Supera límite absoluto | Bloqueo |
| Fondos o presupuesto insuficientes | Bloqueo |
| Supera umbral automático, resto válido | Aprobación humana |
| Todas las verificaciones pasan | Propuesta de autorización |

La comparación con el acuerdo, detección de duplicados, autorización del beneficiario y disponibilidad se obtienen en servidor; nunca se aceptan como afirmaciones del navegador o del LLM.

## Contrato de aprobación y dinero pendiente de implementar

1. La evaluación pura no reserva ni descuenta dinero.
2. Antes de autorizar efectivamente: cargar registros actuales, bloquear/actualizar recursos de forma atómica y reservar wallet y presupuesto en una transacción.
3. La aprobación vincula persona autorizada, factura/version, política/version y motivos. Un booleano enviado por el cliente no equivale a autorización.
4. Volver a evaluar al aprobar y al simular un pago. Ningún cambio de factura puede reutilizar una aprobación anterior silenciosamente.
5. La reserva reduce disponible; el pago simulado reduce saldo contable y convierte el compromiso de presupuesto en consumo, sin descontarlo dos veces.
6. Cancelar una autorización no ejecutada libera reservas. Un reintento no crea movimientos adicionales.
7. Devoluciones recibidas, posteriores: importe positivo, referencia al pago, acumulado no superior al pagado, misma moneda e idempotencia. No reponen presupuesto automáticamente.
8. La trazabilidad registra entradas, comprobaciones, versiones, actor y tiempo. No se habilitan endpoints de decisiones hasta implementar controles de acceso.

## Qué valida esta entrega

`npm test` ejecuta 32 pruebas del dominio: casos válidos, fronteras monetarias, monedas, duplicados, campos y fechas inválidos, acuerdos, prioridad de resultados y aritmética exacta. Una prueba recorre 63 combinaciones de importes/fondos/presupuestos y comprueba las condiciones necesarias de autorización.

Estos tests no verifican OCR/Gemini, base de datos, RLS, concurrencia, autenticación ni operaciones financieras persistentes. No constituyen una garantía de ausencia de errores fuera de los casos cubiertos. La siguiente entrega implementará esquema, transacciones y pruebas de integración.
