import english from './en.json';
export type Locale='es'|'en';
export function validLocale(value:unknown):Locale{return value==='en'?'en':'es';}
const dictionary:Record<string,string>=english;
export function translate<T>(value:T,locale:Locale):T {
 if(locale==='es'||typeof value!=='string')return value;
 const key=value.trim().replace(/\s+/g,' ');let translated=dictionary[key];
 if(!translated){
  const funds=key.match(/^(Fondos|Presupuesto) insuficientes?\. Requerido: ([A-Z]{3} [0-9.]+)\. Disponible: ([A-Z]{3} [0-9.]+)\. Faltante: ([A-Z]{3} [0-9.]+)\. No se ejecutó el pago\.$/);
  if(funds)translated=`Insufficient ${funds[1]==='Fondos'?'funds':'budget'}. Required: ${funds[2]}. Available: ${funds[3]}. Shortfall: ${funds[4]}. No payment was executed.`;
  const rule=key.match(/^Regla ([A-Z_]+): (block|review|approval)$/);
  if(rule)translated=`Rule ${rule[1]}: ${{block:'blocked',review:'review required',approval:'approval required'}[rule[2]]}`;
  const result=key.match(/^Resultado: (.+)\.$/);
  if(result)translated=`Result: ${translate(result[1],locale)}.`;
  const refund=key.match(/^Reembolso simulado registrado: (.+)\.$/);
  if(refund)translated=`Simulated refund recorded: ${refund[1]}.`;
  for(const [prefix,en] of [['Advertencia de extracción: ','Extraction notice: '],['Campo o evidencia pendiente: ','Field or evidence missing: '],['Reembolso recibido simulado: ','Simulated refund received: ']] as const){if(key.startsWith(prefix))translated=en+key.slice(prefix.length);}
 }
 // Unknown document content, user input and future server messages remain verbatim.
 return (translated?value.replace(/\S[\s\S]*\S|\S/,translated):value) as T;
}
