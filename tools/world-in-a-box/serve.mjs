// Dependency-free static handoff server. No Blender, npm install, telemetry or network upstream.
import http from 'node:http';
import { readFile,stat } from 'node:fs/promises';
import { resolve,sep,extname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root=resolve(process.argv[2]??fileURLToPath(new URL('./web',import.meta.url)));
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.glb':'model/gltf-binary','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.woff2':'font/woff2','.mp3':'audio/mpeg','.wav':'audio/wav'};
const server=http.createServer(async(req,res)=>{
  try{
    if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405);res.end();return;}
    let pathname=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);
    // Serve the same bytes at root and a representative project subpath.
    if(pathname.startsWith('/Game-Codex/'))pathname=pathname.slice('/Game-Codex'.length);
    let target=resolve(root,'.'+pathname);if(target!==root&&!target.startsWith(root+sep)){res.writeHead(403);res.end();return;}
    if((await stat(target)).isDirectory())target=resolve(target,'index.html');
    const body=await readFile(target);res.writeHead(200,{'Content-Type':types[extname(target)]??'application/octet-stream','Content-Length':body.length,'Cache-Control':'no-cache'});res.end(req.method==='HEAD'?undefined:body);
  }catch{res.writeHead(404);res.end('Not found');}
});
server.on('error',error=>{console.error(error.code==='EADDRINUSE'?'5175 已在使用。请先停止当前家庭服务，再启动这个包。':error.message);process.exitCode=1;});
server.listen(5175,'127.0.0.1',()=>console.log('世界盒子：http://127.0.0.1:5175/?play=world-in-a-box\n保持此窗口开启；Ctrl+C 停止。'));
