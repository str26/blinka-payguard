// Read-only installation checks. Never prints keys, records, documents or provider bodies.
const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
const publicKey=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const secret=process.env.SUPABASE_SECRET_KEY;
const gemini=process.env.GEMINI_API_KEY;
const model=process.env.GEMINI_MODEL;
if(!url||!publicKey||!secret||!gemini||!model){console.error('Faltan variables: revisa URL de Supabase, ambas claves, GEMINI_API_KEY y GEMINI_MODEL. No las compartas.');process.exit(1);}
try{const parsed=new URL(url);if(!['http:','https:'].includes(parsed.protocol))throw Error();}catch{console.error('La URL de Supabase no es válida.');process.exit(1);}
let failures=0;
function report(label,ok,status){console.log(`${ok?'OK':'FALLO'} | ${label}${status?` | HTTP ${status}`:''}`);if(!ok)failures++;}
async function get(target,headers){try{const response=await fetch(target,{headers,signal:AbortSignal.timeout(8000),redirect:'error'});let data=null;try{data=await response.json();}catch{/* No provider output is logged. */}return {ok:response.ok,status:response.status,data};}catch{return {ok:false,status:0,data:null};}}
const privileged={apikey:secret,...(secret.startsWith('eyJ')?{Authorization:`Bearer ${secret}`}:{})};
const publicHeaders={apikey:publicKey};
const tables={
 companies:'id,name,is_demo,agent_enabled',company_members:'company_id,user_id,role',suppliers:'id,company_id,code,allowed',agreements:'id,company_id,supplier_id,currency,amount',
 policies:'id,company_id,currency,version,automatic_limit,absolute_limit,active',wallets:'id,company_id,currency,balance,reserved,available',
 budgets:'id,company_id,currency,period,total,reserved,spent,available',documents:'id,company_id,storage_path,sha256,mime_type',
 invoices:'id,company_id,version,status,review_reasons,extraction_state,extraction_attempts,extraction_lease,extraction_error,extracted_data',
 decisions:'id,invoice_id,invoice_version,status,checks,input_snapshot,decision_order',approvals:'id,invoice_id,actor_id,action,reason',
 reservations:'id,invoice_id,decision_id,budget_id,wallet_id,currency,amount,status',wallet_movements:'id,invoice_id,wallet_id,original_movement_id,kind,currency,amount,idempotency_key',
 audit_events:'id,company_id,actor_id,event_type,entity_id',operation_requests:'company_id,request_id,actor_id,input,response',invoice_reviews:'company_id,request_id,invoice_id,actor_id,input,response',
};
tables.agent_runs='id,company_id,invoice_id,actor_id,request_id,invoice_version,state,steps,reasons,response';
const entries=Object.entries(tables);
for(let i=0;i<entries.length;i+=3){
 await Promise.all(entries.slice(i,i+3).map(async([name,columns])=>{
  const target=new URL(`/rest/v1/${name}`,url);target.searchParams.set('select',columns);target.searchParams.set('limit','0');
  const result=await get(target,privileged);report(`Esquema / ${name}`,result.ok&&Array.isArray(result.data),result.status);
 }));
}
const auth=await get(new URL('/auth/v1/settings',url),publicHeaders);report('Supabase Auth / configuración pública',auth.ok,auth.status);
const bucket=await get(new URL('/storage/v1/bucket/payguard-invoices',url),privileged);
report('Storage / bucket privado',bucket.ok&&bucket.data?.public===false,bucket.status);
let page='';let found=false;let catalogOk=true;let lastStatus=0;
for(let i=0;i<10;i++){
 const target=new URL('https://generativelanguage.googleapis.com/v1beta/models');if(page)target.searchParams.set('pageToken',page);
 const result=await get(target,{'x-goog-api-key':gemini});lastStatus=result.status;
 if(!result.ok){catalogOk=false;break;}
 found ||= (result.data?.models??[]).some(m=>m.name===`models/${model}`&&m.supportedGenerationMethods?.includes('generateContent'));
 page=result.data?.nextPageToken??'';if(!page||found)break;
}
report('Gemini / modelo configurado en catálogo generateContent',catalogOk&&found,lastStatus);
const args=process.argv.slice(2);
if(args.length){
 const index=args.indexOf('--url');
 if(index<0||!args[index+1]){console.error('Uso opcional: --url http://localhost:3000');failures++;}
 else{
  try{const target=new URL('/api/health',args[index+1]);const result=await get(target,{});report('Aplicación / health (solo proceso)',result.ok&&result.data?.status==='ok',result.status);}
  catch{report('Aplicación / URL inválida',false);}
 }
}
console.log('\nEstas comprobaciones no prueban permisos RLS del usuario, funciones SQL, generación Gemini ni movimientos financieros.');
console.log('Ejecuta supabase/tests/installation_readiness.sql y la secuencia manual de docs/demo-runbook.md.');
console.log(failures?`Resultado: ${failures} comprobaciones fallidas.`:'Resultado: comprobaciones de acceso y esquema correctas. Integración financiera pendiente de prueba manual.');
process.exitCode=failures?1:0;
