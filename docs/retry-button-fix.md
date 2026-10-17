# Corrección visual del botón de reintento

Aplicar estos archivos sobre la actualización visual 009. No requiere SQL, variables ni dependencias nuevas.

- El contenedor rojo se renderizaba aun con error vacío. Ahora el aviso existe solo cuando hay un mensaje real.
- La acción se agrupa con un título y explicación; el botón se alinea a la derecha en escritorio y debajo en móvil.
- Se presenta como acción secundaria de recuperación, con texto sobre revalidación, posible pago simulado y aprobación independiente.
- El progreso tiene un estado accesible independiente, sin apariencia de error.
- Se conservan endpoint, método POST y actualización del estado. No cambia reglas financieras ni agrega pagos manuales.

Verificación: renderizado del componente en reposo, procesando y con error, junto con comprobación del destino/método de reintento. Compilación de producción correcta. La revisión interactiva final en navegador sigue pendiente.

```bash
npm run build
node --test tests/retry-button-render.test.mjs
git add 'src/app/invoices/[id]/retry-button.tsx' 'src/app/invoices/[id]/retry-button.module.css' docs/retry-button-fix.md tests/retry-button-render.test.mjs
git commit --only -m "fix(ui): group agent retry action and hide empty errors" -- 'src/app/invoices/[id]/retry-button.tsx' 'src/app/invoices/[id]/retry-button.module.css' docs/retry-button-fix.md tests/retry-button-render.test.mjs
git push origin main
```
