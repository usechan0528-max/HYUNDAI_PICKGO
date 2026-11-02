import { inferJourney, recommend } from './core.mjs';
import { pathToFileURL } from 'node:url';

// Functional ablation, not a benchmark: hand-authored synthetic cases, no target preference labels.
export function compare({ history, input, catalog, preferences, departureSlot }) {
  const validClock = Number.isFinite(input.now) && Number.isFinite(input.startedAt) &&
    input.startedAt <= input.now;
  const eligible = history.filter(h => validClock && input.profile && input.consent && input.permission &&
    h.profile === input.profile && Number.isFinite(h.endedAt) && h.endedAt < input.startedAt);
  const slotMatches = eligible.filter(h => h.departureSlot === departureSlot);
  const clockContext = slotMatches.length ? {status:'hypothesis', candidates:slotMatches.map(h =>
    ({purpose:h.confirmedPurpose || null}))} : {status:'unknown', candidates:[]};
  const journey = inferJourney({...input, history});
  const pick = context => recommend({catalog,preferences,context});
  return { A:pick(null), B:pick(clockContext), C:pick(journey),
    journey:{status:journey.status, reason:journey.reason, candidateCount:journey.candidates.length},
    comparison:'synthetic-functional-only' };
}

export function fixtures() {
  const history = [
    {id:'work',profile:'a',endedAt:100,departureSlot:'morning',zones:['home','shared','work'],confirmedPurpose:'commute'},
    {id:'shop',profile:'a',endedAt:110,departureSlot:'afternoon',zones:['home','shared','shop'],confirmedPurpose:'errand'}
  ];
  const input={profile:'a',consent:true,permission:true,now:500,startedAt:200,
    observations:[{zone:'home',at:200},{zone:'shared',at:300},{zone:'work',at:400}]};
  const catalog=[{id:'science',topic:'science',testOnly:true},{id:'news',topic:'news',testOnly:true}];
  const preferences={topics:{science:3,news:2},byPurpose:{commute:{news:4},errand:{news:-3}}};
  const base={history,input,catalog,preferences,departureSlot:'morning'};
  return [
    {name:'usual-morning-commute',...base},
    {name:'morning-errand',...base,input:{...input,observations:[...input.observations.slice(0,2),{zone:'shop',at:400}]}},
    {name:'shared-segment',...base,input:{...input,observations:input.observations.slice(0,2)}},
    {name:'unseen-route',...base,input:{...input,observations:[{zone:'elsewhere',at:400}]}},
    {name:'permission-denied',...base,input:{...input,permission:false}},
    {name:'no-context-preferences',...base,preferences:{topics:preferences.topics}}
  ];
}
export function runComparison() {
  return {notice:'합성 기능 비교: 사용자 선호 정답·정확도·만족도·우위 측정 없음.',
    methods:{A:'taste-only',B:'departure-slot plus taste',C:'observed route-prefix plus taste'},
    cases:fixtures().map(f => ({name:f.name,...compare(f)}))};
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  process.stdout.write(JSON.stringify(runComparison(),null,2)+'\n');
