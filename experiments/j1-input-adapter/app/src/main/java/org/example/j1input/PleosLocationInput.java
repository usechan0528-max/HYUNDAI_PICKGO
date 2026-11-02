package org.example.j1input;
import android.content.Context;
import android.content.pm.PackageManager;
import android.os.*;
import ai.pleos.playground.location.fused.FusedLocation;
import ai.pleos.playground.location.fused.listener.FusedLocationListener;
import ai.pleos.playground.location.fused.model.LocationData;

/** Main-thread lifecycle adapter. No persistence, networking, or route writes. */
public final class PleosLocationInput implements AutoCloseable {
 public interface Sink {void state(String state);void cleanupIssue(String issue);void clock(long raw,long wall,long elapsed,LocationInputGate.State state);}
 private final Context context;private final Sink sink;
 private final Handler handler=new Handler(Looper.getMainLooper());
 private final LocationInputGate gate=new LocationInputGate();
 private FusedLocation sdk;private FusedLocationListener listener;
 private String profile;private boolean consent;private long token=-1;
 private boolean permission(){return context.checkSelfPermission("pleos.car.permission.FUSED_LOCATION")==PackageManager.PERMISSION_GRANTED;}
 private void main(){if(Looper.myLooper()!=Looper.getMainLooper())throw new IllegalStateException("main thread required");}
 public PleosLocationInput(Context context,Sink sink){this.context=context.getApplicationContext();this.sink=sink;}
 public void start(String profile,boolean consent){
  main();close();this.profile=profile;this.consent=consent;
  token=gate.begin(profile,consent,permission());if(token<0){sink.state("ACCESS_DENIED");return;}
  final long generation=token;
  listener=new FusedLocationListener(){
   public synchronized void onChanged(LocationData location){
    final long elapsed=SystemClock.elapsedRealtime(),wall=System.currentTimeMillis();
    // SDK object is copied before crossing threads. No SDK metadata is logged by this class.
    final double lat,lon;final long raw;
    try{if(location==null){handler.post(()->fail(generation,"NO_LOCATION"));return;}
     lat=location.getLatitude();lon=location.getLongitude();raw=location.getTimestampMillis();
    }catch(Exception e){handler.post(()->fail(generation,"INVALID_INPUT"));return;}
    handler.post(()->{
     if(!gate.current(generation))return;
     LocationInputGate.State state=gate.accept(generation,PleosLocationInput.this.profile,PleosLocationInput.this.consent,permission(),lat,lon,raw,elapsed);
     if(state==LocationInputGate.State.UNVERIFIED_CLOCK)sink.clock(raw,wall,elapsed,state);
     else {close();sink.state(state.name());}
    });
   }
   public void onError(Exception error){handler.post(()->fail(generation,"SDK_ERROR"));}
  };
  try{sdk=new FusedLocation(context);if(!sdk.isSupported()){close();sink.state("UNSUPPORTED");return;}
   sdk.initialize();sdk.registerFusedLocationCallback(listener);sink.state("WAITING");
   handler.postDelayed(()->{if(gate.current(generation)&&gate.state()==LocationInputGate.State.WAITING)fail(generation,"FIRST_CALLBACK_TIMEOUT");},30000);
  }catch(Exception e){fail(generation,"SETUP_ERROR");}
 }
 private void fail(long generation,String reason){if(!gate.current(generation))return;close();sink.state(reason);}
 /** Any profile/consent change ends collection; caller explicitly starts a new session. */
 public void revoke(){main();close();sink.state("REVOKED");}
 @Override public void close(){main();gate.stop();token=-1;consent=false;profile=null;handler.removeCallbacksAndMessages(null);
  FusedLocation old=sdk;FusedLocationListener oldListener=listener;sdk=null;listener=null;
  if(old!=null){try{if(oldListener!=null)old.unregisterFusedLocationCallback(oldListener);}catch(Exception e){sink.cleanupIssue("UNREGISTER_FAILED");}
   try{old.release();}catch(Exception e){sink.cleanupIssue("RELEASE_FAILED");}}
 }
}
