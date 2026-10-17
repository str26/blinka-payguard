import { authenticatedClient,checkOrigin,errorResponse,HttpError,UUID } from '@/modules/invoices/server/access';
import { validateReview } from '@/modules/invoices/domain/review';
export const runtime='nodejs';
export const maxDuration=30;
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}) {
 try {
  checkOrigin(request);const {id}=await params;
  if(!UUID.test(id))throw new HttpError(400,'Factura inválida.');
  const {client}=await authenticatedClient();
  // Bound the actual stream, not a spoofable Content-Length header.
  const reader=request.body?.getReader();if(!reader)throw new HttpError(400,'Faltan los datos.');
  const chunks:Uint8Array[]=[];let size=0;
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>8192){await reader.cancel();throw new HttpError(413,'La revisión excede el tamaño permitido.');}chunks.push(value);}
  let input;
  try{input=validateReview(JSON.parse(Buffer.concat(chunks).toString('utf8')));}catch(error){throw new HttpError(400,error instanceof Error?error.message:'Datos inválidos.');}
  const {data,error}=await client.rpc('payguard_confirm_invoice',{
   p_invoice:id,p_request:input.request_id,p_version:input.version,p_supplier:input.supplier_id,p_agreement:input.agreement_id,
   p_number:input.invoice_number,p_currency:input.currency,p_amount:input.amount,p_issue:input.issue_date,p_due:input.due_date,p_acknowledged:input.acknowledged,
  });
  if(error){
   if(error.code==='42501')throw new HttpError(403,'La revisión requiere rol admin u operator de esta empresa.');
   if(error.code==='40001' || error.code==='55000')throw new HttpError(409,'La factura cambió o ya no se puede editar. Recarga y revisa su estado.');
   if(error.code==='23505')throw new HttpError(409,'Ya existe ese número de factura para el proveedor. No se creó otra reserva.');
   if(error.code==='22023' || error.code==='23503' || error.code==='22007' || error.code==='22008')throw new HttpError(400,'Revisa los campos, la confirmación y la relación entre proveedor, moneda y acuerdo.');
   throw new HttpError(503,'No se pudo confirmar y evaluar. Verifica la migración 004 y vuelve a intentar con la misma solicitud.');
  }
  return Response.json(data,{headers:{'Cache-Control':'private, no-store'}});
 }catch(error){return errorResponse(error);}
}
