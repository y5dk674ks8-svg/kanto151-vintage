const CACHE='kanto151-v2-31';
const APP=['./','./index.html','./manifest.webmanifest','./offline.js','./card-vision.js?v=20261127-16'];
const OCR=['./assets/opencv.js','./assets/tesseract.min.js','./assets/worker.min.js','./assets/tesseract-core/index.js','./assets/tesseract-core/tesseract-core-lstm.js','./assets/tesseract-core/tesseract-core-lstm.wasm','./assets/tesseract-core/tesseract-core-lstm.wasm.js','./assets/tesseract-core/tesseract-core-simd-lstm.js','./assets/tesseract-core/tesseract-core-simd-lstm.wasm','./assets/tesseract-core/tesseract-core-simd-lstm.wasm.js','./assets/tesseract-core/tesseract-core-relaxedsimd-lstm.js','./assets/tesseract-core/tesseract-core-relaxedsimd-lstm.wasm','./assets/tesseract-core/tesseract-core-relaxedsimd-lstm.wasm.js','./assets/tessdata/eng.traineddata.gz'];
self.addEventListener('install',event=>{
 self.skipWaiting();
 event.waitUntil((async()=>{
  const cache=await caches.open(CACHE);
  await cache.addAll(APP);
  await Promise.all(OCR.map(async url=>{try{await cache.add(url)}catch(error){console.warn('OCR asset not cached:',url,error)}}));
 })());
});
self.addEventListener('activate',event=>{
 event.waitUntil((async()=>{
  const keys=await caches.keys();
  await Promise.all(keys.filter(key=>key.startsWith('kanto151-')&&key!==CACHE).map(key=>caches.delete(key)));
  await self.clients.claim();
 })());
});
self.addEventListener('fetch',event=>{
 const request=event.request;
 const url=new URL(request.url);
 if(request.method!=='GET'||url.origin!==self.location.origin)return;
 if(request.mode==='navigate'||request.destination==='document'){
  event.respondWith((async()=>{
   const cache=await caches.open(CACHE);
   try{
    const fresh=await fetch(request,{cache:'no-store'});
    if(fresh.ok)await cache.put('./index.html',fresh.clone());
    return fresh;
   }catch(error){
    return (await cache.match(request))||(await cache.match('./index.html'))||Response.error();
   }
  })());
  return;
 }
 event.respondWith((async()=>{
  const cache=await caches.open(CACHE);
  const cached=await cache.match(request);
  if(cached)return cached;
  try{
   const response=await fetch(request);
   if(response.ok)await cache.put(request,response.clone());
   return response;
  }catch(error){return cached||Response.error()}
 })());
});
