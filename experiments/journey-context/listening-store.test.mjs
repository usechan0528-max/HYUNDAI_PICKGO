import test from 'node:test';
import assert from 'node:assert/strict';
import {STORAGE_KEY,saveListening,loadListening,clearListening} from './demo/listening-store.mjs';
const store=()=>{const map=new Map();return {getItem:k=>map.get(k),setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};};
test('preferences and incomplete media roundtrip, only whitelisted fields persist',()=>{
 const s=store();saveListening(s,{taste:'story',checkpoint:{id:'a',seconds:5,duration:20,latitude:42},location:'private'},['a'],100);
 assert.deepEqual(loadListening(s,['a'],101),{version:1,taste:'story',checkpoint:{id:'a',seconds:5,duration:20},savedAt:100});
 assert.equal(s.getItem(STORAGE_KEY).includes('latitude'),false);
});
test('completed, unknown and invalid checkpoints cannot resume',()=>{
 for(const checkpoint of [{id:'a',seconds:19,duration:20},{id:'unknown',seconds:5,duration:20},{id:'a',seconds:-1,duration:20},{id:'a',seconds:5,duration:Infinity}]){
 const s=store();saveListening(s,{taste:'story',checkpoint},['a'],100);
 assert.equal(loadListening(s,['a'],100).checkpoint,null);
 }
});
test('expiry, future clock, invalid JSON, schema and size do not block listening',()=>{
 const s=store();saveListening(s,{taste:'story'},['a'],100);
 assert.equal(loadListening(s,['a'],99),null);assert.equal(loadListening(s,['a'],100+8*86400000),null);
 for(const raw of ['not-json','{}','x'.repeat(2049)]){s.setItem(STORAGE_KEY,raw);assert.equal(loadListening(s,['a']),null);}
 const blocked={getItem(){throw Error();},setItem(){throw Error();},removeItem(){throw Error();}};
 assert.equal(loadListening(blocked,['a']),null);assert.equal(saveListening(blocked,{taste:'story'},['a']),false);assert.equal(clearListening(blocked),false);
});
test('clear removes stored preference and checkpoint',()=>{
 const s=store();saveListening(s,{taste:'reflection',checkpoint:{id:'a',seconds:5,duration:20}},['a'],100);
 assert.equal(clearListening(s),true);assert.equal(loadListening(s,['a'],100),null);
});

import {byteRange} from './demo/byte-range.mjs';
test('audio byte ranges support bounded, open and suffix requests and reject invalid input',()=>{
 assert.deepEqual(byteRange('bytes=2-5',10),{start:2,end:5});
 assert.deepEqual(byteRange('bytes=2-',10),{start:2,end:9});
 assert.deepEqual(byteRange('bytes=-3',10),{start:7,end:9});
 assert.deepEqual(byteRange('bytes=0-100',10),{start:0,end:9});
 assert.equal(byteRange(undefined,10),null);
 for(const value of ['bytes=10-','bytes=8-2','bytes=-0','bytes=-','bytes=0-1,4-5','bytes=9007199254740992-'])assert.equal(byteRange(value,10),false);
});
test('invalid taste/version are rejected while preference-only storage remains supported',()=>{
 const s=store();assert.equal(saveListening(s,{taste:'invalid'},['a'],100),false);
 s.setItem(STORAGE_KEY,JSON.stringify({version:99,taste:'story',savedAt:100}));assert.equal(loadListening(s,['a'],100),null);
 assert.equal(saveListening(s,{taste:'reflection'},['a'],100),true);
 assert.equal(loadListening(s,['a'],100).checkpoint,null);
});
