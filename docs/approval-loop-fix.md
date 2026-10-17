# Corrección de la interfaz de aprobación

Confirmar los datos de una factura no registra la autorización de un gasto superior al umbral automático. La interfaz 007 mostraba el formulario de corrección también en pending_approval, permitiendo repetir una acción que nunca aprueba el gasto. Esta entrega oculta ese formulario en ese estado, dirige a la aprobación con motivo y evita ofrecer la reevaluación/reintento como acción alternativa mientras se espera aprobación. Si una corrección queda bloqueada, ahora muestra una explicación explícita.

## Aplicar

1. Copiar los archivos de este ZIP sobre el proyecto. No contiene cambios de claves ni una migración nueva. No volver a ejecutar la 007.
2. Reiniciar `npm run dev` y recargar la factura existente. No subir otra copia ni cambiar su número para reintentar.
3. Si el estado es pendiente de aprobación, usar un usuario con rol de aplicación admin o approver, indicar motivo y pulsar **Aprobar y continuar con el agente**. Tener acceso al equipo de Supabase no concede ese rol en la aplicación.
4. Si está bloqueada, revisar las filas Bloquea en la decisión. El PDF de aprobación requiere DEMO-USD-1500 por USD 1500, umbral automático USD 1000, límite absoluto USD 3000, proveedor permitido y USD 1500 disponibles tanto en wallet como en presupuesto. La aprobación no evita estos controles.
5. Si falta el acuerdo, ejecutar `supabase/setup/demo_agreements.sql` (idempotente; no reinicia fondos). Si la factura ya está en revisión, seleccionar el acuerdo correcto contra el PDF y confirmar datos; después aprobar el gasto si queda pendiente. No sustituirlo por el acuerdo de USD 800.
6. Para diagnosticar un bloqueo persistente, ejecutar `supabase/setup/diagnose_approval_demo.sql` y revisar latest_decision. Es solo lectura. Compartir los códigos/resultados de las reglas fallidas, sin claves.

## Validación

La prueba SQL de regresión reproduce dos confirmaciones consecutivas sobre una factura de USD 1500: conserva pending_approval, no crea aprobaciones ni movimientos. A continuación, la aprobación explícita de la última decisión paga y el reintento devuelve el mismo resultado. No se ha inspeccionado la base de datos del usuario; una regla de bloqueo adicional debe diagnosticarse con su resultado real.

## Commits

```bash
git add 'src/app/invoices/[id]/page.tsx' 'src/app/invoices/[id]/review-form.tsx' 'src/app/invoices/[id]/financial-actions.tsx'
git commit --only -m "fix(invoices): separate field correction from spending approval" -- 'src/app/invoices/[id]/page.tsx' 'src/app/invoices/[id]/review-form.tsx' 'src/app/invoices/[id]/financial-actions.tsx'
git add supabase/tests/agent_checks.sql supabase/setup/diagnose_approval_demo.sql docs/approval-loop-fix.md
git commit --only -m "test(agent): cover repeated correction before payment approval" -- supabase/tests/agent_checks.sql supabase/setup/diagnose_approval_demo.sql docs/approval-loop-fix.md
```

El archivo demo_agreements.sql ya pertenece al kit anterior; se incluye para facilitar su aplicación si faltaba. Si aún no está versionado, guardarlo en un commit propio de datos de demostración. Los comandos anteriores no incluyen cambios ajenos preparados en otros archivos.
