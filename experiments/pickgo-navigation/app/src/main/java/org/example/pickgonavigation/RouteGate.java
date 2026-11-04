package org.example.pickgonavigation;

/** Pure policy. All times are monotonic. Coordinates are WGS84, never diagram pixels. */
public final class RouteGate {
 public static final long TTL = 8000;
 public record Target(String id, long version, long revision, double lat, double lon, long observed) {
  public String key() { return id + ":" + revision; }
 }
 public static Target validate(String id, String role, String status, boolean joined, String stage,
   boolean proposal, long version, long revision, double lon, double lat, long observed) {
  if (id == null || !id.matches("[a-f0-9-]{36}") || !"driver".equals(role) || !"active".equals(status)
    || !joined || !"waiting".equals(stage) || proposal || version < 1 || revision < 1
    || !Double.isFinite(lat) || !Double.isFinite(lon) || lon < 127.032 || lon > 127.050 || lat < 37.455 || lat > 37.471)
   throw new IllegalArgumentException("확정된 지도 지점과 상대 참여를 확인하세요. 변경 제안 중에는 안내할 수 없습니다.");
  return new Target(id, version, revision, lat, lon, observed);
 }
 public static boolean fresh(Target target, long now) { return target != null && now >= target.observed && now - target.observed < TTL; }
 public static boolean same(Target a, Target b) {
  return a != null && b != null && a.id.equals(b.id) && a.version == b.version && a.revision == b.revision
    && a.lat == b.lat && a.lon == b.lon;
 }
 public static boolean matches(Target target, double lat, double lon) {
  return target != null && Math.abs(target.lat-lat) <= 0.00002 && Math.abs(target.lon-lon) <= 0.00002;
 }
 public static boolean samePlace(Target a, Target b) {
  // Post-dispatch: ready toggles change version but not the agreed place. Pre-dispatch uses same().
  return a!=null&&b!=null&&a.id.equals(b.id)&&a.revision==b.revision&&a.lat==b.lat&&a.lon==b.lon;
 }
 public static boolean confirmed(boolean matches,boolean guiding,long now,long destinationAt,long modeAt){
  return matches&&guiding&&now>=destinationAt&&now>=modeAt&&now-destinationAt<3000&&now-modeAt<3000;
 }
 public enum Observation { WAITING, GUIDING, LAST_GUIDING, TIMEOUT, ROUND_UNAVAILABLE }
 public static Observation observation(boolean roundIntact,long roomChecked,boolean matches,boolean guiding,
   long now,long destinationAt,long modeAt,boolean finished){
  if(!roundIntact||now<roomChecked||now-roomChecked>=TTL)return Observation.ROUND_UNAVAILABLE;
  if(confirmed(matches,guiding,now,destinationAt,modeAt))return finished?Observation.LAST_GUIDING:Observation.GUIDING;
  return finished?Observation.TIMEOUT:Observation.WAITING;
 }
}
