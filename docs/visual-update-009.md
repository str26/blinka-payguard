# Renovación visual de PayGuard — entrega 009

## Aplicar

1. Partir del proyecto que ya tiene las entregas 001–008 y sus correcciones. Si tienes cambios propios en estos mismos archivos, revisar `git diff` antes de sustituirlos.
2. Extraer este ZIP en la raíz del repositorio, conservando la estructura de carpetas. No sustituye `.env.local`, package.json ni lockfile.
3. Ejecutar `npm run build` y `npm run dev`.
4. Abrir `/`, `/login`, `/dashboard`, `/invoices` y una factura existente. Verificar que en el detalle se mantienen mensajes de fondos insuficientes y controles del agente.
5. Guardar los commits indicados más abajo y subirlos. Vercel debe reconstruir el proyecto. No hay nuevas variables, dependencias o migraciones SQL. “009” identifica esta entrega visual; no es una migración.

## Diseño aplicado

Referencias: frontend(1).html, dashboard(1).html y SVG adjuntos. El enlace de Lovable proporcionado redirige a login en el navegador de verificación: no se pudo comparar su panel autenticado. La implementación sigue los HTML entregados, sin afirmar una réplica exacta del enlace.

- Papel #F7F7F4; tinta #1C253A; azul #2A4BD0; verde apagado #527A68; superficies blancas y líneas #DEDFDC.
- Logotipos SVG claro/oscuro y favicon adjuntos, conservados como archivos locales. PayGuard es un descriptor separado.
- Presentación con propuesta de valor, ejemplo ilustrativo explícitamente marcado y descripción del flujo ya implementado. Se elimina el texto antiguo de funciones pendientes.
- Menú lateral compartido, foco visible, acceso al contenido, panel lateral móvil que se cierra con Escape y navegación por enlaces.
- Tema claro, oscuro y sistema. Solo la preferencia de apariencia se guarda en localStorage. No se guardan facturas, saldos ni credenciales allí.
- Español en las vistas. No se agregó selector ES/EN: el backend, mensajes financieros y formularios existentes aún están en español. Inter se usa cuando está disponible; Arial/sistema como alternativa, sin descarga externa ni nueva dependencia.
- Adaptaciones responsivas previstas desde 360 px; revisión visual y de interacción final pendiente en navegador.

## Panel conectado

La página servidor verifica la sesión y pertenencia a empresa, consulta Supabase con el JWT y entrega datos autorizados al componente de presentación. No se usan las facturas Nimbus/Orbit/Delta, saldos ni motor de decisiones del HTML de referencia.

- Resumen: wallet disponible, contable y reservado; presupuesto vigente en America/Bogota; aprobación pendiente entre las últimas 100 facturas.
- Selector USD/COP/MXN: nunca suma o convierte monedas. Los importes se formatean como cadenas, sin operaciones con flotantes.
- Tabla con búsqueda y filtros sobre las últimas 100 facturas. Los conteos corresponden explícitamente a ese conjunto, no a la totalidad histórica.
- Las facturas sin moneda confirmada se consultan en Facturas, donde también aparecen pendientes de extracción.
- Revisión humana: pendientes de aprobación, revisión y bloqueos de la moneda seleccionada, con acceso al detalle existente.
- Reglas y acuerdos: política activa y beneficiarios registrados, solo lectura. No se agregó un editor de reglas ni cambios de seguridad.
- Registro: últimos 30 eventos, todas las monedas de la empresa; los detalles financieros continúan en cada factura.
- Ajustes: empresa, usuario, rol, estado del agente y cierre de sesión. No se agregaron botones ficticios para conectar bancos o gestionar roles.
- Facturas: carga real de máximo 3 MiB, tabla con búsqueda y filtros sobre los últimos 30 documentos. Se conserva el orquestador real y la extracción Gemini.
- Si falla una consulta de operaciones, se informa y no se presentan conteos incompletos como resultados válidos.

En una cuenta con varias empresas, usar el selector de empresa del panel. Los enlaces conservan el parámetro company donde está disponible; todos los accesos siguen requiriendo autorización del servidor y RLS.

## Qué permanece

Sin cambios en API, extracción Gemini, reglas SQL, idempotencia, aprobaciones, reservas, pagos simulados ni reembolsos. La vista de detalle conserva su código de comportamiento y recibe el nuevo estilo compartido, junto con la navegación lateral. No se ha cambiado Supabase ni se ha publicado nada.

## Verificación realizada

- Compilación de producción y TypeScript correctos.
- 64 pruebas de dominio existentes correctas: decisiones, extracción, revisión, acciones y reembolsos.
- Diez comprobaciones HTTP en producción local con Supabase simulado: presentación, login, resumen, revisión, reglas, auditoría, ajustes, listado, SVG y redirección del panel sin sesión.
- Los servicios simulados solo se usan para verificar y no forman parte del ZIP. No se usaron las claves del usuario ni se hicieron movimientos en su base.
- El navegador remoto no pudo acceder al servidor local (conexión rechazada). No se da por verificada la apariencia renderizada, el comportamiento móvil, el cambio de tema ni los filtros mediante interacción real. Comprobarlos tras aplicar y antes de la demo.
- Falta probar el pago end-to-end con el nuevo aspecto en Vercel; esta entrega no acredita esa prueba.

## Commits atómicos

Desde la raíz, tras revisar los cambios:

```bash
bash scripts/commit-visual.sh
git status
git push origin main
```

El script crea tres commits con rutas explícitas y `git commit --only`: marca/tema/navegación, páginas de operación y documentación. No incluye archivos ajenos ya preparados. Sí incluye cualquier modificación propia dentro de los archivos indicados; revisarlos antes.
