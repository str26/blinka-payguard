import { authenticatedClient,checkOrigin,errorResponse,HttpError,UUID } from '@/modules/invoices/server/access';
import { validateAction } from '@/modules/invoices/domain/actions';
export const runtime='nodejs';
export const maxDuration=30;
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}) {
 try {
  checkOrigin(request);const {id}=await params;
  if(!UUID.test(id))throw new HttpError(400,'Factura inválida.');
  const {client}=await authenticatedClient();
  const reader=request.body?.getReader();if(!reader)throw new HttpError(400,'Falta la solicitud.');
  const chunks:Uint8Array[]=[];let size=0;
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>8192){await reader.cancel();throw new HttpError(413,'Solicitud demasiado grande.');}chunks.push(value);}
  let input;
  try{input=validateAction(JSON.parse(Buffer.concat(chunks).toString('utf8')));}catch(error){throw new HttpError(400,error instanceof Error?error.message:'Solicitud inválida.');}
  const {data,error}=await client.rpc('payguard_process_invoice',{
   p_invoice:id,p_action:input.action,p_request:input.request_id,p_decision:input.decision_id,p_reason:input.reason,
  });
  if(error){
   if(error.code==='42501')throw new HttpError(403,'No tienes permiso para esta acción o la factura no está disponible.');
   if(['P0001','40001','55000','23505','22023'].includes(error.code))throw new HttpError(409,'La operación no se pudo aplicar: la factura, aprobación o solicitud cambió o ya fue procesada. Recarga y comprueba el estado.');
   throw new HttpError(503,'No se pudo confirmar la respuesta. Revisa el estado y reintenta con la misma solicitud si sigue pendiente.');
  }
  return Response.json(data,{headers:{'Cache-Control':'private, no-store'}});
 }catch(error){return errorResponse(error);}
}
