# Login y consulta protegida

## Instalar archivos

Extraer el paquete en la raiz del proyecto. Actualiza package.json/package-lock.json, agrega clientes de Supabase SSR, proxy de sesion, login, dashboard, estilos aislados y un enlace de acceso en la pagina inicial. No modifica claves ni migraciones anteriores.

Ejecutar:

```bash
npm ci
npm run typecheck
npm test
npm run build
npm run dev
```

Necesita NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY en .env.local y en Vercel. No se utiliza SUPABASE_SECRET_KEY ni GEMINI_API_KEY en el login o las consultas del dashboard.

## Crear usuarios propios de la aplicacion

1. Supabase > proyecto > Authentication > Users > Add user > Create new user.
2. Crear dos cuentas con contrasenas que ustedes elijan y conserven privadamente; usar la opcion de confirmar el correo automaticamente para estas cuentas de prueba si esta disponible. No es necesario enviar invitaciones de email ni configurar SMTP para este acceso con password.
3. Elegir una cuenta administradora y otra aprobadora. Copiar sus User UID de Auth.
4. Abrir supabase/setup/assign_demo_members.sql y reemplazar REEMPLAZA_UUID_ADMIN y REEMPLAZA_UUID_APPROVER por los UUID correspondientes. Ejecutar en SQL Editor. Los placeholders no son UUID validos: no ejecutar sin sustituirlos.
5. Verificar la tabla final. El script no cambia roles preexistentes al repetirse; si ya habia una membresia, revisar el rol mostrado.

El usuario Owner/Developer de la organizacion Supabase no equivale a estas cuentas. La aplicacion NO ofrece registro publico ni asigna roles desde el navegador.

Los roles guardados en company_members se consultan en la base. El dashboard es de lectura para ambos. Las acciones de aprobacion/pago se incorporaran despues, con permisos comprobados tambien por el RPC.

## Probar

- Abrir http://localhost:3000/login e iniciar sesion con una cuenta de Auth, no con credenciales del dashboard Supabase.
- Debe redirigir a /dashboard y mostrar Atlas Demo Global LLC, rol, wallets, politicas activas y presupuestos que efectivamente devuelva Supabase.
- Si indica que falta empresa, el login funciono pero falta la membresia; el UUID se muestra para completar su asignacion.
- Sin sesion, /dashboard redirige a /login.
- Al cerrar sesion, volver a /dashboard debe requerir acceso otra vez.
- Si hay error de consulta, no se sustituyen los datos por mocks: revisar migraciones, permisos RLS y variables.
- Elegir una empresa ajena mediante el parametro company no permite ver sus datos.

## Vercel

Despues de subir los archivos, verificar las variables publicas y desplegar. /login y /dashboard usan renderizado dinamico. Las respuestas protegidas no deben cachearse por CDN. En produccion las cookies son Secure, HttpOnly y SameSite=Lax; localmente Secure se desactiva en npm run dev.

Se autentica mediante correo/password. No hay callback OAuth o enlace magico que configurar para este flujo. Registro, recuperacion de password y onboarding publico quedan fuera de esta entrega.

## Evidencia de prueba

Pasaron TypeScript, los 32 tests existentes del dominio y la compilacion Next.js. Pruebas HTTP sobre la compilacion de produccion, con un servidor Supabase simulado:
- visitante redirigido al login;
- credenciales incorrectas muestran error generico;
- acceso correcto guarda sesion y consulta datos con el JWT del usuario;
- respuesta protegida no cacheable;
- empresa no autorizada no muestra saldos;
- cuenta sin membresia no muestra datos empresariales;
- cierre de sesion elimina acceso.

El servidor simulado no equivale a probar Supabase real, email, refresh de tokens vencidos o el servicio PostgREST en produccion. La comprobacion real se hace con las cuentas creadas por ustedes. Los tests HTTP usaron transporte local con una politica de cookies de prueba; el codigo de produccion conserva Secure.

## Estado del producto

Esta entrega agrega login y lectura de wallets/politicas/presupuestos. No hay botones que simulen operaciones inexistentes. La carga de documentos, extraccion Gemini y ejecucion del RPC se integraran en la siguiente etapa.

## Commit

```bash
git add package.json package-lock.json src/lib/supabase src/proxy.ts src/app/login src/app/dashboard src/app/workspace.module.css src/app/page.tsx supabase/setup/assign_demo_members.sql docs/auth-setup.md
git commit -m "feat(auth): add sign-in and protected company dashboard"
git push origin main
```

El archivo de asignacion puede conservar placeholders en Git; editar los UUID localmente para ejecutarlo. No poner passwords ni claves en ese archivo.
