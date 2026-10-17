// Run locally or in a trusted terminal. Never expose this check as a public route.
const names = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "SUPABASE_SECRET_KEY", "GEMINI_API_KEY"];
const missing = names.filter((name) => !process.env[name]?.trim());
if (missing.length) {
  console.error(`Faltan variables: ${missing.join(", ")}`);
  process.exit(1);
}
const base = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL);
if (base.protocol !== "https:" || !base.hostname.endsWith(".supabase.co") || base.username || base.password) {
  console.error("La URL debe ser la URL HTTPS del proyecto alojado en Supabase.");
  process.exit(1);
}
async function check(label, url, headers) {
  try {
    const response = await fetch(url, { headers, signal: AbortSignal.timeout(20000), redirect: "error" });
    const ok = response.ok;
    console.log(`${label}: ${ok ? "OK" : "ERROR"} (HTTP ${response.status})`);
    if (!ok) process.exitCode = 1;
  } catch {
    console.error(`${label}: error de conexión o tiempo de espera.`);
    process.exitCode = 1;
  }
}
await check("Supabase Auth / clave publicable", new URL("/auth/v1/settings", base), { apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY });
await check("Supabase Data API / clave secreta", new URL("/rest/v1/", base), { apikey: process.env.SUPABASE_SECRET_KEY });
await check("Gemini / acceso al catálogo de modelos", "https://generativelanguage.googleapis.com/v1beta/models", { "x-goog-api-key": process.env.GEMINI_API_KEY });
console.log("Estos controles no verifican tablas, permisos RLS, Storage, extracción ni cuota de generación. No se imprimen credenciales ni respuestas de los servicios.");
