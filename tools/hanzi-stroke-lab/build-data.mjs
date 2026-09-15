// Run after obtaining the pinned upstream checkouts/Unihan described in SOURCES.md.
import { readFileSync, writeFileSync, readdirSync, mkdirSync, copyFileSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
const input = process.argv[2] || 'tmp/tasks/HANZI-STROKE-LAB';
const output = 'public/hanzi-stroke-lab';
const fields = new Map();
for (const file of ['Unihan_Readings.txt','Unihan_Variants.txt','Unihan_IRGSources.txt']) {
  for (const line of readFileSync(join(input,'Unihan',file),'utf8').split(/\r?\n/)) {
    const [cp, key, value] = line.split('\t');
    if (!/^U\+[0-9A-F]+$/.test(cp) || !['kTGHZ2013','kXHC1983','kMandarin','kSimplifiedVariant','kTraditionalVariant','kTotalStrokes'].includes(key)) continue;
    const ch = String.fromCodePoint(parseInt(cp.slice(2),16));
    if (!fields.has(ch)) fields.set(ch,{});
    fields.get(ch)[key] = value;
  }
}
const recognition = JSON.parse(readFileSync(join(input,'hanzi_lookup/mmah_json_convert/data/mmah.json'),'utf8')).chars.map(row=>row[0]);
const dataRoot = join(input,'hanzi-writer-data/data');
const strokeChars = readdirSync(dataRoot).filter(f=>f.endsWith('.json')).map(f=>f.slice(0,-5)).filter(c=>[...c].length===1);
const universe = [...new Set([...strokeChars,...recognition])].sort((a,b)=>a.codePointAt(0)-b.codePointAt(0));
const index = {}; let strokeBytes = 0;
mkdirSync(join(output,'chars'),{recursive:true});
for (const ch of universe) {
  const raw = fields.get(ch) || {};
  const source = raw.kTGHZ2013 ? 'kTGHZ2013' : raw.kXHC1983 ? 'kXHC1983' : 'kMandarin';
  const readings = [...new Set((raw[source] || '').split(' ').flatMap(x=>(x.includes(':')?x.split(':')[1]:x).split(',')).filter(Boolean))];
  const file = `${ch.codePointAt(0).toString(16)}.json`;
  let strokes = 0;
  if (strokeChars.includes(ch)) {
    const from = join(dataRoot,`${ch}.json`);
    const data = JSON.parse(readFileSync(from,'utf8'));
    if (!data.strokes.length || data.strokes.length!==data.medians.length) throw new Error(`Bad data: ${ch}`);
    copyFileSync(from,join(output,'chars',file)); // preserve original data bytes and licence
    strokes = data.strokes.length; strokeBytes += statSync(from).size;
  }
  const variants = (key)=>[...new Set((raw[key]||'').match(/U\+[0-9A-F]+/g)||[])].map(x=>String.fromCodePoint(parseInt(x.slice(2),16))).filter(c=>c!==ch).join('');
  // Compact rows: readings, stroke count (0 means absent), reading source, simplified variants, traditional variants.
  index[ch] = [readings.join(' / '),strokes,source,variants('kSimplifiedVariant'),variants('kTraditionalVariant')];
}
writeFileSync(join(output,'index.json'),JSON.stringify(index));
writeFileSync(join(output,'recognition-characters.json'),JSON.stringify(recognition));
const differences = {queryWithoutStrokes:universe.filter(c=>!strokeChars.includes(c)),queryWithoutRecognition:universe.filter(c=>!recognition.includes(c)),recognitionWithoutQuery:recognition.filter(c=>!index[c]),recognitionWithoutStrokes:recognition.filter(c=>!strokeChars.includes(c)),strokeWithoutReadings:strokeChars.filter(c=>!index[c][0])};
const sha = file=>createHash('sha256').update(readFileSync(file)).digest('hex');
const result = {query:universe.length,strokes:strokeChars.length,recognition:recognition.length,strokeBytes,indexBytes:statSync(join(output,'index.json')).size,wasmBytes:statSync(join(output,'recognizer/hanzi_lookup_bg.wasm')).size,differences,indexSha256:sha(join(output,'index.json')),wasmSha256:sha(join(output,'recognizer/hanzi_lookup_bg.wasm'))};
writeFileSync(join(output,'coverage.json'),JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));
