// Prototype-only policy: these thresholds are not validated production values.
export const POLICY = Object.freeze({ freshMs: 5 * 60_000, minContributors: 5 });
export const canInteract = mode => mode === 'parked';

export function ageMs(timestamp, now) {
  if (!Number.isFinite(timestamp) || !Number.isFinite(now)) return null;
  const age = now - timestamp;
  return age >= 0 ? age : null;
}

export function describeLot(lot, { now, connected = true, mode = 'unknown' }) {
  const base = { kind: 'unknown', title: '정보 부족', detail: '빈자리 수를 알 수 없습니다.', available: null, age: null };
  if (!canInteract(mode)) return { ...base, kind: 'locked', title: '상세 안내 잠김', detail: '운행 상태를 확인할 수 없거나 주행 제한 중입니다.' };
  if (!connected) return { ...base, kind: 'offline', title: '연결 끊김', detail: '이전 값으로 현재 주차 가능 여부를 판단하지 않습니다.' };
  if (lot.source === 'official') {
    const age = ageMs(lot.observedAt, now);
    if (age === null || !Number.isInteger(lot.capacity) || lot.capacity < 0 ||
      !Number.isInteger(lot.available) || lot.available < 0 || lot.available > lot.capacity) {
      return { ...base, detail: '현황 값 또는 관측 시각을 확인할 수 없습니다.' };
    }
    if (age >= POLICY.freshMs) return { ...base, kind: 'stale', title: '갱신 지연', detail: '현재 여석 표시를 중단했습니다.', age };
    return { kind: 'official', title: lot.available === 0 ? '보고된 여석 없음' : `보고된 여석 ${lot.available}면`,
      detail: '공급자 관측값입니다. 도착 시 빈자리를 보장하지 않습니다.', available: lot.available, age };
  }
  if (lot.source === 'community') {
    // Distinct, consented, correctly attributed synthetic participants only.
    // Movement is NOT labelled as a confirmed exit or added to occupancy.
    const eligible = (Array.isArray(lot.events) ? lot.events : []).filter(e => {
      const age = ageMs(e?.at, now);
      return e && e.consented === true && e.lotId === lot.id && e.attribution === 'verified' &&
        typeof e.contributor === 'string' && e.contributor.length > 0 && e.kind === 'movement' &&
        age !== null && age < POLICY.freshMs;
    });
    const distinct = new Set(eligible.map(e => e.contributor)).size;
    if (distinct < POLICY.minContributors) return { ...base, detail: '최근 참여 표본이 부족해 관측 정보를 표시하지 않습니다.' };
    return { kind: 'community', title: '최근 참여 차량 움직임 관측',
      detail: '일부 참여 차량의 관측입니다. 출차·빈자리·대기시간을 뜻하지 않습니다.',
      available: null, age: Math.max(...eligible.map(e => now - e.at)) };
  }
  return base;
}

export function transition(state, action, lots) {
  switch (action.type) {
    case 'mode': return { ...state, mode: action.value, selected: canInteract(action.value) ? state.selected : null, feedback: null };
    case 'select':
      if (!canInteract(state.mode) || !lots.some(l => l.id === action.id)) return state;
      return { ...state, selected: action.id, feedback: null };
    case 'connection': return { ...state, connected: action.value, feedback: null };
    case 'advance': return { ...state, now: state.now + 6 * 60_000, feedback: null };
    case 'feedback':
      if (!canInteract(state.mode) || !state.selected || !['useful', 'unclear'].includes(action.value)) return state;
      return { ...state, feedback: action.value };
    default: return state;
  }
}
