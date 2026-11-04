package org.example.pickgonavigation;
public final class RouteGateTest {
 static int count;
 static void check(boolean v){count++;if(!v)throw new AssertionError("case "+count);}
 static RouteGate.Target target(String role,String status,boolean joined,String stage,boolean proposal,double lon,double lat){return RouteGate.validate("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",role,status,joined,stage,proposal,2,1,lon,lat,1000);}
 static void rejects(Runnable r){try{r.run();throw new AssertionError("not rejected");}catch(IllegalArgumentException ok){count++;}}
 public static void main(String[] args){
  var t=target("driver","active",true,"waiting",false,127.04,37.46);
  check(RouteGate.fresh(t,8999));check(!RouteGate.fresh(t,9000));check(!RouteGate.fresh(t,999));
  check(RouteGate.matches(t,37.46,127.04));check(!RouteGate.matches(t,127.04,37.46));check(!RouteGate.matches(t,37.4601,127.04));
  check(RouteGate.same(t,t));check(!RouteGate.same(t,new RouteGate.Target(t.id(),3,1,t.lat(),t.lon(),1000)));
  check(!RouteGate.same(t,new RouteGate.Target(t.id(),2,2,t.lat(),t.lon(),1000)));
  check(RouteGate.samePlace(t,new RouteGate.Target(t.id(),3,1,t.lat(),t.lon(),1000)));
  check(!RouteGate.samePlace(t,new RouteGate.Target(t.id(),3,2,t.lat(),t.lon(),1000)));
  check(RouteGate.confirmed(true,true,3000,1000,2000));
  check(!RouteGate.confirmed(false,true,3000,1000,2000));
  check(!RouteGate.confirmed(true,false,3000,1000,2000));
  check(!RouteGate.confirmed(true,true,4000,1000,2000));
  check(!RouteGate.confirmed(true,true,4000,2000,1000));
  check(!RouteGate.confirmed(true,true,999,1000,2000));
  // A callback sequence must revoke success after mode loss, mismatched destination or stale data.
  check(RouteGate.observation(true,1000,false,false,2000,1000,1000,false)==RouteGate.Observation.WAITING);
  check(RouteGate.observation(true,1000,true,true,2000,1000,1000,false)==RouteGate.Observation.GUIDING);
  check(RouteGate.observation(true,1000,true,false,2200,1000,2200,false)==RouteGate.Observation.WAITING);
  check(RouteGate.observation(true,1000,false,true,2200,2200,2200,false)==RouteGate.Observation.WAITING);
  check(RouteGate.observation(true,1000,true,true,4000,1000,1000,false)==RouteGate.Observation.WAITING);
  check(RouteGate.observation(false,2000,true,true,2200,2100,2100,false)==RouteGate.Observation.ROUND_UNAVAILABLE);
  check(RouteGate.observation(true,1000,true,true,9000,8900,8900,false)==RouteGate.Observation.ROUND_UNAVAILABLE);
  check(RouteGate.observation(true,44000,true,true,45000,44000,44000,true)==RouteGate.Observation.LAST_GUIDING);
  check(RouteGate.observation(true,44000,false,true,45000,44000,44000,true)==RouteGate.Observation.TIMEOUT);
  check(RouteGate.observation(false,44000,true,true,45000,44000,44000,true)==RouteGate.Observation.ROUND_UNAVAILABLE);
  for(String role:new String[]{"rider","",null})rejects(()->target(role,"active",true,"waiting",false,127.04,37.46));
  rejects(()->target("driver","ended",true,"waiting",false,127.04,37.46));
  rejects(()->target("driver","active",false,"waiting",false,127.04,37.46));
  for(String stage:new String[]{"arrived","boarded"})rejects(()->target("driver","active",true,stage,false,127.04,37.46));
  rejects(()->target("driver","active",true,"waiting",true,127.04,37.46));
  for(double bad:new double[]{Double.NaN,Double.POSITIVE_INFINITY,37.46,127.1})rejects(()->target("driver","active",true,"waiting",false,bad,37.46));
  for(double bad:new double[]{Double.NaN,Double.NEGATIVE_INFINITY,127.04,37.5})rejects(()->target("driver","active",true,"waiting",false,127.04,bad));
  System.out.println("RouteGate: "+count+" assertions passed");
 }
}
