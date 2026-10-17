function object(v:unknown):Record<string,unknown>{return v!==null&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{};}
function cents(v:unknown):bigint|null {
 if(typeof v==='number'&&Number.isSafeInteger(v)&&v>=0)v=String(v);
 if(typeof v!=='string'||!/^\d{1,18}(\.\d{1,2})?$/.test(v))return null;
 const [whole,fraction='']=v.split('.');return BigInt(whole)*100n+BigInt(fraction.padEnd(2,'0'));
}
function decimal(v:bigint):string{return `${v/100n}.${String(v%100n).padStart(2,'0')}`;}
// Describe the authoritative decision snapshot, never a browser-selected balance.
export function liquidityAlerts(checks:unknown,inputSnapshot:unknown):string[]{
 const snapshot=object(inputSnapshot),invoice=object(snapshot.invoice);
 const amount=cents(invoice.amount),currency=invoice.currency;
 const rows=Array.isArray(checks)?checks.map(object):[];
 return rows.filter(c=>c.outcome==='block'&&(c.code==='FUNDS'||c.code==='BUDGET')).map(c=>{
  const subject=c.code==='FUNDS'?'Fondos insuficientes':'Presupuesto insuficiente';
  const available=cents(snapshot[c.code==='FUNDS'?'available_funds':'available_budget']);
  if(amount===null||available===null||amount<=available||typeof currency!=='string'||!['USD','COP','MXN'].includes(currency))return `${subject} según la última evaluación. No se ejecutó el pago. Reevalúa las reglas para actualizar los importes.`;
  return `${subject}. Requerido: ${currency} ${decimal(amount)}. Disponible: ${currency} ${decimal(available)}. Faltante: ${currency} ${decimal(amount-available)}. No se ejecutó el pago.`;
 });
}
