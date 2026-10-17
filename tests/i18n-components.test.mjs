import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
const require=createRequire(import.meta.url),root=fileURLToPath(new URL('../',import.meta.url));
const babel=require('next/dist/compiled/babel/core');
function load(relative,locale='en'){
 const filename=path.resolve(root,relative);const exports={};
 const customRequire=id=>{
  if(id==='@/lib/i18n/server')return {getI18n:async()=>({locale,t:value=>load('src/lib/i18n/translate.ts',locale).translate(value,locale)})};
  if(id==='@/lib/i18n/provider')return {useI18n:()=>({locale,t:value=>load('src/lib/i18n/translate.ts',locale).translate(value,locale),setLocale:()=>{},pending:false})};
  if(id==='next/navigation')return {useRouter:()=>({refresh:()=>{},push:()=>{}})};
  if(id.endsWith('.css'))return new Proxy({},{get:(_,key)=>String(key)});
  if(id.startsWith('@babel/runtime/'))return require('next/dist/compiled/'+id);
  if(id.startsWith('@/'))return load('src/'+id.slice(2)+'.ts',locale);
  if(id.startsWith('.')){const target=path.resolve(path.dirname(filename),id);return target.endsWith('.json')?JSON.parse(fs.readFileSync(target,'utf8')):load(path.relative(root,target)+'.ts',locale);}
  return require(id);
 };
 const code=babel.transformSync(fs.readFileSync(filename,'utf8'),{filename,presets:[[require.resolve('next/babel'),{'preset-react':{runtime:'automatic'},'preset-env':{targets:{node:'current'}}}]],babelrc:false,configFile:false}).code;
 vm.runInNewContext(code,{exports,require:customRequire});return exports;
}
const render=(component,props)=>renderToStaticMarkup(React.createElement(component,props));
test('English financial controls show approval continuation without a manual pay action',()=>{
 const C=load('src/app/invoices/[id]/financial-actions.tsx').default;
 const html=render(C,{id:'invoice-1',status:'pending_approval',role:'admin',decisionId:'decision-1',agentEnabled:true});
 assert.match(html,/Approve and continue with agent/);assert.match(html,/Reason for approval or rejection/);assert.doesNotMatch(html,/Ejecutar pago|Aprobar y continuar/);
});
test('English review fields preserve original supplier names and canonical amounts',()=>{
 const C=load('src/app/invoices/[id]/review-form.tsx').default;
 const html=render(C,{id:'invoice-1',version:1,agentEnabled:true,initial:{supplier_id:'supplier-1',agreement_id:'agreement-1',invoice_number:'MC261017-COP-01',currency:'COP',amount:'1000000.00',issue_date:'2026-10-17',due_date:'2026-10-20'},suppliers:[{id:'supplier-1',name:'Proveedor Demo Pendiente',code:'DEMO-NEW',allowed:false}],agreements:[]});
 assert.match(html,/Invoice number/);assert.match(html,/Confirm correction and resume agent/);assert.match(html,/Proveedor Demo Pendiente/);assert.match(html,/1000000.00/);
});
test('English refund form retains the exact refundable amount',()=>{const C=load('src/app/invoices/[id]/refund-form.tsx').default;const html=render(C,{id:'invoice-1',currency:'MXN',remaining:'0.01'});assert.match(html,/Record refund received/);assert.match(html,/Refund reason/);assert.match(html,/value="0.01"/);});
test('English agent trace includes the exact funds shortfall',async()=>{
 const C=load('src/app/invoices/[id]/agent-panel.tsx').default;
 const element=await C({run:{id:'run-1',state:'review',source:'extraction',actor_id:'user-1',steps:[{tool:'evaluate_rules',outcome:'review',message:'Una regla bloquea el pago y requiere revisión.'}],reasons:['Fondos insuficientes. Requerido: USD 1500.00. Disponible: USD 1300.00. Faltante: USD 200.00. No se ejecutó el pago.'],created_at:'2026-10-17T10:00:00Z'}});
 const html=renderToStaticMarkup(element);assert.match(html,/The agent requests human review/);assert.match(html,/Shortfall: USD 200.00/);assert.doesNotMatch(html,/Fondos insuficientes/);
});
test('English rule table localizes labels and server-provided criteria',async()=>{
 const C=load('src/app/invoices/[id]/decision-panel.tsx').default;
 const element=await C({decision:{id:'d1',status:'blocked',invoice_version:1,checks:[{code:'FUNDS',outcome:'block',message:'Beneficiario permitido por la empresa.'}],input_snapshot:{available_funds:'1300.00',available_budget:'4000.00',budget_period:'2026-10-01'},created_at:'2026-10-17',policy_currency:'USD',policy_version:'1',automatic_limit:'1000.00',absolute_limit:'3000.00'},version:1,reservation:null,invoiceStatus:'blocked',company:'company-1'});
 const html=renderToStaticMarkup(element);assert.match(html,/Available funds/);assert.match(html,/Beneficiary allowed by the company/);assert.match(html,/Blocked/);
});
test('English locale is visibly selected in the language control',()=>{const C=load('src/components/language-control.tsx').default;const html=render(C,{});assert.match(html,/aria-label="Language"/);assert.match(html,/value="en" selected=""/);});
