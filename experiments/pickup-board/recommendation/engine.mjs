// Provider-normalized contract, not a claim that any public API supplies curb permission.
export const POLICY = Object.freeze({ fixTtlMs: 15000, maxAccuracyM: 50, resultTtlMs: 5000, dwellSeconds: 60, arrivalMarginSeconds:60, evidenceMaxAgeMs:900000, uturnPenaltySeconds: 120 });
const finite = x => typeof x === 'number' && Number.isFinite(x);
const nonnegative = x => finite(x) && x >= 0;
const text = x => typeof x === 'string' && x.length > 0 && x.length <= 300;
export function freshFix(f, now) {
  return f && text(f.id) && finite(now) && finite(f.at) && nonnegative(f.ageMs) && now >= f.at && now - f.at + f.ageMs < POLICY.fixTtlMs &&
    finite(f.latitude) && Math.abs(f.latitude) <= 90 && finite(f.longitude) && Math.abs(f.longitude) <= 180 &&
    finite(f.accuracy) && f.accuracy > 0 && f.accuracy <= POLICY.maxAccuracyM;
}
export function rankCandidates({ driver, rider, route, candidates, mode }, now, wall) {
  const empty = reason => ({ status: reason, candidates: [], mode });
  if (!['live','synthetic'].includes(mode)) return empty('provider-unavailable');
  if (!freshFix(driver, now) || !freshFix(rider, now)) return empty('location-unavailable');
  if (!route || !text(route.id) || route.driverFixId !== driver.id || route.riderFixId !== rider.id || route.mode !== mode ||
      !finite(route.until) || now >= route.until || !finite(route.at) || now < route.at || now-route.at >= POLICY.fixTtlMs) return empty('route-unavailable');
  if (!Array.isArray(candidates) || candidates.length > 100) return empty('provider-invalid');
  const ids = new Set();
  const eligible = [];
  for (const c of candidates) {
    if (!c || !text(c.id) || ids.has(c.id)) continue;
    ids.add(c.id);
    const e=c.evidence, v=c.vehicle, w=c.walk;
    if (!text(c.name) || !text(c.entranceId) || c.mode !== mode || !e || !v || !w) continue;
    if (e.entranceId !== c.entranceId || e.mode !== mode || !text(e.source) || !text(e.reference) ||
        e.pickupAllowed !== true || e.vehicleAllowed !== true || e.closed !== false || e.prohibited !== false ||
        !finite(e.checkedAt) || e.checkedAt > wall || wall-e.checkedAt>=POLICY.evidenceMaxAgeMs || !finite(e.validFrom) || wall < e.validFrom || !finite(e.validUntil) ||
        !finite(e.maxDwellSeconds) || e.maxDwellSeconds < POLICY.dwellSeconds) continue;
    if (v.routeId !== route.id || w.routeId !== route.id || v.entranceId !== c.entranceId || w.entranceId !== c.entranceId ||
        v.reachable !== true || v.legalApproach !== true || w.reachable !== true || w.pathVerified !== true ||
        !text(v.source) || !text(w.source) || !text(v.approach) || !nonnegative(v.detourSeconds) || !nonnegative(v.arrivalSeconds) ||
        !Number.isInteger(v.uturns) || v.uturns < 0 || !nonnegative(w.seconds) || !nonnegative(w.meters)) continue;
    // Permission must cover arrival of BOTH parties and the planned pickup dwell.
    if (wall + (Math.max(v.arrivalSeconds, w.seconds) + POLICY.dwellSeconds + POLICY.arrivalMarginSeconds)*1000 >= e.validUntil) continue;
    const score=v.detourSeconds+w.seconds+v.uturns*POLICY.uturnPenaltySeconds;
    eligible.push({ id:c.id, name:c.name, entranceId:c.entranceId, score, mode,
      detourSeconds:v.detourSeconds, walkSeconds:w.seconds, walkMeters:w.meters, uturns:v.uturns,
      approach:v.approach, source:e.source, reference:e.reference, checkedAt:e.checkedAt, validUntil:e.validUntil,
      maxDwellSeconds:e.maxDwellSeconds,
      reason:`차량 우회 ${v.detourSeconds}초 · 보행 경로 ${w.seconds}초/${w.meters}m · 유턴 ${v.uturns}회` });
  }
  eligible.sort((a,b)=>a.score-b.score || a.id.localeCompare(b.id));
  return { status:eligible.length?'ready':'no-eligible-candidate', mode, candidates:eligible.slice(0,3),
    remainingMs:Math.max(0, Math.min(POLICY.resultTtlMs, route.until-now, POLICY.fixTtlMs-(now-driver.at+driver.ageMs), POLICY.fixTtlMs-(now-rider.at+rider.ageMs))) };
}
