// Prints model IDs only; never logs the API key or provider response bodies.
const key=process.env.GEMINI_API_KEY;
if(!key){console.error('Falta GEMINI_API_KEY en .env.local');process.exit(1);}
try {
 let page='';const models=[];
 do {
  const url=new URL('https://generativelanguage.googleapis.com/v1beta/models');
  if(page)url.searchParams.set('pageToken',page);
  const response=await fetch(url,{headers:{'x-goog-api-key':key},signal:AbortSignal.timeout(15000)});
  if(!response.ok){console.error(`No se pudo consultar el catálogo (HTTP ${response.status}).`);process.exit(1);}
  const body=await response.json();
  models.push(...(body.models??[]).filter(m=>m.supportedGenerationMethods?.includes('generateContent') && /^models\/gemini-/.test(m.name)).map(m=>m.name.replace('models/','')));
  page=body.nextPageToken??'';
 }while(page);
 console.log(models.join('\n'));
 console.log('\nElige un modelo multimodal que admita PDF y salida JSON estructurada. El catálogo no verifica cuota ni una generación real.');
}catch{console.error('No se pudo conectar con el catálogo de Gemini.');process.exit(1);}
