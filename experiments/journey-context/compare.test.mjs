import test from 'node:test';
import assert from 'node:assert/strict';
import {compare,fixtures,runComparison} from './compare.mjs';
test('ablation exposes agreement, differences and fallback without scoring winners',()=>{
 const cases=runComparison().cases;
 assert.deepEqual(cases.map(c=>[c.A.id,c.B.id,c.C.id]),[
 ['science','news','news'],['science','news','science'],['science','news','science'],
 ['science','news','science'],['science','science','science'],['science','science','science']]);
 assert.equal(cases[3].journey.status,'unknown');
 assert.equal(cases[2].journey.candidateCount,2);
 assert.ok(cases.every(c=>!('accuracy' in c) && !('winner' in c)));
});
test('future and other-driver training records cannot alter any method',()=>{
 const f=fixtures()[0]; const before=compare(f);
 const extra=[{...f.history[1],endedAt:600,departureSlot:'morning'},
 {...f.history[1],profile:'b',departureSlot:'morning'}];
 assert.deepEqual(compare({...f,history:[...f.history,...extra]}),before);
});
test('single-item catalog yields the same available item in all methods',()=>{
 const f=fixtures()[0];
 const out=compare({...f,catalog:f.catalog.filter(c=>c.id==='science')});
 assert.equal(out.A.id,out.B.id);assert.equal(out.B.id,out.C.id);
});

test('history ending at departure is excluded and invalid clocks prevent contextual scoring',()=>{
 const f=fixtures()[0];
 const boundary={...f.history[1],endedAt:f.input.startedAt,departureSlot:'morning'};
 assert.deepEqual(compare({...f,history:[...f.history,boundary]}),compare(f));
 const out=compare({...f,input:{...f.input,startedAt:600}});
 assert.equal(out.B.id,out.A.id);assert.equal(out.C.id,out.A.id);
});
