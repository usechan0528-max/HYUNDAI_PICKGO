package org.example.j1input;
import android.app.Activity;
import android.os.*;
import android.util.Log;
import android.widget.TextView;
/** Emulator-only harness for actual input adapter; never logs coordinates. */
public final class ClockProbeActivity extends Activity {
 private PleosLocationInput input;private SdkStatusPublisher publisher;
 private final Handler handler=new Handler(Looper.getMainLooper());
 private int samples;private long lastRaw=Long.MIN_VALUE;
 @Override public void onCreate(Bundle b){super.onCreate(b);TextView v=new TextView(this);v.setText("J1 actual SDK input — clock unverified, recommendation blocked");setContentView(v);}
 @Override public void onStart(){super.onStart();samples=0;lastRaw=Long.MIN_VALUE;
  if(!"ranchu".equals(android.os.Build.HARDWARE)){finish();return;}
  publisher=new SdkStatusPublisher();
  input=new PleosLocationInput(this,new PleosLocationInput.Sink(){
   public void cleanupIssue(String issue){Log.i("J1Input","CLEANUP_ISSUE="+issue);}
   public void state(String state){Log.i("J1Input","STATE="+state);publisher.send(state,samples);}
   public void clock(long raw,long wall,long elapsed,LocationInputGate.State state){samples++;publisher.send("CALLBACK",samples);
    Log.i("J1Input","SAMPLE raw="+raw+" wall="+wall+" elapsed="+elapsed+" delta="+(lastRaw==Long.MIN_VALUE?0:raw-lastRaw)+" state="+state);lastRaw=raw;}
  });
  input.start("emulator-test",true);
  handler.postDelayed(()->{input.revoke();Log.i("J1Input","REVOKE samples="+samples);},60000);
  handler.postDelayed(()->{Log.i("J1Input","AFTER_REVOKE samples="+samples);finish();},65000);
 }
 @Override public void onStop(){handler.removeCallbacksAndMessages(null);if(input!=null){input.close();input=null;}if(publisher!=null){publisher.send("STOPPED",samples);publisher.close();publisher=null;}Log.i("J1Input","STOPPED");super.onStop();}
}
