// One point at a time. This is an executable synthetic fixture, not an SDK adapter.
import {CoordinateStream} from './coordinate-stream.mjs';
import {recommend} from './core.mjs';
import {history} from './demo/observations.mjs';
import {catalog} from './demo/content.mjs';
const stream=new CoordinateStream();
const token=stream.begin({profile:'owner',consent:true,permission:true,source:'synthetic',startedAtMs:100});
const preferences={topics:{story:3,reflection:1},byPurpose:{commute:{reflection:4}}};
const rows=[];
for(const [step,latitude,longitude,at] of [['origin',0,0,200],['shared',0,.001,300],['work-branch',.001,.001,400]]) {
 stream.push(token,{latitude,longitude,observedAtMs:at},at);
 const context=stream.context(history,at);
 rows.push({step,context,recommendation:recommend({catalog,preferences,context})?.id??null});
}
rows.push({step:'no-new-observation',context:stream.context(history,30401)});
stream.revoke();
rows.push({step:'late-callback',result:stream.push(token,{latitude:0,longitude:0,observedAtMs:30402},30402),context:stream.context(history,30402)});
console.log(JSON.stringify({source:'synthetic',rows},null,2));
