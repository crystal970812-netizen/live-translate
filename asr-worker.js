// 語音辨識背景執行緒：Whisper 在瀏覽器本機執行
import { pipeline, env } from './vendor/transformers.js';

env.allowLocalModels = false;
// 沙盒網址沒有瀏覽器快取可用，改為只放記憶體
env.useBrowserCache = self.origin !== 'null';
env.backends.onnx.wasm.wasmPaths = {
  mjs: new URL('./vendor/ort-wasm-simd-threaded.asyncify.mjs', import.meta.url).href,
  wasm: new URL('./vendor/ort-wasm-simd-threaded.asyncify.wasm', import.meta.url).href,
};

let asr = null, device = 'wasm', loadedModel = null;
let pendingInterim = null;
const finals = [];
let busy = false;

const progress = (p) => postMessage({ type: 'progress', src: 'asr', ...pick(p) });
function pick(p) { return { status: p.status, file: p.file, loaded: p.loaded, total: p.total, name: p.name }; }

async function make(model, dev) {
  let dtype;
  if (dev === 'webgpu') {
    const ad = await navigator.gpu.requestAdapter();
    const f16 = ad && ad.features.has('shader-f16');
    const big = model.includes('large');
    dtype = big ? { encoder_model: f16 ? 'fp16' : 'q4', decoder_model_merged: 'q4' }
                : { encoder_model: (model.includes('small') && f16) ? 'fp16' : 'fp32', decoder_model_merged: 'q4' };
  } else {
    dtype = { encoder_model: 'q8', decoder_model_merged: 'q8' };
  }
  return pipeline('automatic-speech-recognition', model, { device: dev, dtype, progress_callback: progress });
}

async function load(model, forceCpu) {
  if (asr && loadedModel === model) { postMessage({ type: 'ready', src: 'asr', device }); return; }
  let gpuOk = false;
  if (!forceCpu && self.navigator?.gpu) {
    try { gpuOk = !!(await navigator.gpu.requestAdapter()); } catch (_) {}
  }
  try {
    if (gpuOk) { device = 'webgpu'; asr = await make(model, 'webgpu'); }
    else throw new Error('no-gpu');
  } catch (e) {
    device = 'wasm'; asr = await make(model, 'wasm');
  }
  // 暖機一次，避免第一句特別慢
  await asr(new Float32Array(16000), { language: 'en', task: 'transcribe' });
  loadedModel = model;
  postMessage({ type: 'ready', src: 'asr', device });
}

async function pump() {
  if (busy || !asr) return;
  const job = finals.length ? finals.shift() : pendingInterim;
  if (!job) return;
  if (!job.final) pendingInterim = null;
  busy = true;
  try {
    const t0 = performance.now();
    const out = await asr(job.audio, { language: job.lang, task: 'transcribe' });
    postMessage({ type: 'result', id: job.id, final: job.final, text: (out.text || '').trim(), ms: performance.now() - t0 });
  } catch (e) {
    postMessage({ type: 'error', src: 'asr', message: String(e?.message || e) });
  }
  busy = false;
  pump();
}

onmessage = async (e) => {
  const m = e.data;
  try {
    if (m.type === 'load') await load(m.model, m.forceCpu);
    else if (m.type === 'transcribe') {
      if (m.final) { finals.push(m); }
      else pendingInterim = m;   // 只保留最新的即時片段
      pump();
    }
  } catch (err) {
    postMessage({ type: 'error', src: 'asr', fatal: m.type === 'load', message: String(err?.message || err) });
  }
};
