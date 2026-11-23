// 中文離線語音辨識背景執行緒：SenseVoice（專為中文設計，速度快）在本機執行
// 協定和 asr-worker.js 相同：load / transcribe → progress / ready / result / error
const BASE = new URL('./vendor/sherpa/', self.location.href).href;
let recognizer = null, ready = false, loadingP = null;
let pendingInterim = null; const finals = []; let busy = false;

self.Module = {
  locateFile: (p) => BASE + p,
  mainScriptUrlOrBlob: BASE + 'sherpa-onnx-wasm-main-vad-asr.js',
  setStatus: (s) => {
    const m = /\((\d+)\/(\d+)\)/.exec(s || '');
    if (m) postMessage({ type: 'progress', src: 'asr', status: 'progress_total', name: 'sense', file: 'sense-voice', loaded: +m[1], total: +m[2] });
  },
  print: () => {}, printErr: () => {},
};

function init() {
  if (loadingP) return loadingP;
  loadingP = new Promise((res, rej) => {
    self.Module.onRuntimeInitialized = () => {
      try {
        recognizer = mkRec('zh');
        // 暖機一次，避免第一句特別慢
        decode(new Float32Array(16000));
        ready = true; res();
      } catch (e) { rej(e); }
    };
    self.Module.onAbort = (w) => rej(new Error('辨識引擎啟動失敗：' + w));
    try {
      importScripts(BASE + 'sherpa-onnx-asr.js', BASE + 'sherpa-onnx-wasm-main-vad-asr.js');
    } catch (e) { rej(e); }
  });
  return loadingP;
}

let curLang = 'zh';
const mkRec = (lang) => new OfflineRecognizer({
  modelConfig: {
    debug: 0, numThreads: Math.min(4, Math.max(1, (self.navigator?.hardwareConcurrency || 2) - 1)), tokens: './tokens.txt',
    senseVoice: { model: './sense-voice.onnx', language: lang, useInverseTextNormalization: 1 },
  },
}, self.Module);
function decode(audio, lang) {
  if (lang && lang !== curLang && ['zh', 'en', 'ja', 'ko'].includes(lang)) {
    try { const r = mkRec(lang); recognizer.free(); recognizer = r; curLang = lang; } catch (_) {}
  }
  const s = recognizer.createStream();
  s.acceptWaveform(16000, audio);
  recognizer.decode(s);
  const r = recognizer.getResult(s);
  s.free();
  return (r.text || '').trim();
}

function pump() {
  if (busy || !ready) return;
  const job = finals.length ? finals.shift() : pendingInterim;
  if (!job) return;
  if (!job.final) pendingInterim = null;
  busy = true;
  try {
    const t0 = performance.now();
    const text = decode(job.audio, job.lang);
    postMessage({ type: 'result', id: job.id, final: job.final, text, ms: performance.now() - t0 });
  } catch (e) {
    postMessage({ type: 'error', src: 'asr', message: String(e?.message || e) });
  }
  busy = false;
  setTimeout(pump, 0);
}

onmessage = async (e) => {
  const m = e.data;
  try {
    if (m.type === 'load') { await init(); postMessage({ type: 'ready', src: 'asr', device: 'sense' }); pump(); }
    else if (m.type === 'transcribe') {
      if (m.final) finals.push(m); else pendingInterim = m;   // 只保留最新的即時片段
      pump();
    }
  } catch (err) {
    postMessage({ type: 'error', src: 'asr', fatal: m.type === 'load', message: String(err?.message || err) });
  }
};
