import 'server-only';
import { createSupabaseServerClient } from '@/lib/supabase/server';
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export class HttpError extends Error { constructor(public status:number,message:string) { super(message); } }
export function checkOrigin(request: Request) {
  const supplied = request.headers.get('origin');
  let allowed = false;
  try {
    const origin = new URL(supplied ?? '');
    allowed = origin.host === request.headers.get('host') && origin.protocol === new URL(request.url).protocol;
  } catch { /* Missing or invalid Origin is rejected for cookie-authenticated mutations. */ }
  if (!allowed) throw new HttpError(403,'Origen de petición no permitido.');
}
export async function authenticatedClient() {
  const client = await createSupabaseServerClient();
  const { data:{user},error } = await client.auth.getUser();
  if (error || !user) throw new HttpError(401,'Inicia sesión de nuevo.');
  return {client,user};
}
export async function requireCompany(company:string) {
  if (!UUID.test(company)) throw new HttpError(400,'Empresa inválida.');
  const {client,user} = await authenticatedClient();
  const {data,error} = await client.from('company_members').select('role').eq('company_id',company).eq('user_id',user.id).maybeSingle();
  if (error) throw new HttpError(503,'No se pudieron verificar los permisos.');
  if (!data || !['admin','operator'].includes(data.role)) throw new HttpError(403,'La carga y extracción requieren rol admin u operator.');
  return client;
}
export function errorResponse(error:unknown) {
  return Response.json({error:error instanceof HttpError ? error.message : 'No se pudo completar la operación. Revisa la configuración del servidor.'},
    {status:error instanceof HttpError ? error.status : 500,headers:{'Cache-Control':'private, no-store'}});
}
