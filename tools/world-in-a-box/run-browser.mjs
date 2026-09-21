// Run the same public-input browser functions outside the interactive CLI daemon.
// Keeps long matrix output and error cleanup independent of the interactive session.
import {chromium} from '@playwright/test';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {dirname} from 'node:path';
const [script,output]=process.argv.slice(2);
if(!script||!output)throw Error('Usage: node run-browser.mjs script.js output.json');
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const context=await browser.newContext(),page=await context.newPage();
 page.qaProfiles=process.env.QA_PROFILES?.split(',');page.qaPrefix=process.env.QA_PREFIX||'';
 const source=(await readFile(script,'utf8')).replaceAll('docs/world-in-a-box/step02-evidence/',process.env.QA_EVIDENCE_ROOT||'docs/world-in-a-box/step02-evidence/').replaceAll('docs/world-in-a-box/evidence/',process.env.QA_EVIDENCE_ROOT||'docs/world-in-a-box/evidence/').replaceAll('tmp/tasks/world-box-r2/','tmp/tasks/world-box-step02/legacy/');
 const run=Function('return ('+source.replaceAll('http://127.0.0.1:5175',process.env.QA_ORIGIN??'http://127.0.0.1:5175')+'\n)')();
 const result=await run(page);await mkdir(dirname(output),{recursive:true});await writeFile(output,JSON.stringify(result,null,2)+'\n');
 if(['AUTO_REVISE','FAIL'].includes(result?.result))process.exitCode=1;
 console.log(JSON.stringify({result:result?.result,output}));
}finally{await browser.close();}
