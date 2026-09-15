// Application adapter; upstream LGPL engine and APL model are separate replaceable files.
importScripts('./hanzi_lookup.js');
const ready = fetch('./hanzi_lookup_bg.wasm').then(r => {
  if (!r.ok) throw new Error('模型加载失败');
  return r.arrayBuffer();
}).then(bytes => wasm_bindgen(bytes));
ready.then(() => postMessage({type:'ready'})).catch(() => postMessage({type:'error', message:'手写模型没有加载成功，请重新打开手写区。'}));
self.onmessage = async ({data}) => {
  const {revision, strokes} = data;
  try {
    await ready;
    if (!Number.isSafeInteger(revision) || !Array.isArray(strokes) || strokes.length < 1 || strokes.length > 64 ||
        strokes.some(s => !Array.isArray(s) || s.length < 2 || s.length > 2048 || s.some(p => !Array.isArray(p) || p.length !== 2 || p.some(n => !Number.isFinite(n) || n < 0 || n > 255)))) throw new Error('轨迹无效');
    const matches = JSON.parse(wasm_bindgen.lookup(strokes, 10));
    postMessage({type:'result', revision, matches});
  } catch {
    postMessage({type:'error', revision, message:'这次没有识别成功，可以撤销或重新写。'});
  }
};
