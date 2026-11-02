package org.example.j1input;
public final class LocationInputGateTest {
 static void eq(Object actual,Object expected){if(!actual.equals(expected))throw new AssertionError(actual+" != "+expected);}
 public static void main(String[]args){
  LocationInputGate g=new LocationInputGate();long t=g.begin("owner",true,true);
  eq(g.accept(t,"owner",true,true,0,0,1,100),LocationInputGate.State.UNVERIFIED_CLOCK);
  eq(g.accept(t,"guest",true,true,0,0,1,101),LocationInputGate.State.PERMISSION_LOST);
  if(g.current(t))throw new AssertionError("old token active");
  long n=g.begin("other",true,true);
  eq(g.accept(t,"owner",true,true,0,0,1,102),LocationInputGate.State.WAITING);
  eq(g.accept(n,"other",false,true,0,0,1,103),LocationInputGate.State.PERMISSION_LOST);
  n=g.begin("owner",true,true);
  eq(g.accept(n,"owner",true,false,0,0,1,104),LocationInputGate.State.PERMISSION_LOST);
  n=g.begin("owner",true,true);
  eq(g.accept(n,"owner",true,true,91,0,1,105),LocationInputGate.State.INVALID);
  n=g.begin("owner",true,true);
  g.accept(n,"owner",true,true,0,0,Long.MAX_VALUE,106);
  eq(g.accept(n,"owner",true,true,0,0,1,105),LocationInputGate.State.INVALID);
  n=g.begin("owner",true,true);g.error(n);eq(g.state(),LocationInputGate.State.SDK_ERROR);
  g.stop();g.stop();eq(g.state(),LocationInputGate.State.STOPPED);
  if(g.begin("owner",false,true)!=-1)throw new AssertionError("consent bypass");
  if(g.begin(null,true,true)!=-1||g.begin("",true,true)!=-1||g.begin("owner",true,false)!=-1)throw new AssertionError("bad begin");
  long old=g.begin("owner",true,true);long fresh=g.begin("owner",true,true);g.error(old);eq(g.state(),LocationInputGate.State.WAITING);
  g.stop();eq(g.accept(fresh,"owner",true,true,0,0,1,200),LocationInputGate.State.STOPPED);
  System.out.println("PASS: clock gate, profiles, consent, permission, generation, coordinates, receipt order, SDK error, idempotent stop");
 }
}
