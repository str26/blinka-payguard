import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
const require=createRequire(import.meta.url);
const source=fs.readFileSync(new URL('../src/app/invoices/[id]/retry-button.tsx',import.meta.url),'utf8');
const compiled=require('next/dist/compiled/babel/core').transformSync(source,{filename:'retry-button.tsx',presets:[[require.resolve('next/babel'),{'preset-react':{runtime:'automatic'},'preset-env':{targets:{node:'current'}}}]],babelrc:false,configFile:false}).code;
function component({busy=false,error='',fetch=async()=>({ok:true,json:async()=>({status:'blocked'})})}={}){
 let index=0,refreshes=0;const updates=[];
 const customRequire=id=>id.startsWith('@babel/runtime/')?require('next/dist/compiled/'+id):id==='react'?{...React,useState:()=>[index++===0?busy:error,value=>updates.push(value)]}:id==='next/navigation'?{useRouter:()=>({refresh:()=>refreshes++})}:id.endsWith('.css')?{panel:'panel',row:'row',copy:'copy',button:'button',progress:'progress',error:'error'}:require(id);
 const exports={};vm.runInNewContext(compiled,{exports,require:customRequire,fetch});
 const element=exports.default({id:'invoice-1'});
 return {element,html:renderToStaticMarkup(element),updates,refreshes:()=>refreshes};
}
function findButton(element){if(!React.isValidElement(element))return null;if(element.type==='button')return element;for(const child of React.Children.toArray(element.props.children)){const b=findButton(child);if(b)return b;}return null;}
test('idle retry has context and no empty error box',()=>{const {html}=component();assert.match(html,/Reanudar procesamiento/);assert.match(html,/No sustituye la aprobación/);assert.doesNotMatch(html,/role="alert"/);assert.doesNotMatch(html,/<p[^>]*class="error"/);});
test('processing state disables button and announces progress without error styling',()=>{const {html}=component({busy:true});assert.match(html,/disabled=""/);assert.match(html,/role="status"/);assert.match(html,/aria-busy="true"/);assert.doesNotMatch(html,/role="alert"/);});
test('actual error produces a nonempty accessible alert',()=>{const {html}=component({error:'Servicio temporalmente no disponible.'});assert.match(html,/role="alert"[^>]*>Servicio temporalmente no disponible\./);});
test('retry preserves POST endpoint and refreshes invoice',async()=>{const calls=[];const r=component({fetch:async(...args)=>{calls.push(args);return {ok:true,json:async()=>({status:'blocked'})};}});await findButton(r.element).props.onClick();assert.deepEqual(JSON.parse(JSON.stringify(calls)),[['/api/invoices/invoice-1/extract',{method:'POST'}]]);assert.equal(r.refreshes(),1);});
test('failed response is retained as error and not silently discarded',async()=>{const r=component({fetch:async()=>({ok:false,json:async()=>({error:'Cuota agotada.'})})});await findButton(r.element).props.onClick();assert.ok(r.updates.includes('Cuota agotada.'));assert.equal(r.refreshes(),1);});
test('busy retry cannot send another request',async()=>{let calls=0;const r=component({busy:true,fetch:async()=>{calls++;throw Error();}});await findButton(r.element).props.onClick();assert.equal(calls,0);});
