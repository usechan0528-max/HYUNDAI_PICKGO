import http from 'node:http';
import {byteRange} from './byte-range.mjs';
import {readFile} from 'node:fs/promises';
const root=new URL('./',import.meta.url);
const routes=new Map([['/', ['index.html','text/html']],['/app.mjs',['app.mjs','text/javascript']],['/listening-store.mjs',['listening-store.mjs','text/javascript']],
 ['/content.mjs',['content.mjs','text/javascript']],['/coordinates.mjs',['../coordinates.mjs','text/javascript']],['/observations.mjs',['observations.mjs','text/javascript']],['/style.css',['style.css','text/css']],['/core.mjs',['../core.mjs','text/javascript']]]);
for(const id of ['story','pause','story2','pause2']) routes.set(`/audio/${id}.wav`,[`audio/${id}.wav`,'audio/wav']);
http.createServer(async(req,res)=>{
 const route=routes.get(new URL(req.url,'http://localhost').pathname);
 if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
 if(!route){res.writeHead(404);res.end();return;}
 try {const bytes=await readFile(new URL(route[0],root));
 const range=route[1]==='audio/wav'?byteRange(req.headers.range,bytes.length):null;
 if(range===false){res.writeHead(416,{'Content-Range':`bytes */${bytes.length}`});res.end();return;}
 const payload=range?bytes.subarray(range.start,range.end+1):bytes;
 res.writeHead(range?206:200,{...(route[1]==='audio/wav'?{'Accept-Ranges':'bytes'}:{}),...(range?{'Content-Range':`bytes ${range.start}-${range.end}/${bytes.length}`}:{}) ,'Content-Type':route[1],'Content-Length':payload.length,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',
 'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; media-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"});
 res.end(req.method==='HEAD'?undefined:payload);
 }catch{res.writeHead(404);res.end();}
}).listen(4177,'127.0.0.1',()=>process.stdout.write('J1 local demo: http://127.0.0.1:4177\n'));
