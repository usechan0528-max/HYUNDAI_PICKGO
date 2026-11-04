package org.example.pickgonaviprobe;

import android.app.Activity;
import android.content.Intent;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.widget.TextView;
import java.lang.reflect.Proxy;
import java.util.Arrays;
import ai.pleos.playground.navi.helper.NaviHelper;
import ai.pleos.playground.navi.helper.listener.NaviHelperEventListener;
import ai.pleos.playground.navi.data.NavigationScreenRequest;
import kotlin.Unit;

/** Emulator-only public SDK observation. No route write permission or route mutation calls.
 * Logs fixture coordinates locally; never use on a real vehicle or personal destinations. */
public final class ProbeActivity extends Activity {
 static ProbeActivity current;
 private final Handler handler = new Handler(Looper.getMainLooper());
 private NaviHelper navi;
 private NaviHelperEventListener listener;
 private boolean ready;
 private int polls;
 private TextView text;
 private void record(String value) { Log.i("PickgoNaviProbe", value); }
 private final Runnable poll = new Runnable() { public void run() {
  if (!ready || polls++ >= 300) return;
  try { record("POLL " + polls); navi.getDestinationInfo(); navi.getRouteStateInfo(); }
  catch (Exception e) { record("QUERY_ERROR " + e); }
  handler.postDelayed(this, 2000);
 }};
 @Override public void onCreate(Bundle saved) {
  super.onCreate(saved);
  current = this;
  text = new TextView(this); text.setTextSize(26);
  text.setText("PICKGO 내비 수신 시험\n제품 앱 아님 · 에뮬레이터 전용\n경로 쓰기 권한 없음\n선택 결과는 SDK 이벤트로만 관찰"); setContentView(text);
  record("CREATE action=" + getIntent().getAction());
  listener = (NaviHelperEventListener) Proxy.newProxyInstance(NaviHelperEventListener.class.getClassLoader(), new Class<?>[]{NaviHelperEventListener.class}, (proxy, method, args) -> {
   if (method.getName().equals("hashCode")) return System.identityHashCode(proxy);
   if (method.getName().equals("equals")) return proxy == args[0];
   if (method.getName().equals("toString")) return "PickgoObserver";
   record("EVENT " + method.getName() + " " + Arrays.toString(args));
   return null;
  });
  navi = new NaviHelper(this);
  try { navi.initialize(() -> { handler.post(() -> {
   ready = true; navi.addListener(listener); record("CONNECTED"); handler.post(poll); command(getIntent());
  }); return Unit.INSTANCE; }, error -> { record("CONNECT_ERROR " + error); return Unit.INSTANCE; }); }
  catch (Exception e) { record("INIT_ERROR " + e); }
 }
 void command(Intent intent) {
  if (!ready) return;
  String command = intent.getStringExtra("command");
  record("COMMAND " + command);
  try {
   if ("search".equals(command)) navi.requestNavigationScreen(new NavigationScreenRequest.SearchPlace(intent.getStringExtra("keyword")));
   if ("foreground".equals(command)) navi.requestNavigationScreen(NavigationScreenRequest.Foreground.INSTANCE);
  } catch (Exception e) { record("COMMAND_ERROR " + e); }
 }
 @Override protected void onNewIntent(Intent intent) { super.onNewIntent(intent); setIntent(intent); record("NEW_INTENT action=" + intent.getAction() + " data=" + intent.getData() + " extras=" + intent.getExtras()); command(intent); }
 @Override protected void onActivityResult(int request, int result, Intent data) { super.onActivityResult(request,result,data); record("ACTIVITY_RESULT " + request + " " + result + " " + data); }
 @Override protected void onResume() { super.onResume(); record("RESUME"); }
 @Override protected void onPause() { record("PAUSE"); super.onPause(); }
 @Override protected void onDestroy() { current=null; ready=false; handler.removeCallbacksAndMessages(null); if(navi!=null) { navi.removeListener(listener); navi.release(); } record("DESTROY"); super.onDestroy(); }
}
