// Cloud pages must never cache account or draft responses.
const CACHE = 'lt-cloud-shell-v1';
const ASSETS = ['asr-worker.js','mt-worker.js','sense-worker.js','vendor/opencc-cn2t.js','vendor/transformers.js','vendor/ort-wasm-simd-threaded.asyncify.mjs','vendor/ort-wasm-simd-threaded.asyncify.wasm'];
self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('lt-offline-')).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url);
 if(event.request.method!=='GET'||url.origin!==self.location.origin)return;
 const relative=url.pathname.slice(new URL(self.registration.scope).pathname.length);
 if(!ASSETS.includes(relative))return;
 event.respondWith((async()=>{const cache=await caches.open(CACHE);const old=await cache.match(event.request);if(old)return old;const response=await fetch(event.request);if(response.ok)await cache.put(event.request,response.clone());return response;})());
});
