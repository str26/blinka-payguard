# Facturas y extracción Gemini — entrega 003

## Instalación

1. Copia los archivos de esta entrega conservando las carpetas. Parte del login y dashboard ya entregados. No reemplaces un frontend nuevo de Lovable sin revisar los cambios de `dashboard/page.tsx`.
2. En Supabase SQL Editor ejecuta **una vez** `supabase/migrations/202610170003_invoice_extraction.sql`. Requiere las migraciones 001 y 002 anteriores. Este ZIP no vuelve a incluir 002: si falta en tu repositorio, recupera la entrega de transacciones. No repitas las migraciones ya ejecutadas. No ejecutes los tests SQL en producción.
3. Conserva tus cuatro variables existentes. Añade `GEMINI_MODEL` en `.env.local` y Vercel. Es un ID de modelo, NO otra clave. No lleva el prefijo `models/`.
4. Ejecuta `npm run list:gemini-models`. Elige un modelo multimodal con PDF y salida estructurada disponible para la clave. La documentación consultada incluye `gemini-3.8-flash`; úsalo solo si figura y está habilitado en tu cuenta. Ejemplo: `GEMINI_MODEL=gemini-3.8-flash`. El catálogo no prueba cuota ni generación.
5. Reinicia `npm run dev`. Entra con el usuario `admin`, abre `/dashboard`, pulsa **Subir y revisar facturas**. El rol `operator` también puede cargar; `approver` solo consulta en esta entrega.
6. Abre `examples/demo-invoice.html` en el navegador y usa Imprimir → Guardar como PDF. Ese PDF es el archivo de prueba (el formulario no acepta HTML). Debe pesar menos de 3 MiB.
7. Sube el PDF. Verifica: total `800.00`, moneda `USD`, proveedor `Andes Demo Services`, acuerdo `DEMO-USD-001`, emisión `2026-10-17`, vencimiento `2026-10-20`. Las evidencias deben corresponder al original.
8. Repite la carga del **mismo archivo**: debe abrir la misma factura, sin otra llamada al modelo si ya terminó. Un PDF regenerado puede tener bytes diferentes y, por tanto, otro hash.
9. En Vercel configura `GEMINI_MODEL` y las cuatro variables previas en el entorno que utilizarás; haz un nuevo deploy para aplicarlas.

Nunca pongas `SUPABASE_SECRET_KEY` o `GEMINI_API_KEY` en variables `NEXT_PUBLIC_*`, GitHub, capturas o mensajes.

## Qué hace

- Carga autenticada con validación de rol/empresa, origen, tamaño y firma inicial del archivo; no es un analizador antivirus ni valida íntegramente el formato.
- PDF, PNG y JPEG de hasta 3 MiB. El límite de aplicación es menor al del bucket de 10 MiB para mantener la petición multipart bajo el límite del despliegue. Archivos cifrados o malformados pueden fallar en Gemini.
- Storage privado, nombres internos aleatorios, SHA-256 verificado antes de extraer. Link temporal al original con vencimiento de 60 segundos, solo después de lectura autorizada por RLS.
- Registro documento/factura transaccional, una factura por documento y deduplicación de bytes por empresa.
- Extracción en una petición separada, timeout de proveedor de 60 segundos, lease de 3 minutos, máximo 3 intentos por factura y 30 extracciones por empresa/hora. Límite adicional de 30 documentos nuevos/empresa/hora.
- Gemini recibe el documento, sin herramientas ni acceso a claves, wallets, reglas o funciones de pago. Prompt `invoice-v1` en `src/modules/invoices/server/gemini.ts`.
- Salida JSON validada en servidor. Importes como strings decimales; fechas y monedas restringidas. Valor sin evidencia descartado. Las evidencias son propuestas del modelo y deben contrastarse con el original.
- Guarda campos propuestos en `extracted_data`, nunca en los campos que autorizan un pago. Todo resultado queda `needs_review` y con `review_reasons` pendiente de confirmación.
- Auditoría de carga, inicio, éxito y fallo; solo códigos genéricos de error. No se imprimen documentos, respuestas del proveedor ni claves en logs propios.

## Límites de esta entrega

No incluye edición/confirmación de datos, asociación definitiva al proveedor/acuerdo, evaluación financiera desde la UI, aprobación, pago o reembolso. El siguiente bloque conectará la revisión y el RPC financiero 002. No se modifican saldos al extraer. No hay n8n/Make: las rutas Next.js orquestan el flujo.

No hay cola ni worker: si se cierra la página o la función vence, abre el detalle y reintenta pasados tres minutos. Tres fallos consumen los intentos permitidos; revisa configuración antes de reintentar. Un PDF diferente que describe la misma factura aún no se detecta como duplicado semántico: se verificará al confirmar proveedor y número.

La llamada remite el archivo a Google. Usa solo documentos ficticios para la demo. Un plan de Gemini de consumo no demuestra acceso ni cuota de esta API.

## Errores frecuentes

| Síntoma | Acción |
|---|---|
| No aparecen facturas / error de permisos | Comprueba migración 003, sesión y membresía de la empresa. |
| No puede subir `approver` | Inicia con `admin` u `operator`; esta restricción es intencional. |
| CONFIG | Configura API key e ID de modelo y reinicia/redeploy. |
| QUOTA | Revisa cuota del proyecto API; no cambies a ciegas de suscripción de chat. |
| MODEL | Selecciona un ID habilitado del catálogo de tu API key. |
| REQUEST | Revisa compatibilidad con `generateContent`, PDF y `responseFormat` JSON. |
| STORAGE | Comprueba bucket privado `payguard-invoices`, clave secreta y existencia del archivo. |
| Extracción en curso | Espera tres minutos antes de reintentar; no se lanza otra llamada mientras el lease esté vigente. |
| Factura sin ciertos campos | No se inventan: compara con el original; la edición llega en el siguiente bloque. |

## Validación realizada

- TypeScript, build de producción, 32 tests de reglas anteriores y 8 tests de validación de extracción.
- SQL 001/002/003 en PGlite con Auth/Storage simulados: regresión financiera y permisos, deduplicación, lease, rechazo de finalización falsificada y aislamiento RLS.
- HTTP de Next.js producción con Supabase/Storage/Gemini simulados: acceso anónimo, origen externo, rol, firma, carga, extracción, detalle, duplicado, cuota, reintento y factura no accesible.
- No se probó contra tu Supabase ni tu API key; no se verificó concurrencia real multisesión, un navegador completo ni Vercel. El primer PDF real es la prueba de integración pendiente.

## Commits atómicos sugeridos

```bash
git add supabase/migrations/202610170003_invoice_extraction.sql supabase/tests/extraction_checks.sql
git commit -m "feat(db): add transactional invoice extraction lifecycle"
git add src/lib/supabase/admin.ts src/modules/invoices src/app/api/invoices
git commit -m "feat(invoices): add private uploads and Gemini extraction"
git add src/app/invoices src/app/dashboard/page.tsx src/proxy.ts
git commit -m "feat(invoices): add upload and extraction review screens"
git add package.json .gitignore .env.example tsconfig.invoices-tests.json tests/extraction.test.mjs scripts/list-gemini-models.mjs examples/demo-invoice.html docs/invoice-extraction-setup.md
git commit -m "test(invoices): cover extraction validation and document setup"
git push origin main
```

Referencias oficiales consultadas:
- https://ai.google.dev/api/generate-content
- https://ai.google.dev/gemini-api/docs/structured-output
- https://ai.google.dev/gemini-api/docs/generate-content/document-processing
- https://ai.google.dev/gemini-api/docs/models
