# Español e inglés — entrega 010

## Aplicar

1. Extraer este ZIP sobre la actualización visual 009 con las correcciones financieras 008 ya instaladas. Incluye también el componente y CSS de recuperación del botón entregado después de 009. Revisar cambios propios en los mismos archivos antes de sustituirlos.
2. Ejecutar `npm run build` y `npm run dev`.
3. En la presentación, el acceso o la barra superior del panel, seleccionar **English**. Cambia la interfaz; al volver a seleccionar **Español** se recupera ES.
4. Comprobar navegación y recarga: el idioma debe persistir en el mismo navegador y dominio. Localhost y Vercel tienen preferencias independientes.
5. Tras revisar, ejecutar `bash scripts/commit-i18n.sh` y `git push origin main`. Esperar al nuevo despliegue Ready en Vercel.

No requiere npm install, variables nuevas ni migraciones. No volver a ejecutar SQL. La selección de idioma no llama al agente ni aprueba ni paga facturas.

## Cobertura

- Selector visible Español / English, compatible con apariencia clara/oscura/sistema.
- Presentación, acceso, menú lateral, dashboard y sus vistas, carga/listado de facturas, detalle, reglas, traza del agente, revisión, aprobación, cancelación, reintento y reembolsos.
- Etiquetas, botones, filtros, atributos accesibles, mensajes de validación y errores conocidos recibidos de la API.
- Mensajes de fondos/presupuesto insuficientes con importes exactos. Ejemplo: `Insufficient funds. Required: USD 1500.00. Available: USD 1300.00. Shortfall: USD 200.00. No payment was executed.`
- Importes de tarjetas y tablas del dashboard: separadores de presentación es-CO / en-US sin convertir moneda ni usar floats para cálculo financiero. Formularios siguen aceptando el formato decimal canónico con punto; la etiqueta inglesa lo indica.
- Fechas de auditoría/comprobantes con formato de la selección y zona America/Bogota explícita. Fechas y valores originales del documento permanecen intactos.
- html lang y metadatos se sirven según la preferencia. Las páginas que dependen del idioma pasan a renderizado dinámico.

## Datos originales

Proveedor, archivo, número, referencia, moneda, importe, evidencia de Gemini, avisos originales del documento y razones escritas por personas no se traducen automáticamente. Se conserva el texto original para no alterar evidencia ni auditoría. Los mensajes del motor que forman parte del catálogo se presentan traducidos; textos futuros/desconocidos se muestran literalmente en su idioma original, sin traducciones inventadas. No se usa un servicio de traducción externo.

Los estados y códigos de la API/base de datos no cambian. La traducción ocurre en la presentación. Los importes del faltante conservan sus cadenas decimales. No se modifican acuerdos, roles, límites, reservas, pagos, reembolsos ni idempotencia.

## Preferencia y renderizado

El selector guarda `payguard-locale=es|en` en una cookie local al dominio, con Path=/, SameSite=Lax y un año de duración; Secure cuando se sirve por HTTPS. Solo contiene idioma. No contiene credenciales ni datos financieros. La selección actualiza los componentes cliente y refresca los componentes de servidor para que ambos idiomas sean coherentes. Solo se admiten es y en; un valor inválido vuelve a es.

## Validación

- Build de producción y TypeScript correctos.
- 64 pruebas de dominio previas correctas.
- 23 pruebas de catálogo, importes exactos, componentes financieros, selección/persistencia y reintento correctas.
- 18 comprobaciones HTTP de producción local con Supabase simulado: ocho rutas/vistas en es/en, selección servida desde cookie, html lang, formato USD en inglés, protección sin sesión y valor de idioma inválido.
- API, lógica de dominio, agente del servidor y SQL comparados con la base anterior: sin cambios.
- No se probó con las claves o la sesión de Supabase del usuario. La prueba visual e interactiva final en navegador y el pago end-to-end en Vercel quedan pendientes tras aplicar. Las pruebas de persistencia de cliente son pruebas de componente, no una sesión de navegador real.

```bash
node --test tests/i18n*.test.mjs tests/retry-button-render.test.mjs
npm run build
```

## Checklist en Vercel

- Seleccionar English desde `/`, abrir login y entrar al panel: conservar English.
- Ver “Your operations, under control.”, “Upload invoice” y “Rules and agreements”.
- Abrir una factura pagada existente: “Simulated payment completed”; conservar movimiento e importe, sin nuevo pago por cambiar idioma.
- Abrir una pendiente: “Approve and continue with agent”; comprobar las etiquetas y el motivo antes de actuar.
- Abrir una bloqueada por fondos: “Insufficient funds” con required/available/shortfall correctos.
- Recargar, navegar a otra vista y volver a Español.
- Comprobar menús y selectores desde móvil y ambos temas.
