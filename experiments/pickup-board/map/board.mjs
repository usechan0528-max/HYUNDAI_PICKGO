import {RecommendationBoard} from '../recommendation/board.mjs';
import {Fault} from '../domain.mjs';
import {mapModel} from './service.mjs';
const prefix='지도 핀';
export function decodePoint(place){
  if(typeof place!=='string')return null;
  const m=place.match(/^지도 핀 \((-?\d+\.\d{7}), (-?\d+\.\d{7})\)$/);
  return m?[Number(m[2]),Number(m[1])]:null;
}
export class MapBoard extends RecommendationBoard{
  constructor(now=Date.now,mono=()=>performance.now(),provider,model=mapModel){super(now,mono,provider);this.mapModel=model;}
  isPlaceAllowed(place){const p=decodePoint(place);return p?this.mapModel.check(p,this.now()).selectable:super.isPlaceAllowed(place);}
  pointName(point){
    const result=this.mapModel.check(point,this.now());
    if(!result.selectable)throw new Fault(400,result.reasons.join(' · '));
    const rounded=point.map(v=>Number(v.toFixed(7)));
    const final=this.mapModel.check(rounded,this.now());
    if(!final.selectable)throw new Fault(400,final.reasons.join(' · '));
    return `${prefix} (${rounded[1].toFixed(7)}, ${rounded[0].toFixed(7)})`;
  }
  createPoint(point){return this.create(this.pointName(point));}
  read(id,credential){const state=super.read(id,credential);return {...state,mapPoint:decodePoint(state.place),proposal:state.proposal?{...state.proposal,mapPoint:decodePoint(state.proposal.place)}:null};}
  act(id,credential,command){
    // Authenticate before geometry work; base still checks view/version/replay/state.
    const r=this.room(id);this.auth(r,credential);
    if(command?.type==='proposePoint')command={...command,type:'propose',place:this.pointName(command.point)};
    if(command?.type==='accept'&&decodePoint(r.proposal?.place)&&!this.isPlaceAllowed(r.proposal.place))throw new Fault(409,'이 핀은 현재 선택할 수 없습니다. 지도에서 다시 확인해 주세요.');
    return super.act(id,credential,command);
  }
}
