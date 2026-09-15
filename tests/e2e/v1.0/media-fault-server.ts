import {createServer,request} from 'node:http';
import {connect,type Socket} from 'node:net';
/** Test-only local transport fault. Windows WebKit's native media backend bypasses page.route(). */
export async function mediaFaultServer(upstream:string){
 const base=new URL(upstream);let blocked=true,rejected=0;const sockets=new Set<Socket>();
 const server=createServer((incoming,response)=>{
   if(blocked&&/\/assets\/v1\.0\/.*\.(ogg|wav)(?:\?|$)/.test(incoming.url??'')){rejected++;response.writeHead(503,{'Content-Type':'text/plain','Cache-Control':'no-store'});response.end('Intentional media transport fault');return;}
   const outgoing=request(new URL(incoming.url??'/',base),{method:incoming.method,headers:{...incoming.headers,host:base.host}},remote=>{response.writeHead(remote.statusCode??502,remote.headers);remote.pipe(response);});
   outgoing.on('error',()=>{if(!response.headersSent)response.writeHead(502);response.end();});incoming.pipe(outgoing);
 });
 server.on('connection',socket=>{sockets.add(socket);socket.on('close',()=>sockets.delete(socket));});
 server.on('upgrade',(req,socket,head)=>{const peer=connect(Number(base.port),base.hostname,()=>{peer.write(`${req.method} ${req.url} HTTP/1.1\r\n${Object.entries({...req.headers,host:base.host}).map(([k,v])=>`${k}: ${v}`).join('\r\n')}\r\n\r\n`);if(head.length)peer.write(head);socket.pipe(peer).pipe(socket);});peer.on('error',()=>socket.destroy());socket.on('error',()=>peer.destroy());socket.on('close',()=>peer.destroy());});
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));const address=server.address();if(!address||typeof address==='string')throw Error('Local test listener unavailable');
 return {url:`http://127.0.0.1:${address.port}`,get rejected(){return rejected;},recover(){blocked=false;},async close(){for(const s of sockets)s.destroy();await new Promise<void>(resolve=>server.close(()=>resolve()));}};
}
