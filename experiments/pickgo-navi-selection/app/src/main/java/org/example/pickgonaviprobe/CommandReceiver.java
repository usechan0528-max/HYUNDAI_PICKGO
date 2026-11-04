package org.example.pickgonaviprobe;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
/** Debug emulator control only; avoids bringing the observer over the navigation UI. */
public final class CommandReceiver extends BroadcastReceiver {
 @Override public void onReceive(Context context, Intent intent) {
  if (ProbeActivity.current != null) ProbeActivity.current.command(intent);
 }
}
