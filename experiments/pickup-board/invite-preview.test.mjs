import test from 'node:test';
import assert from 'node:assert/strict';
import {Board} from './domain.mjs';
import {createServer} from './server.mjs';
import {randomUUID} from 'node:crypto';
test('invitation preview is read-only, capability-scoped and expires on join/end/time',async()=>{
 let now=100;const board=new Board(()=>now);const s=createServer(board);await new Promise(r=>s.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${s.address().port}`;
 try{
 const d=board.create('하나로마트 양재점');const before=board.room(d.id).version;
 const preview=async(invite,id=d.id)=>{const r=await fetch(`${base}/api/rooms/${id}/preview`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({invite})});return {status:r.status,data:await r.json()};};
 assert.deepEqual(await preview(d.invite),{status:200,data:{place:'하나로마트 양재점'}});assert.equal(board.room(d.id).version,before);assert.equal(board.room(d.id).joined,false);
 assert.equal((await preview(d.token)).status,403);assert.equal((await preview('bad')).status,403);
 const other=board.create('현대자동차 양재사옥');assert.equal((await preview(other.invite)).status,403);
 board.join(d.id,d.invite,randomUUID());assert.equal((await preview(d.invite)).status,403);
 board.room(other.id).status='ended';assert.equal((await preview(other.invite,other.id)).status,403);
 const expired=board.create('하나로마트 양재점');now+=86400001;assert.equal((await preview(expired.invite,expired.id)).status,404);
 }finally{await new Promise(r=>s.close(r));}
});
