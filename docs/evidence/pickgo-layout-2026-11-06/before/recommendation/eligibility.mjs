// Server-owned normalized restrictions. Unknown is selectable, never a legal guarantee.
const impossible = new Set(['building-interior','motorway','motorway-lane','road-center','sidewalk','crosswalk','intersection','water','railway']);
export function assessPickup(e = {}) {
  const reasons=[];
  if(e.stopProhibited === true || e.prohibited === true) reasons.push('정차 금지');
  if(e.pickupAllowed === false) reasons.push('승하차 금지');
  if(e.vehicleAllowed === false || e.closed === true) reasons.push('차량 진입 불가');
  if(e.publicTransportOnly === true || e.taxiOnly === true) reasons.push('전용 정차 공간');
  if(e.physicallyAccessible === false || impossible.has(e.positionType)) reasons.push('차량 승하차 불가 위치');
  if(e.maxDwellSeconds != null && (!Number.isFinite(e.maxDwellSeconds) || e.maxDwellSeconds <= 0)) reasons.push('정차 가능 시간 없음');
  const advisories=[];
  if(e.pickupAllowed !== true) advisories.push('정차 허용 여부 미확인');
  if(e.parkingProhibited === true) advisories.push('주차 금지: 대기·주차 없이 승하차만');
  if(e.enforcementCamera === true) advisories.push('단속 안내 확인 필요');
  if(e.vehicleAllowed !== true || e.physicallyAccessible !== true) advisories.push('현장 접근 조건 확인 필요');
  return {selectable:reasons.length===0,reasons,advisories};
}
