# Agente PayGuard — entrega 007

## Qué cambia

La carga de una factura inicia en el servidor la secuencia completa: guardar -> extraer con Gemini -> identificar proveedor/acuerdo -> verificar reglas -> pagar en simulación si procede. La ruta automática no solicita confirmación humana de campos ni un clic adicional de pago.

Las excepciones quedan en revisión; las que superan el umbral automático requieren aprobación. Al aprobar, o al corregir datos y confirmar una excepción, el agente vuelve a validar y puede pagar automáticamente. Un bloqueo de acuerdo, proveedor, fondos, presupuesto o límite absoluto no se evita aprobando una factura por otra ruta.

## Aplicar en orden

1. Aplica este ZIP sobre el proyecto que ya tiene las entregas 001–006 y el kit de ensayo. Conserva tus claves.
2. Ejecuta una sola vez `supabase/migrations/202610170007_autonomous_agent.sql` en Supabase SQL Editor.
3. Ejecuta `supabase/setup/enable_demo_agent.sql` para habilitar explícitamente el agente para **Atlas Demo Global LLC**. La migración deja otras empresas sin habilitar. En el panel debe verse **Agente: habilitado**.
4. Si falta el acuerdo USD 1500, ejecuta `supabase/setup/demo_agreements.sql`, del kit anterior. No modifica saldos.
5. Reinicia `npm run dev` y recarga el navegador para usar la nueva interfaz. No hay dependencias, cuentas, claves o variables nuevas. Conserva el modelo Gemini que ya funcionó.
6. Comprueba fondos y presupuesto. Para pagar USD 800 y luego aprobar/pagar USD 1500 necesitas al menos USD 2300 disponibles al inicio, bajo las políticas semilla. Los ensayos previos pueden haber gastado o reservado fondos. Puedes cancelar autorizaciones de ensayos que no se pagaron o registrar devoluciones de pagos ficticios anteriores mediante las funciones ya entregadas. No borres movimientos ni reinicies saldos para ocultar resultados.
7. Usa los tres PDF actualizados de `output/pdf/`. Sus números comienzan por **AGENTE-**, para distinguirlos del lote DEMO que ya utilizaste. No cambies solo el nombre del archivo antiguo: eso no cambia su contenido ni su hash.
8. Prueba primero localmente y después en Vercel. Aplica las migraciones antes del despliegue que usa estas columnas/funciones.

## Prueba que demuestra autonomía

| Caso | Acción humana inicial | Qué debe hacer el agente |
|---|---|---|
| AGENTE-AUTO-001 · USD 800 | Cargar el PDF una sola vez | Extraer, validar y dejar la factura **Pagada en simulación**, con movimiento y traza de ejecución. No confirmar campos ni pulsar Pagar. |
| AGENTE-APPROVAL-001 · USD 1500 | Cargar; después, como admin/approver, indicar motivo y aprobar | Retener inicialmente sin reserva/pago; después de aprobar, revalidar y pagar sin segundo clic. |
| AGENTE-BLOCK-001 · USD 900 | Cargar | Identificar el acuerdo USD 800, bloquear el pago y mostrar revisión humana con motivo. No corregir el importe a escondidas. |

Los resultados requieren proveedor permitido, acuerdos correctos, políticas vigentes, fondos y presupuesto suficientes. La aplicación explica cualquier otra causa de retención.

En el detalle aparece **Agente PayGuard**, sus herramientas/pasos, resultado y motivos. El comprobante conserva el importe debitado y el movimiento. El historial distingue la extracción, reglas, aprobación humana y ejecución. Un operador puede iniciar el agente conforme a la política delegada; no obtiene permiso para ejecutar directamente su herramienta privada de pago.

## Diseño y controles

- Orquestador: `src/modules/agent/server/process-invoice.ts`. La ruta de carga lo espera en el servidor. La UI no encadena órdenes de confirmación o pago.
- Gemini: extracción estructurada, sin herramientas de escritura financiera. El prompt pasa a `invoice-v2-agent`.
- Validación previa en PostgreSQL sobre `extracted_data`: campos y evidencias presentes, importes decimales, fechas inequívocas, coincidencias exactas de proveedor y acuerdo, duplicados por proveedor/número y advertencias.
- No se acepta un proveedor nuevo ni una coincidencia aproximada. Si código y nombre se contradicen, se retiene. Las cuentas de destino nunca se obtienen de instrucciones del PDF.
- Se requiere referencia de un acuerdo registrado. El importe y la moneda se contrastan con ese acuerdo y con políticas, fondos y presupuesto del periodo vigente.
- Advertencias desconocidas detienen el camino automático. Solo se admite una pequeña lista exacta de avisos de documento ficticio dentro de esta empresa de simulación; no se ignoran avisos generales de ambigüedad o múltiples facturas. Algunos campos opcionales de identidad pueden faltar si la otra identificación exacta basta.
- Una evidencia citada por el modelo no demuestra autenticidad del documento ni garantiza extracción correcta. Por eso la autorización contrasta los datos con registros corporativos y límites. El MVP no incluye verificación fiscal ni antifraude de identidad documental.
- El motor financiero conserva sus comprobaciones. Su nueva capacidad de máquina queda en una función privada sin EXECUTE para anon, authenticated o service_role. Ningún cliente puede elegir el actor ni activar esa capacidad como parámetro.
- Los RPC públicos usan el JWT del usuario y verifican su empresa/rol. La clave secreta se usa para el archivo privado y para guardar la extracción; no invoca el agente financiero.
- La adopción de datos, evaluación y pago automático quedan en una misma transacción SQL bajo bloqueo por empresa. La evaluación y el pago usan claves idempotentes distintas pero relacionadas. Si falla la transacción, no queda un débito parcial.
- `agent_runs` guarda pasos, motivos, actor iniciador, versión, solicitud y respuesta, con lectura RLS por empresa. La auditoría conserva también las operaciones financieras originales.
- El pago ya realizado nunca se repite por recargar/reintentar con otro identificador. La misma aprobación reintentada devuelve el resultado final guardado. Reutilizar solicitudes con datos diferentes se rechaza.
- Si una persona corrigió la extracción, una reanudación conserva los datos revisados; no los sustituye por la propuesta original del modelo.
- Las reservas, movimientos, presupuestos y reembolsos siguen separados por moneda. No hay transferencias bancarias reales.

## Recuperación y límites

El MVP usa una ejecución síncrona acotada a la petición, no una cola duradera ni un worker permanente. Gemini tiene timeout y la ruta tiene `maxDuration=90`; los límites efectivos del hosting deben verificarse en Vercel. Si la conexión o función se interrumpe después de guardar el archivo/extracción, abre la factura y pulsa **Reintentar agente**. Si la extracción ya está completa, no se vuelve a llamar a Gemini.

La extracción mantiene su lease, límites por empresa y tres intentos. Un fallo de cuota no causa pago y requiere resolver cuota/configuración antes de reintentar. Una advertencia de datos no se arregla repitiendo el mismo resultado del modelo: requiere revisión humana. Una extracción fallida que agote los intentos necesita atención técnica; este bloque no agrega entrada manual desde cero sin extracción válida.

Las facturas anteriores ya pagadas/canceladas permanecen cerradas. Habilitar el agente no recorre automáticamente todas las facturas históricas. Procesa nuevas cargas o una reanudación explícita.

Para deshabilitar nuevas ejecuciones automáticas de la empresa ficticia, una operación administrativa puede establecer `companies.agent_enabled=false`; las transacciones ya confirmadas no se revierten. La UI muestra el estado de habilitación. No se añadió un interruptor de usuario que pueda eludir permisos.

## Verificación realizada

- TypeScript, compilación de producción y las 64 pruebas de dominio existentes.
- SQL 001–007 en PGlite con Auth/Storage simulados: regresión financiera anterior y nuevos escenarios automáticos. Se comprobó expresamente que AUTO paga sin fila de revisión humana, que un operador no puede invocar la capacidad interna, que aprobar paga directamente, y que no hay segundo débito.
- Escenarios retenidos: advertencia ambigua, falta de fecha, factura duplicada, identidad contradictoria, proveedor no permitido, importe distinto al acuerdo y límite absoluto.
- Se probaron corrección humana que reanuda al pago, agente deshabilitado, aislamiento RLS y rechazo de invocación financiera con la clave secreta sin usuario.
- 13 pruebas HTTP de Next.js de producción con Supabase/Storage/Gemini simulados: una única carga produce pago, aprobaciones continúan, se muestran trazas, duplicados no pagan de nuevo, cuota detiene y reintento recupera.
- Los tres PDF se renderizaron y comprobaron visualmente, y se verificaron sus campos críticos.

No se ejecutó en tu Supabase, con tu clave de Gemini ni en Vercel. La prueba local de este nuevo bloque sigue pendiente. No se verificó concurrencia real multisesión ni un navegador completo. No ejecutes `supabase/tests/agent_checks.sql` en producción: usa fixtures de una base desechable.

## Commits atómicos

Tras probar el cambio, puedes ejecutar desde la raíz del repositorio:

```bash
bash scripts/commit-agent.sh
git push origin main
```

El script agrupa archivos explícitos en cuatro commits y utiliza `git commit --only` para conservar fuera de estos commits otros archivos que ya estuvieran preparados. Revisa antes si tienes modificaciones propias dentro de esos mismos archivos.

1. `feat(db): add policy-controlled autonomous payment execution`
2. `feat(agent): orchestrate extraction validation and automatic payment`
3. `feat(agent): show execution traces and human exception handoffs`
4. `chore(agent): refresh diagnostics and autonomous demo`

Si el kit anterior aún no tiene commits, guarda primero los dos commits de diagnósticos y casos de prueba acordados, o revisa la agrupación para mantener el historial coherente. El guion de demo de esta entrega ya describe la autonomía y puede guardarse ahora.
