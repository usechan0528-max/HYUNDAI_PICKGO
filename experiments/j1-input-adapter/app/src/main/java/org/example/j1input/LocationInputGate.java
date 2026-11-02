package org.example.j1input;

/** Pure domain gate. Receiving data never certifies its observation clock. */
public final class LocationInputGate {
 public enum State { STOPPED, WAITING, UNVERIFIED_CLOCK, INVALID, PERMISSION_LOST, SDK_ERROR }
 private long generation;
 private String profile;
 private State state=State.STOPPED;
 private long lastReceive=-1;
 public synchronized long begin(String profile,boolean consent,boolean permission){
  stop();
  if(profile==null||profile.isEmpty()||!consent||!permission)return -1;
  this.profile=profile;state=State.WAITING;return generation;
 }
 public synchronized void stop(){generation++;profile=null;lastReceive=-1;state=State.STOPPED;}
 public synchronized State accept(long token,String currentProfile,boolean consent,boolean permission,
   double latitude,double longitude,long rawTimestamp,long receivedElapsed){
  if(token!=generation||profile==null)return state;
  if(!profile.equals(currentProfile)||!consent||!permission){stop();state=State.PERMISSION_LOST;return state;}
  if(!Double.isFinite(latitude)||Math.abs(latitude)>90||!Double.isFinite(longitude)||Math.abs(longitude)>180||receivedElapsed<0||receivedElapsed<lastReceive){
   stop();state=State.INVALID;return state;
  }
  lastReceive=receivedElapsed;
  // Deliberately no conversion from rawTimestamp or receipt to observedAtMs.
  state=State.UNVERIFIED_CLOCK;return state;
 }
 public synchronized boolean current(long token){return profile!=null&&token==generation;}
 public synchronized void error(long token){if(current(token)){stop();state=State.SDK_ERROR;}}
 public synchronized State state(){return state;}
}
