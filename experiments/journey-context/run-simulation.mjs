import {replaySyntheticJourney} from './simulation-replay.mjs';
import {history} from './demo/observations.mjs';
import {catalog} from './demo/content.mjs';

const preferences={topics:{story:3,reflection:1},byPurpose:{commute:{reflection:4},errand:{reflection:-3}}};
const begin=(at,session)=>({type:'begin',at,session,source:'synthetic',profile:'owner',consent:true,permission:true});
const point=(at,latitude,longitude,session='outbound')=>({type:'point',at,session,sample:{latitude,longitude,observedAtMs:at}});
const events=[
  begin(100,'outbound'),point(200,0,0),point(300,0,.001),{type:'consume',at:301},
  point(400,.001,.001),point(30400,.001,.001),point(60400,.001,.001),
  point(60500,.02,.02),{type:'disconnect',at:60600},point(60700,.001,.001),
  begin(60800,'return'),point(60900,0,0,'return'),point(61000,0,.001,'return'),
  point(61100,-.001,.001,'return'),{type:'arrival',at:61200},{type:'tick',at:121000},
];
console.log(JSON.stringify(replaySyntheticJourney({events,history,catalog,preferences}),null,2));
