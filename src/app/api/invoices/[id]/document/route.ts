import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { authenticatedClient,errorResponse,HttpError,UUID } from '@/modules/invoices/server/access';
export const runtime='nodejs';
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}) {
  try {
    const {id}=await params;
    if(!UUID.test(id)) throw new HttpError(404,'Factura no disponible.');
    const {client}=await authenticatedClient();
    // Both reads enforce tenant RLS before any privileged Storage request.
    const invoice=await client.from('invoices').select('document_id').eq('id',id).maybeSingle();
    if(invoice.error || !invoice.data) throw new HttpError(404,'Factura no disponible.');
    const document=await client.from('documents').select('storage_path').eq('id',invoice.data.document_id).single();
    if(document.error) throw new HttpError(404,'Documento no disponible.');
    const signed=await createSupabaseAdminClient().storage.from('payguard-invoices').createSignedUrl(document.data.storage_path,60);
    if(signed.error) throw new HttpError(503,'No se pudo abrir el documento.');
    return new Response(null,{status:303,headers:{Location:signed.data.signedUrl,'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer'}});
  } catch(error) {return errorResponse(error);}
}
