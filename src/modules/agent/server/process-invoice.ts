import 'server-only';
import { createHash,randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { MAX_FILE_SIZE,detectMime } from '@/modules/invoices/domain/extraction';
import { HttpError } from '@/modules/invoices/server/access';
import { extractInvoice,ExtractionError,extractionMessages } from '@/modules/invoices/server/gemini';

// Server orchestration: Gemini extraction -> deterministic identification/rules -> authorized tool payment.
// The same authenticated identity reaches the RPC; the browser never supplies actor, payee or balance.
export async function processInvoice(client:SupabaseClient,id:string){
 const admin=createSupabaseAdminClient();
 const {data:claim,error}=await client.rpc('payguard_claim_extraction',{p_invoice:id});
 if(error)throw new HttpError(403,'No se puede procesar esta factura. Revisa el rol, la empresa y las migraciones.');
 if(claim.state!=='completed'){
  if(claim.state!=='claimed')throw new HttpError(409,claim.state==='busy'?'El procesamiento sigue en curso. Espera antes de reintentar.':claim.state==='rate_limit'?'Se alcanzó el límite de extracciones por hora.':'Se alcanzó el límite de tres intentos de extracción.');
  let result=null;let code:string|null=null;
  try{
   const stored=await admin.storage.from('payguard-invoices').download(claim.path);
   if(stored.error||!stored.data||stored.data.size>MAX_FILE_SIZE)throw new ExtractionError('STORAGE');
   const bytes=new Uint8Array(await stored.data.arrayBuffer());
   if(bytes.length!==claim.size||detectMime(bytes)!==claim.mime||createHash('sha256').update(bytes).digest('hex')!==claim.sha256)throw new ExtractionError('STORAGE');
   result=await extractInvoice(bytes,claim.mime);
  }catch(error){code=error instanceof ExtractionError?error.code:'PROVIDER';}
  const finished=await admin.rpc('payguard_finish_extraction',{p_invoice:id,p_lease:claim.lease,p_data:result,p_error:code});
  if(finished.error||finished.data!==true)throw new HttpError(503,'No se pudo guardar la extracción o la factura ya se cerró. Comprueba su estado.');
  if(code)throw new HttpError(502,extractionMessages[code]??'La extracción falló.');
 }
 const {data:outcome,error:agentError}=await client.rpc('payguard_run_agent',{p_invoice:id,p_request:randomUUID()});
 if(agentError)throw new HttpError(agentError.code==='42501'?403:503,'La extracción está guardada, pero el agente no pudo terminar. Verifica la migración 007, su habilitación y reintenta.');
 return {state:'completed',...outcome};
}
export async function continueAfterUpload(client:SupabaseClient,id:string){
 try{return {pipeline:await processInvoice(client,id)};}
 catch(error){return {pipeline_error:error instanceof HttpError?error.message:'El procesamiento no terminó. Consulta la factura y reintenta el agente.'};}
}
