import { authenticatedClient,checkOrigin,errorResponse,HttpError,UUID } from '@/modules/invoices/server/access';
import { processInvoice } from '@/modules/agent/server/process-invoice';
export const runtime='nodejs';
export const maxDuration=90;
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
 try{
  checkOrigin(request);const {id}=await params;if(!UUID.test(id))throw new HttpError(400,'Factura inválida.');
  const {client}=await authenticatedClient();
  return Response.json(await processInvoice(client,id),{headers:{'Cache-Control':'private, no-store'}});
 }catch(error){return errorResponse(error);}
}
