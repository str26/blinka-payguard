import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import React from 'react';
const require=createRequire(import.meta.url);
const code=require('next/dist/compiled/babel/core').transformSync(fs.readFileSync(new URL('../src/lib/i18n/provider.tsx',import.meta.url),'utf8'),{filename:'provider.tsx',presets:[[require.resolve('next/babel'),{'preset-react':{runtime:'automatic'},'preset-env':{targets:{node:'current'}}}]],babelrc:false,configFile:false}).code;
function provider(protocol='https:'){
 const document={documentElement:{lang:'es'},cookie:''},updates=[];let refreshes=0;
 const exports={};const customRequire=id=>id==='react'?{...React,useState:v=>[v,next=>updates.push(next)],useEffect:fn=>fn(),useTransition:()=>[false,fn=>fn()]}:id==='next/navigation'?{useRouter:()=>({refresh:()=>refreshes++})}:id==='./translate'?{validLocale:v=>v==='en'?'en':'es',translate:v=>v}:id.startsWith('@babel/runtime/')?require('next/dist/compiled/'+id):require(id);
 vm.runInNewContext(code,{exports,require:customRequire,document,location:{protocol}});
 const node=exports.LanguageProvider({initialLocale:'es',children:null});return {choose:node.props.value.setLocale,document,updates,refreshes:()=>refreshes};
}
test('choosing English updates document language and persists preference for all routes',()=>{const p=provider();p.choose('en');assert.equal(p.document.documentElement.lang,'en');assert.equal(p.updates[0],'en');assert.match(p.document.cookie,/payguard-locale=en; Path=\/; Max-Age=31536000; SameSite=Lax; Secure/);assert.equal(p.refreshes(),1);});
test('Spanish can be selected again on local HTTP without a Secure-only cookie',()=>{const p=provider('http:');p.choose('es');assert.match(p.document.cookie,/payguard-locale=es;/);assert.doesNotMatch(p.document.cookie,/; Secure/);});
test('unsupported preference cannot inject cookie attributes',()=>{const p=provider();p.choose('en; other=value');assert.match(p.document.cookie,/^payguard-locale=es;/);assert.doesNotMatch(p.document.cookie,/other=value/);});
