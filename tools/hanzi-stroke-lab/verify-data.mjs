import {readFileSync,readdirSync,writeFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const root='public/hanzi-stroke-lab';const read=f=>JSON.parse(readFileSync(`${root}/${f}`,'utf8'));
const index=read('index.json'),coverage=read('coverage.json'),recognition=read('recognition-characters.json');
const files=readdirSync(`${root}/chars`);let strokes=0;const identity=[];
for(const [c,row] of Object.entries(index)){
 assert.equal([...c].length,1);assert.match(c,/^\p{Script=Han}$/u);assert.equal(row.length,5);assert.ok(row.every((v,i)=>i===1?Number.isInteger(v)&&v>0:typeof v==='string'));
 const file=`chars/${c.codePointAt(0).toString(16)}.json`,raw=readFileSync(`${root}/${file}`),data=JSON.parse(raw);
 assert.equal(data.strokes.length,row[1],c);assert.equal(data.medians.length,row[1],c);
 for(let i=0;i<data.strokes.length;i++){
   assert.match(data.strokes[i],/^M[\d\s.,MLCQZHVASTmlcqzhvast+-]+Z$/u,c);
   assert.ok(data.medians[i].length>=2,c);for(const p of data.medians[i])assert.ok(p.length===2&&p.every(n=>Number.isFinite(n)&&n>=-124&&n<=1024),c);
 }strokes+=row[1];identity.push([file,createHash('sha256').update(raw).digest('hex')]);
}
assert.equal(files.length,coverage.strokes);assert.equal(Object.keys(index).length,coverage.query);assert.equal(recognition.length,coverage.recognition);assert.equal(new Set(recognition).size,recognition.length);assert.ok(recognition.every(c=>index[c]));
assert.deepEqual(index['乐'][0].split(' / '),['lè','yuè']);assert.deepEqual(index['重'][0].split(' / '),['chóng','zhòng']);assert.deepEqual(index['长'][0].split(' / '),['cháng','zhǎng']);assert.ok(index['行'][0].includes('háng')&&index['行'][0].includes('xíng'));
const result={records:files.length,pathsAndMedians:strokes,recognition:recognition.length,readingsAbsent:Object.keys(index).filter(c=>!index[c][0]),dataTreeSha256:createHash('sha256').update(JSON.stringify(identity)).digest('hex'),verdict:'PASS_STRUCTURE'};
mkdirSync('tmp/tasks/HANZI-STROKE-LAB',{recursive:true});writeFileSync('tmp/tasks/HANZI-STROKE-LAB/data-validation.json',JSON.stringify(result,null,2));console.log(result);
