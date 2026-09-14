import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {resolve,sep} from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';

// Convert the read-only CDP recordings using their actual capture timestamps.
// Repeated video frames preserve pauses; the game clock is never accessed.
const task=resolve('tmp/tasks/GAME-CODEX-STEP5');
const ffmpeg=process.argv[2];if(!ffmpeg||!existsSync(ffmpeg))throw Error('Provide the installed Playwright ffmpeg executable.');
const inputs=process.argv.slice(3);if(!inputs.length)throw Error('Provide recorded clip directories.');
for(const input of inputs){
 const directory=resolve(input);if(!directory.startsWith(task+sep))throw Error('Clip evidence must remain inside STEP5.');
 const metadata=JSON.parse(readFileSync(resolve(directory,'frames.json'),'utf8')) as {durationMs:number;frames:{file:string;timestamp:number}[]};
 if(metadata.frames.length<6||metadata.durationMs<=0)throw Error(`Incomplete recording: ${input}`);
 const output=resolve(directory,'review.webm'),fps=10,count=Math.ceil(metadata.durationMs/1000*fps),first=metadata.frames[0].timestamp;
 const images=metadata.frames.map(frame=>{if(!/^frame-\d+\.jpg$/.test(frame.file))throw Error('Unexpected frame filename');return readFileSync(resolve(directory,frame.file));});
 const samples:Buffer[]=[];let position=0;
 for(let frame=0;frame<count;frame++){const time=first+frame/fps;while(position+1<metadata.frames.length&&metadata.frames[position+1].timestamp<=time)position++;samples.push(images[position]);}
 if(existsSync(output))throw Error(`Refusing to overwrite a reviewed clip: ${output}`);
 const result=spawnSync(ffmpeg,['-hide_banner','-loglevel','warning','-f','image2pipe','-vcodec','mjpeg','-framerate',String(fps),'-i','pipe:0','-an','-c:v','libvpx','-deadline','realtime','-cpu-used','4','-b:v','1200k','-pix_fmt','yuv420p',output],{input:Buffer.concat(samples),maxBuffer:8*1024*1024});
 if(result.status!==0)throw Error(result.stderr.toString());
 // The bundled Playwright build provides image2, but no null muxer.
 // Decode every frame, retaining only the final PNG through image2's update mode.
 const decoded=spawnSync(ffmpeg,['-hide_banner','-i',output,'-f','image2','-update','1',resolve(directory,'decoded-last.png')],{encoding:'utf8',maxBuffer:8*1024*1024});
 if(decoded.status!==0)throw Error(decoded.stderr);
 const decodedFrames=Number([...decoded.stderr.matchAll(/frame=\s*(\d+)/g)].at(-1)?.[1]);
 if(decodedFrames!==count)throw Error(`Decoded ${decodedFrames} frames; expected ${count}.`);
 mkdirSync(resolve(directory,'review-frames'),{recursive:true});
 for(const second of [0,Math.floor(metadata.durationMs/3000),Math.floor(metadata.durationMs*2/3000)]){
  const file=resolve(directory,'review-frames',`${second}s.png`);if(existsSync(file))throw Error('Do not overwrite a reviewed frame.');
  const extraction=spawnSync(ffmpeg,['-hide_banner','-loglevel','warning','-ss',String(second),'-i',output,'-frames:v','1',file],{encoding:'utf8'});if(extraction.status!==0)throw Error(extraction.stderr);
 }
 const record={source:'frames.json',sourceFrames:metadata.frames.length,durationMs:metadata.durationMs,fps,encodedFrames:count,decodedFrames,sha256:createHash('sha256').update(readFileSync(output)).digest('hex'),stateInjection:false,clockAcceleration:false,timestampResampling:'hold the latest actual frame at each 100ms sample',decoded:true};
 writeFileSync(resolve(directory,'video-evidence.json'),JSON.stringify(record,null,2));console.log(JSON.stringify({directory,...record}));
}
