import { createHash } from 'node:crypto';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { MAX_FILE_SIZE, detectMime } from '@/modules/invoices/domain/extraction';
import { authenticatedClient, checkOrigin, errorResponse, HttpError, UUID } from '@/modules/invoices/server/access';
import { extractInvoice, ExtractionError, extractionMessages } from '@/modules/invoices/server/gemini';
export const runtime='nodejs';
export const maxDuration=90;
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}) {
  try {
    checkOrigin(request); const {id}=await params;
    if(!UUID.test(id)) throw new HttpError(400,'Factura inválida.');
    const {client}=await authenticatedClient();
    // Construct privileged client before acquiring a lease, so configuration failures are retryable.
    const admin=createSupabaseAdminClient();
    const {data:claim,error}=await client.rpc('payguard_claim_extraction',{p_invoice:id});
    if(error) throw new HttpError(403,'No tienes acceso para extraer esta factura o no está disponible.');
    if(claim.state==='completed') return Response.json({state:'completed'});
    if(claim.state!=='claimed') throw new HttpError(409,claim.state==='busy'?'La extracción está en curso. Espera tres minutos antes de reintentar.':claim.state==='rate_limit'?'Se alcanzó el límite de 30 extracciones por hora para esta empresa.':'Se alcanzó el límite de tres intentos para esta factura.');
    let result=null; let code:string|null=null;
    try {
      const stored=await admin.storage.from('payguard-invoices').download(claim.path);
      if(stored.error || !stored.data || stored.data.size>MAX_FILE_SIZE) throw new ExtractionError('STORAGE');
      const bytes=new Uint8Array(await stored.data.arrayBuffer());
      if(bytes.length!==claim.size || detectMime(bytes)!==claim.mime || createHash('sha256').update(bytes).digest('hex')!==claim.sha256) throw new ExtractionError('STORAGE');
      result=await extractInvoice(bytes,claim.mime);
    } catch(error) { code=error instanceof ExtractionError ? error.code : 'PROVIDER'; }
    const finished=await admin.rpc('payguard_finish_extraction',{p_invoice:id,p_lease:claim.lease,p_data:result,p_error:code});
    if(finished.error || finished.data!==true) throw new HttpError(503,'No se pudo guardar el resultado. Revisa la factura antes de reintentar.');
    if(code) throw new HttpError(502,extractionMessages[code] ?? 'La extracción falló.');
    return Response.json({state:'completed'},{headers:{'Cache-Control':'private, no-store'}});
  } catch(error) { return errorResponse(error); }
}
