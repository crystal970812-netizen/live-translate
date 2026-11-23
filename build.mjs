import {existsSync, readFileSync, mkdirSync, openSync, writeSync, closeSync, statSync, renameSync} from 'node:fs';
const model='public/vendor/sherpa/sherpa-onnx-wasm-main-vad-asr.data';
if(existsSync('model-parts/manifest.json')){
 const m=JSON.parse(readFileSync('model-parts/manifest.json','utf8'));
 if(!Number.isSafeInteger(m.parts)||m.parts<1||m.parts>200||!Number.isSafeInteger(m.bytes)||m.bytes<1)throw Error('Invalid model manifest');
 mkdirSync('public/vendor/sherpa',{recursive:true});
 const fd=openSync(model+'.building','w');
 try{for(let i=0;i<m.parts;i++){const b=readFileSync(`model-parts/sense-${String(i).padStart(3,'0')}.part`);let offset=0;while(offset<b.length)offset+=writeSync(fd,b,offset,b.length-offset);}}finally{closeSync(fd);}
 if(statSync(model+'.building').size!==m.bytes)throw Error('Incomplete model');
 renameSync(model+'.building',model);
}
for(const p of ['index.html','admin.html','cloud-admin.js','cloud-frontend.js','sw.js','asr-worker.js','mt-worker.js','sense-worker.js','vendor/opencc-cn2t.js','vendor/transformers.js','vendor/ort-wasm-simd-threaded.asyncify.mjs','vendor/ort-wasm-simd-threaded.asyncify.wasm','vendor/sherpa/sherpa-onnx-asr.js','vendor/sherpa/sherpa-onnx-wasm-main-vad-asr.js','vendor/sherpa/sherpa-onnx-wasm-main-vad-asr.wasm','vendor/sherpa/sherpa-onnx-wasm-main-vad-asr.data'])if(!existsSync('public/'+p))throw Error('Missing application asset: '+p);
console.log('Application pages, workers and model assets verified.');
