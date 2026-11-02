import {SdkStatusStore} from './sdk-status.mjs';
import http from 'node:http';
import {byteRange} from './byte-range.mjs';
import {readFile} from 'node:fs/promises';
const sdkEnabled=process.env.J1_SDK_STATUS==='1',sdkStore=new SdkStatusStore();
const root=new URL('./',import.meta.url);
const routes=new Map([['/', ['cockpit.html','text/html']],['/lab', ['index.html','text/html']],['/app.mjs',['app.mjs','text/javascript']],['/listening-store.mjs',['listening-store.mjs','text/javascript']],
 ['/content.mjs',['content.mjs','text/javascript']],['/coordinates.mjs',['../coordinates.mjs','text/javascript']],['/observations.mjs',['observations.mjs','text/javascript']],['/style.css',['style.css','text/css']],['/core.mjs',['../core.mjs','text/javascript']]]);
for(const name of ['cockpit.mjs','cockpit-player.mjs']) routes.set('/'+name,[name,'text/javascript']);
routes.set('/cockpit.css',['cockpit.css','text/css']);
routes.set('/fonts/AstaSans.ttf',['../../../output/j1-cockpit/fonts/AstaSans.ttf','font/ttf']);
for(const id of ['story','pause','story2','pause2']) routes.set(`/audio/${id}.wav`,[`audio/${id}.wav`,'audio/wav']);
routes.set('/sdk-status.mjs',['sdk-status.mjs','text/javascript']);
routes.set('/fonts/Inter.ttf',['fonts/Inter.ttf','font/ttf']);
http.createServer(async(req,res)=>{
 const path=new URL(req.url,'http://localhost').pathname;
 if(path==='/sdk-status'){
  const reply=(code,data)=>{res.writeHead(code,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));};
  if(!sdkEnabled){reply(404,{state:'DISABLED'});return;}
  if(req.socket.remoteAddress!=='127.0.0.1'||!['127.0.0.1:4177','localhost:4177'].includes(req.headers.host)){reply(403,{});return;}
  if(req.method==='GET'){reply(200,sdkStore.read(performance.now()));return;}
  if(req.method!=='POST'){reply(405,{});return;}
  // Browser cross-origin writes are refused; debug Android sends no Origin header.
  if(req.headers.origin||req.headers['content-type']!=='application/json'){reply(403,{});return;}
  const chunks=[];let size=0;req.setTimeout(2000,()=>req.destroy());
  try{for await(const chunk of req){size+=chunk.length;if(size>1024){res.setHeader('Connection','close');reply(413,{});return;}chunks.push(chunk);}
   const accepted=sdkStore.accept(JSON.parse(Buffer.concat(chunks).toString('utf8')),performance.now());reply(accepted?202:400,{accepted});
  }catch{if(!res.headersSent)reply(400,{});}
  return;
 }
 const route=routes.get(path);
 if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
 if(!route){res.writeHead(404);res.end();return;}
 try {const bytes=await readFile(new URL(route[0],root));
 const range=route[1]==='audio/wav'?byteRange(req.headers.range,bytes.length):null;
 if(range===false){res.writeHead(416,{'Content-Range':`bytes */${bytes.length}`});res.end();return;}
 const payload=range?bytes.subarray(range.start,range.end+1):bytes;
 res.writeHead(range?206:200,{...(route[1]==='audio/wav'?{'Accept-Ranges':'bytes'}:{}),...(range?{'Content-Range':`bytes ${range.start}-${range.end}/${bytes.length}`}:{}) ,'Content-Type':route[1],'Content-Length':payload.length,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',
 'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; media-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"});
 res.end(req.method==='HEAD'?undefined:payload);
 }catch{res.writeHead(404);res.end();}
}).listen(4177,'127.0.0.1',()=>process.stdout.write('J1 local demo: http://127.0.0.1:4177\n'));
