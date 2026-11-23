// 翻譯背景執行緒：開源翻譯模型在瀏覽器本機執行（不佔用語音辨識）
import { pipeline, env } from './vendor/transformers.js';

env.allowLocalModels = false;
// 沙盒網址沒有瀏覽器快取可用，改為只放記憶體
env.useBrowserCache = self.origin !== 'null';
env.backends.onnx.wasm.wasmPaths = {
  mjs: new URL('./vendor/ort-wasm-simd-threaded.asyncify.mjs', import.meta.url).href,
  wasm: new URL('./vendor/ort-wasm-simd-threaded.asyncify.wasm', import.meta.url).href,
};

const pipes = new Map();   // model id -> pipeline
let steps = [];            // [{model, opts}]
let chain = Promise.resolve();

const progress = (p) => postMessage({ type: 'progress', src: 'mt', status: p.status, file: p.file, loaded: p.loaded, total: p.total, name: p.name });

async function load(newSteps, sig) {
  for (const s of newSteps) {
    if (!pipes.has(s.model)) {
      const p = await pipeline('translation', s.model, { device: 'wasm', dtype: 'q8', progress_callback: progress });
      pipes.set(s.model, p);
    }
  }
  steps = newSteps;
  // 暖機
  await run('Hello.');
  postMessage({ type: 'ready', src: 'mt', sig });
}

async function run(text) {
  let t = text;
  for (const s of steps) {
    const out = await pipes.get(s.model)(t, { ...s.opts, max_new_tokens: 256 });
    t = out[0].translation_text;
  }
  return t;
}

onmessage = (e) => {
  const m = e.data;
  if (m.type === 'load') {
    chain = chain.then(() => load(m.steps, m.sig)).catch(err =>
      postMessage({ type: 'error', src: 'mt', fatal: true, message: String(err?.message || err) }));
  } else if (m.type === 'translate') {
    chain = chain.then(async () => {
      const t0 = performance.now();
      const text = await run(m.text);
      postMessage({ type: 'result', id: m.id, text, ms: performance.now() - t0 });
    }).catch(err => postMessage({ type: 'result', id: m.id, text: null, error: String(err?.message || err) }));
  }
};
