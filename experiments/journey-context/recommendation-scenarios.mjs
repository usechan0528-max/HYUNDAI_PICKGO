import {rankRecommendations} from './core.mjs';
import {pathToFileURL} from 'node:url';

// Policy examples, not user satisfaction labels or measured recommendation accuracy.
export function runRecommendationScenarios() {
  const catalog=[{id:'story',topic:'story',testOnly:true},{id:'news',topic:'news',testOnly:true},
    {id:'story2',topic:'story',testOnly:true},{id:'reflection',topic:'reflection',testOnly:true}];
  const preferences={topics:{story:3,news:2,reflection:1},byPurpose:{commute:{news:4},errand:{news:-3}}};
  const context=(...purposes)=>({status:'hypothesis',candidates:purposes.map(purpose=>({purpose}))});
  const cases=[
    ['first-use',{preferences:{}}],['taste-only',{}],['commute',{context:context('commute')}],
    ['ambiguous-route',{context:context('commute','errand')}],['context-lost',{context:{status:'unknown'}}],
    ['disliked-news',{context:context('commute'),preferences:{...preferences,dislikedIds:['news']}}],
    ['session-exhausted',{recent:catalog.map(x=>x.id)}]
  ];
  return {source:'synthetic',policyVersion:'rules-v1',userBenefitMeasured:false,
    cases:cases.map(([name,patch])=>({name,...rankRecommendations({catalog,preferences,...patch})}))};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)
  process.stdout.write(JSON.stringify(runRecommendationScenarios(),null,2)+'\n');
