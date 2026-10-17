import { createHash, randomUUID } from 'node:crypto';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { MAX_FILE_SIZE, detectMime } from '@/modules/invoices/domain/extraction';
import { checkOrigin, errorResponse, HttpError, requireCompany } from '@/modules/invoices/server/access';
export const runtime='nodejs';
export const maxDuration=30;
export async function POST(request:Request) {
  try {
    checkOrigin(request);
    // Authorize before reading the potentially large multipart body.
    const company=new URL(request.url).searchParams.get('company') ?? '';
    const client=await requireCompany(company);
    const contentType=request.headers.get('content-type') ?? '';
    if (!contentType.startsWith('multipart/form-data;')) throw new HttpError(400,'Envía un archivo mediante el formulario.');
    const reader=request.body?.getReader();
    if (!reader) throw new HttpError(400,'Falta el archivo.');
    const chunks:Uint8Array[]=[]; let size=0;
    while(true) {
      const {done,value}=await reader.read(); if(done) break;
      size+=value.byteLength;
      if(size>MAX_FILE_SIZE+65536) { await reader.cancel(); throw new HttpError(413,'El archivo debe pesar como máximo 3 MiB.'); }
      chunks.push(value);
    }
    const form=await new Response(Buffer.concat(chunks),{headers:{'Content-Type':contentType}}).formData();
    const file=form.get('file');
    if (!(file instanceof File) || file.size===0 || file.size>MAX_FILE_SIZE) throw new HttpError(400,'Selecciona PDF, PNG o JPEG de hasta 3 MiB.');
    const bytes=Buffer.from(await file.arrayBuffer()); const mime=detectMime(bytes);
    if(!mime || file.type!==mime) throw new HttpError(400,'El contenido del archivo no coincide con un PDF, PNG o JPEG admitido.');
    const sha=createHash('sha256').update(bytes).digest('hex');
    // Identical bytes return the existing invoice, including after an interrupted response.
    const duplicate=await client.from('documents').select('id').eq('company_id',company).eq('sha256',sha).maybeSingle();
    if(duplicate.error) throw new HttpError(503,'No se pudo verificar si el archivo ya existe.');
    if(duplicate.data) {
      const existing=await client.from('invoices').select('id').eq('document_id',duplicate.data.id).single();
      if(existing.error) throw new HttpError(503,'No se pudo recuperar la factura existente.');
      return Response.json({id:existing.data.id,duplicate:true},{headers:{'Cache-Control':'private, no-store'}});
    }
    const admin=createSupabaseAdminClient(); const document=randomUUID(); const path=`${company}/${document}`;
    const uploaded=await admin.storage.from('payguard-invoices').upload(path,bytes,{contentType:mime,upsert:false});
    if(uploaded.error) throw new HttpError(503,'No se pudo guardar el archivo en Storage privado.');
    const result=await client.rpc('payguard_register_document',{p_company:company,p_document:document,p_name:file.name.replace(/[\x00-\x1f\x7f]/g,'').slice(0,200) || 'factura',p_mime:mime,p_size:bytes.length,p_sha:sha});
    if(result.error) {
      // A network error might hide a committed registration: never delete a referenced document.
      const registered=await admin.from('documents').select('id').eq('id',document).maybeSingle();
      if(!registered.error && !registered.data) await admin.storage.from('payguard-invoices').remove([path]);
      throw new HttpError(503,'No se pudo registrar la factura. Verifica la migración 003 o el límite de 30 archivos por hora.');
    }
    if(result.data.duplicate) await admin.storage.from('payguard-invoices').remove([path]);
    return Response.json(result.data,{status:201,headers:{'Cache-Control':'private, no-store'}});
  } catch(error) { return errorResponse(error); }
}
