import { createServer } from '../server.mjs';
import { RecommendationBoard } from './board.mjs';
import { syntheticProvider } from './providers.mjs';
const port=Number(process.env.PICKUP_PORT||4187);
createServer(new RecommendationBoard(Date.now,()=>performance.now(),syntheticProvider)).listen(port,'127.0.0.1',()=>console.log(`합성 추천 전용 시연 http://127.0.0.1:${port} · 실제 위치/경로/정차 데이터 아님`));
