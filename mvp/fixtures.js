// All places, occupancy values and contributors below are synthetic.
export const DEMO_NOW = Date.parse('2026-11-02T12:00:00+09:00');
export function makeLots(scenario = 'normal') {
  const events = Array.from({ length: scenario === 'sparse' ? 2 : 5 }, (_, i) => ({
    contributor: `synthetic-${i}`, lotId: 'garden', kind: 'movement',
    attribution: 'verified', consented: true, at: DEMO_NOW - 60_000,
  }));
  return [
    { id: 'central', name: '가상 중앙 공영주차장', source: 'official', sourceName: '공식 데이터 형식 · 합성',
      walk: '목적지까지 도보 4분', price: '10분 500원', hours: '09:00–22:00',
      capacity: 100, available: scenario === 'full' ? 0 : 12,
      observedAt: DEMO_NOW - (scenario === 'stale' ? 7 * 60_000 : 60_000),
      entrance: '가상 동문 입구', directions: '가상 시설의 동문을 차량 입구로 설정했습니다.',
      restriction: '일반 방문 차량 대상 · 실제 운영 조건 아님' },
    { id: 'garden', name: '가상 가든 민영주차장', source: 'community', sourceName: '참여 차량 관측 형식 · 합성',
      walk: '목적지까지 도보 2분', price: '10분 700원', hours: '08:00–23:00', events,
      entrance: '가상 남문 입구', directions: '가상 시설의 남문을 차량 입구로 설정했습니다.',
      restriction: '일반 방문 차량 대상 · 여석 연계 없음' },
    { id: 'river', name: '가상 리버 빌딩 주차장', source: 'none', sourceName: '현황 연계 없음',
      walk: '목적지까지 도보 6분', price: '요금 확인 필요', hours: '운영시간 확인 필요',
      entrance: null, directions: null, restriction: '방문객 이용 가능 여부 확인 필요' },
  ];
}
