import test from 'node:test';
import assert from 'node:assert/strict';
import {SdkStatusStore} from './demo/sdk-status.mjs';

const envelope={source:'pleos-sdk-1.1.3',generation:1,sequence:0,state:'CALLBACK',sampleCount:1,clockStatus:'UNVERIFIED_CLOCK'};

test('strict status schema rejects navigation extras without refreshing receipt TTL',()=>{
  for(const field of ['eta','remainTime','remainDistance','duration','navigation']) {
    const store=new SdkStatusStore();
    assert.equal(store.accept(envelope,100),true);
    for(let i=1;i<=3;i++) {
      assert.equal(store.accept({...envelope,sequence:i,[field]:field==='navigation'?{remainTime:1080}:1080},100+i*2000),false);
    }
    // Rejected payloads must not keep the previous status alive.
    assert.deepEqual(store.read(6100),{state:'NO_RECENT_STATUS',clockStatus:'UNVERIFIED_CLOCK',sampleCount:1});
  }
});

test('repeated diagnostic counts with new sequences remain valid status receipts',()=>{
  const store=new SdkStatusStore();
  for(let i=0;i<4;i++) {
    assert.equal(store.accept({...envelope,sequence:i},i*2000),true);
    assert.deepEqual(store.read(i*2000),{state:'CALLBACK',clockStatus:'UNVERIFIED_CLOCK',sampleCount:1});
  }
});
