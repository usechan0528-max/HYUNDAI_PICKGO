import test from 'node:test';
import assert from 'node:assert/strict';
import {JourneySession,recommend} from './core.mjs';
import {inferCoordinateJourney} from './coordinates.mjs';
import {history,observationInput} from './demo/observations.mjs';
import {catalog} from './demo/content.mjs';
const input=scene=>observationInput({scene,profile:'owner',consent:true,now:100_000});
const preferences={topics:{story:3,reflection:1},byPurpose:{commute:{reflection:4},errand:{reflection:-3}}};
test('demo coordinates pass through session and change recommendations at branch',()=>{
 const session=new JourneySession(history,inferCoordinateJourney);
 const pick=scene=>recommend({catalog,preferences,context:session.tick(input(scene))});
 assert.equal(pick('shared').id,'story');
 assert.equal(pick('work').id,'pause');
 assert.equal(pick('jitter').id,'pause');
 assert.equal(pick('shop').id,'story');
});
test('coordinate session invalidates stale or revoked derived queues without interrupting playback',()=>{
 for(const next of [input('stale'),{...input('work'),consent:false},{...input('work'),profile:null},input('unknown')]){
  const session=new JourneySession(history,inferCoordinateJourney);session.tick(input('work'));
  session.queue.current='playing';session.queue.update('pause',100_000);session.tick(next);
  assert.equal(session.context.status,'unknown');assert.equal(session.queue.next,null);
  assert.equal(session.queue.current,'playing');
 }
});
