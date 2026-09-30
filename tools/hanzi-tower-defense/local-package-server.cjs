// Local return-package server. Built-ins only; binds the existing family origin.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, 'runtime');
const mime = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.woff2':'font/woff2','.wav':'audio/wav','.mp3':'audio/mpeg','.wasm':'application/wasm'};
const server = http.createServer((req,res) => {
 let name;
 try {name=decodeURIComponent(new URL(req.url,'http://127.0.0.1:5175').pathname);} catch {res.writeHead(400).end();return;}
 const target=path.resolve(root,`.${name==='/'?'/index.html':name}`);
 if(!target.startsWith(root+path.sep)){res.writeHead(403).end();return;}
 fs.stat(target,(error,stat)=>{
  if(error||!stat.isFile()){res.writeHead(404).end();return;}
  res.writeHead(200,{'Content-Type':mime[path.extname(target)]??'application/octet-stream','X-Game-Codex-Package':'short-missions','Cache-Control':'no-cache'});
  fs.createReadStream(target).pipe(res);
 });
});
server.on('error',error=>{console.error(error.code==='EADDRINUSE'?'Port 5175 is already in use. Use the current Game-Codex launcher or stop that exact server first.':error.message);process.exitCode=1;});
server.listen(5175,'127.0.0.1',()=>console.log('http://127.0.0.1:5175/?play=hanzi-tower-defense&scenario=qinglan-elite'));
