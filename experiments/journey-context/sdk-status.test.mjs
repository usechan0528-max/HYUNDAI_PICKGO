import test from 'node:test';
import assert from 'node:assert/strict';
import {SdkStatusStore,validSdkEnvelope,sdkUnknownContext,sdkStatusText} from './demo/sdk-status.mjs';
import {recommend} from './core.mjs';
const e={source:'pleos-sdk-1.1.3',generation:100,sequence:0,state:'WAITING',sampleCount:0,clockStatus:'UNVERIFIED_CLOCK'};
test('status schema cannot carry coordinates, time, age, or a verified flag',()=>{
 assert.equal(validSdkEnvelope(e),true);
 for(const key of ['lat','longitude','timestampMillis','age','fresh','receivedAtMs'])assert.equal(validSdkEnvelope({...e,[key]:1}),false);
 for(const patch of [{clockStatus:'VERIFIED'},{source:'synthetic'},{sampleCount:-1},{generation:Infinity},{sequence:1.5},{state:'FRESH'}])assert.equal(validSdkEnvelope({...e,...patch}),false);
});
test('status store rejects late generations/sequences and expires on host receipt clock',()=>{
 const s=new SdkStatusStore();assert.equal(new SdkStatusStore().accept({...e,sequence:5},100),true);
 assert.equal(s.accept(e,100),true);assert.equal(s.accept(e,101),false);
 assert.equal(s.accept({...e,sequence:1,state:'CALLBACK',sampleCount:1},200),true);
 assert.equal(s.read(5200).state,'CALLBACK');assert.equal(s.read(5201).state,'NO_RECENT_STATUS');
 assert.equal(s.accept({...e,generation:99},5300),false);
 assert.equal(s.accept({...e,generation:101},5400),true);
 assert.equal(s.accept({...e,sequence:2},5500),false);
 assert.equal(s.accept({...e,generation:101,sequence:1},5300),false);
 assert.equal(s.read(5300).state,'NO_RECENT_STATUS');
});
test('mutating caller envelopes cannot change retained state',()=>{
 const s=new SdkStatusStore(),value={...e};s.accept(value,100);value.state='CALLBACK';
 const out=s.read(100);out.state='CALLBACK';assert.equal(s.read(100).state,'WAITING');
});
test('actual SDK statuses never create route or freshness; recommendation equals taste-only',()=>{
 const context=sdkUnknownContext();assert.equal(context.status,'unknown');assert.deepEqual(context.candidates,[]);
 const base={catalog:[{id:'a',topic:'story',testOnly:true},{id:'b',topic:'reflection',testOnly:true}],preferences:{topics:{story:3,reflection:1},byPurpose:{commute:{reflection:100}}}};
 assert.deepEqual(recommend({...base,context}),recommend({...base,context:{status:'unknown',candidates:[],purposeHint:null}}));
 assert.match(sdkStatusText({...e,state:'CALLBACK'}),/관측 시각 미확인/);
 assert.match(sdkStatusText({clockStatus:'VERIFIED'}),/확인 불가/);
});
test('no bridge and error states do not imply an SDK connection',()=>{
 assert.equal(new SdkStatusStore().read(0).state,'NO_BRIDGE');
 assert.match(sdkStatusText({state:'NO_BRIDGE',clockStatus:'UNVERIFIED_CLOCK'}),/상태 연결 대기/);
 assert.match(sdkStatusText({state:'ERROR',clockStatus:'UNVERIFIED_CLOCK'}),/오류/);
 assert.match(sdkStatusText({state:'NO_RECENT_STATUS',clockStatus:'UNVERIFIED_CLOCK'}),/최근 SDK 상태 갱신 없음/);
});
