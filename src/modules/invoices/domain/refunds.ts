export type RefundInput={request_id:string;amount:string;reason:string};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Exact arithmetic is used only to display ledger totals; financial authority stays in PostgreSQL.
export function minorUnits(value:string):bigint {
 if(typeof value!=='string'||!/^(0|[1-9]\d{0,17})(\.\d{1,2})?$/.test(value))throw new Error('Importe decimal inválido.');
 const [whole,decimal='']=value.split('.');return BigInt(whole)*100n+BigInt(decimal.padEnd(2,'0'));
}
export function decimalAmount(value:bigint):string {
 if(value<0n)throw new Error('Importe negativo.');
 return `${value/100n}.${String(value%100n).padStart(2,'0')}`;
}
export function refundSummary(paid:string,refunds:readonly string[]){
 const original=minorUnits(paid);const refunded=refunds.reduce((sum,value)=>sum+minorUnits(value),0n);
 if(refunded>original)throw new Error('Los reembolsos exceden el pago original.');
 return {paid:decimalAmount(original),refunded:decimalAmount(refunded),remaining:decimalAmount(original-refunded)};
}
export function validateRefund(raw:unknown):RefundInput {
 if(typeof raw!=='object'||raw===null||Array.isArray(raw))throw new Error('Solicitud de reembolso inválida.');
 const r=raw as Record<string,unknown>;
 if(typeof r.request_id!=='string'||!uuid.test(r.request_id))throw new Error('Identificador de solicitud inválido.');
 if(typeof r.amount!=='string'||minorUnits(r.amount)<=0n)throw new Error('Escribe un importe positivo con punto decimal, por ejemplo 200.00.');
 if(typeof r.reason!=='string'||!r.reason.trim()||r.reason.length>1000)throw new Error('Escribe un motivo de 1 a 1000 caracteres.');
 return {request_id:r.request_id,amount:r.amount,reason:r.reason.trim()};
}
