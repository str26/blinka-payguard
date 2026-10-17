import { authenticatedClient,checkOrigin,errorResponse,HttpError,UUID } from '@/modules/invoices/server/access';
import { validateRefund } from '@/modules/invoices/domain/refunds';
export const runtime='nodejs';
export const maxDuration=30;
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
 try{
  checkOrigin(request);const {id}=await params;
  if(!UUID.test(id))throw new HttpError(400,'Factura inválida.');
  const {client}=await authenticatedClient();const reader=request.body?.getReader();if(!reader)throw new HttpError(400,'Falta la solicitud.');
  const chunks:Uint8Array[]=[];let size=0;
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>8192){await reader.cancel();throw new HttpError(413,'Solicitud demasiado grande.');}chunks.push(value);}
  let input;
  try{input=validateRefund(JSON.parse(Buffer.concat(chunks).toString('utf8')));}catch(error){throw new HttpError(400,error instanceof Error?error.message:'Datos inválidos.');}
  const {data,error}=await client.rpc('payguard_refund_invoice',{p_invoice:id,p_request:input.request_id,p_amount:input.amount,p_reason:input.reason});
  if(error){
   if(error.code==='42501')throw new HttpError(403,'El reembolso requiere rol admin o approver de esta empresa.');
   if(error.code==='22023')throw new HttpError(409,'El importe excede lo pendiente de reembolso o la solicitud ya se usó con otros datos. Recarga y revisa el saldo reembolsable.');
   if(['55000','23505','22003','40001','P0001'].includes(error.code))throw new HttpError(409,'No se puede registrar el reembolso con el estado actual. Revisa el pago original y recarga.');
   throw new HttpError(503,'No se pudo confirmar el reembolso. Verifica la migración 006, recarga y reintenta con la misma solicitud si sigue pendiente.');
  }
  return Response.json(data,{headers:{'Cache-Control':'private, no-store'}});
 }catch(error){return errorResponse(error);}
}
