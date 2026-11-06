import {readFileSync} from 'node:fs';
import {buildMapModel,MAX_DATA_AGE_MS} from './model.mjs';
export const mapModel=buildMapModel(JSON.parse(readFileSync(new URL('./data/yangjae.json',import.meta.url),'utf8')));
let cached;
export function mapData(now=Date.now()){
  // Geometry is immutable during a process; freshness is still checked per request.
  if(!cached)cached=mapModel.publicData(Date.parse(mapModel.data.retrievedAt));
  const age=now-Date.parse(mapModel.data.retrievedAt);
  return {...cached,available:age>=0&&age<MAX_DATA_AGE_MS,recommendations:age>=0&&age<MAX_DATA_AGE_MS?cached.recommendations:[]};
}
