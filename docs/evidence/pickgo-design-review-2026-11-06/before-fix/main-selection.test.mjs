import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
const html = await readFile(new URL('./index.html', import.meta.url), 'utf8');
const source = await readFile(new URL('./app.mjs', import.meta.url), 'utf8');
function page(deferSearch=false) {
  const element = () => ({children:[],append(...els){this.children.push(...els);},replaceChildren(...els){this.children=els;},value:'', hidden:false, disabled:false, textContent:'', focus(){}, getBoundingClientRect(){return {left:0,top:0,width:500,height:300};}, setAttribute(k,v){this[k]=v;}, classList:{toggle(){}}});
  const nodes = new Map([...html.matchAll(/id="([^"]+)"/g)].map(m => [m[1],element()]));
  const anchors = [...html.matchAll(/data-anchor="([^"]+)"/g)].map(m => ({...element(),dataset:{anchor:m[1]}}));
  const candidates = [...html.matchAll(/data-home-candidate="([^"]+)"/g)].map(m => ({...element(),dataset:{initial:m[1]}}));
  const results = [...html.matchAll(/data-search-place="([^"]+)"/g)].map(m => ({...element(),dataset:{searchPlace:m[1]}}));
  const calls=[]; let fail=false, release; const routes=[], mapRequests=[],searchRequests=[];
  const context = {URLSearchParams, AbortSignal, performance:{now:()=>100}, navigator:{onLine:true},
    location:{hash:'',origin:'http://127.0.0.1:4180',assign:p=>routes.push(p)}, sessionStorage:{getItem(){return null;},setItem(){}},
    document:{createElement:()=>element(),getElementById:id=>nodes.get(id),querySelectorAll:s=>s==='[data-anchor]'?anchors:s==='[data-home-candidate]'?candidates:s==='[data-search-place]'?results:[],addEventListener(){}},
    addEventListener(){},setInterval(){},
    fetch:async(path,options)=>{if(path==='/api/map/search'&&deferSearch)return await new Promise(r=>searchRequests.push(r));if(path==='/api/map/search')return response({results:JSON.parse(options.body).query==='부산'?[]:[{id:'way/144376088',name:'현대자동차 양재사옥',kind:'건물',address:''}]});if(path.startsWith('/api/map?place='))return await new Promise(r=>mapRequests.push(r));calls.push({path,body:JSON.parse(options.body)}); await new Promise(r=>release=r); return {ok:!fail,json:async()=>fail?{error:'연결 실패'}:{id:'room',token:'test',role:'driver'}};}};
  vm.createContext(context); vm.runInContext(source,context);
  return {nodes,anchors,candidates,results,calls,routes,mapRequests,searchRequests,submit:()=>nodes.get('create').onsubmit({preventDefault(){}}), fail:()=>{fail=true;},release:()=>release()};
}

const data={available:true,recommendations:[0,1,2].map(i=>({name:`후보 ${i+1}`,distanceM:100+i,point:[127+i/10000,37.46]}))};
const response=d=>({ok:true,json:async()=>d});
async function load(p){p.nodes.get('placeQuery').value='양재';await p.submit();const pending=p.nodes.get('searchResults').children[0].onclick();p.mapRequests.at(-1)(response(data));await pending;}
test('search starts with no choices; blank and unsupported queries never create a pickup',async()=>{
 const p=page();await p.submit();assert.match(p.nodes.get('searchStatus').textContent,/입력/);
 p.nodes.get('placeQuery').value='부산';await p.submit();assert.match(p.nodes.get('searchStatus').textContent,/찾지 못했습니다/);assert.equal(p.nodes.get('searchResults').children.length,0);assert.equal(p.calls.length,0);
});
test('search result loads exactly three real candidates and creates by explicit coordinate selection',async()=>{
 const p=page();await load(p);assert.equal(p.candidates.filter(b=>!b.hidden).length,3);assert.equal(p.nodes.get('homeStart').disabled,true);
 p.candidates[1].onclick();p.fail();const pending=p.nodes.get('homeStart').onclick();await p.nodes.get('homeStart').onclick();assert.equal(p.calls.length,1);
 assert.deepEqual(p.calls[0].body,{point:data.recommendations[1].point});p.release();await pending;assert.equal(p.nodes.get('homeStart').disabled,false);
});
test('direct choice opens the actual map after search and never creates a room early',async()=>{
 const p=page();await load(p);p.nodes.get('homeManual').onclick();assert.deepEqual(p.routes,['/map?place=way%2F144376088']);assert.equal(p.calls.length,0);
});
test('editing query invalidates delayed responses and selected coordinates',async()=>{
 const p=page();p.nodes.get('placeQuery').value='양재';await p.submit();const pending=p.nodes.get('searchResults').children[0].onclick();p.nodes.get('placeQuery').oninput();
 p.mapRequests[0](response(data));await pending;assert.ok(p.candidates.every(b=>b.hidden));assert.equal(p.nodes.get('homeCandidates').hidden,true);assert.equal(p.nodes.get('homeStart').disabled,true);
});
test('expired map data yields no fabricated candidates',async()=>{
 const p=page();p.nodes.get('placeQuery').value='양재';await p.submit();const pending=p.nodes.get('searchResults').children[0].onclick();p.mapRequests[0](response({...data,available:false}));await pending;
 assert.ok(p.candidates.every(b=>b.hidden));assert.match(p.nodes.get('homeCandidateStatus').textContent,/갱신/);
});

test('editing query discards an older asynchronous search response',async()=>{
 const p=page(true);p.nodes.get('placeQuery').value='양재';const pending=p.submit();
 p.nodes.get('placeQuery').value='하나로마트';p.nodes.get('placeQuery').oninput();
 p.searchRequests[0](response({results:[{id:'old',name:'이전 결과'}]}));await pending;
 assert.equal(p.nodes.get('searchResults').children.length,0);assert.equal(p.nodes.get('homeResults').hidden,true);
});
