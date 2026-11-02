package org.example.pleosprobe;

import android.app.*;
import android.content.Intent;
import android.os.*;
import android.util.Log;
import ai.pleos.playground.navi.helper.NaviHelper;
import ai.pleos.playground.navi.helper.listener.NaviHelperEventListener;
import ai.pleos.playground.navi.data.*;
import ai.pleos.playground.navi.constants.NaviErrorCode;
import kotlin.Unit;

/** Bounded foreground diagnostic, allowing the navigation UI to remain visible. */
public final class MovementProbeService extends Service {
    private final Handler handler = new Handler(Looper.getMainLooper());
    private NaviHelper navi;
    private boolean closed, listening;
    private Double lat, lon;
    private int count;
    private android.location.LocationManager gps;
    private final android.location.OnNmeaMessageListener nmeaListener = (message,timestamp) -> {
        if(closed)return;
        String raw=message.trim();int star=raw.indexOf('*');
        if(star<0||!raw.startsWith("$"))return;
        int checksum=0;for(int i=1;i<star;i++)checksum^=raw.charAt(i);
        try {log("NMEA type="+raw.substring(1,Math.min(6,raw.length()))+" utc="+raw.split(",")[1]+" validChecksum="+(checksum==Integer.parseInt(raw.substring(star+1,star+3),16)));}
        catch(RuntimeException e){log("NMEA_MALFORMED");}
    };
    private void log(String text) { Log.i("NaviDriveProbe", SystemClock.elapsedRealtime()+" "+text); }
    private final NaviHelperEventListener listener = new NaviHelperEventListener() {
        public void onCurrentLocationInfo(CurrentLocationInfo value) {
            if(value==null) return;
            double a=value.getLatitude(), b=value.getLongitude();
            handler.post(() -> {
                if(closed) return;
                if(!Double.isFinite(a)||!Double.isFinite(b)||Math.abs(a)>90||Math.abs(b)>180) {log("LOCATION_INVALID");return;}
                boolean baseline=lat==null;
                boolean changed=!baseline&&(Math.abs(a-lat)>0.000001||Math.abs(b-lon)>0.000001);
                int fixture=-1;
                for(int i=0;i<=60;i++)if(Math.abs(a-(37.4000+i*.0001))<.00004&&Math.abs(b-127.1000)<.00004)fixture=i;
                log("NAVI_LOCATION baseline="+baseline+" changed="+changed+" syntheticStep="+fixture);
                lat=a;lon=b;
            });
        }
        public void onDestinationInfo(DestinationInfo value) {
            if(value!=null) handler.post(() -> {if(!closed) log("DESTINATION remainTime="+value.getRemainTime()+" remainDistance="+value.getRemainDistance());});
        }
        public void onDrivingInfo(DrivingInfo value) {
            if(value!=null&&value.getDestination()!=null) handler.post(() -> {if(!closed) log("DRIVING seconds="+value.getDestination().getDuration());});
        }
        public void onRouteStateInfo(RouteStateInfo value) {
            if(value!=null) handler.post(() -> {if(!closed) log("ROUTE mode="+value.getNaviMode()+" routing="+value.isRouting());});
        }
        public void onError(NaviErrorCode value) {handler.post(() -> {if(!closed) log("ERROR "+value);});}
    };
    private final Runnable query = new Runnable() {
        public void run() {
            if(closed||!listening||count++>=90) return;
            try {navi.getCurrentLocationInfo();navi.getDestinationInfo();navi.getRouteStateInfo();}
            catch(Exception e) {log("QUERY_ERROR "+e.getClass().getName());}
            handler.postDelayed(this,2000);
        }
    };
    @Override public void onCreate() {
        super.onCreate();
        if(!"ranchu".equals(Build.HARDWARE)) {stopSelf();return;}
        if(checkSelfPermission(android.Manifest.permission.ACCESS_FINE_LOCATION)!=android.content.pm.PackageManager.PERMISSION_GRANTED) {
            log("PERMISSION_DENIED fineLocation");stopSelf();return;
        }
        NotificationManager manager=getSystemService(NotificationManager.class);
        manager.createNotificationChannel(new NotificationChannel("sdk-diagnostic","SDK diagnostic",NotificationManager.IMPORTANCE_LOW));
        startForeground(7,new Notification.Builder(this,"sdk-diagnostic").setContentTitle("Navigation SDK diagnostic")
            .setContentText("Emulator only; stops automatically after 3 minutes")
            .setSmallIcon(android.R.drawable.ic_menu_mylocation).build());
        log("START boundedMs=180000");
        try {gps=getSystemService(android.location.LocationManager.class);gps.addNmeaListener(nmeaListener,handler);}
        catch(SecurityException e){log("NMEA_LISTEN_ERROR SecurityException");}
        catch(Exception e){log("NMEA_LISTEN_ERROR "+e.getClass().getName());}
        handler.postDelayed(this::stopSelf,180000);
        try {
            navi=new NaviHelper(getApplicationContext());
            navi.initialize(() -> {handler.post(() -> {
                if(closed||listening)return;
                try {navi.addListener(listener);listening=true;handler.post(query);}
                catch(Exception e) {log("INIT_ERROR "+e.getClass().getName());stopSelf();}
            });return Unit.INSTANCE;}, error -> {handler.post(() -> {if(!closed){log("INIT_ERROR "+error.getClass().getName());stopSelf();}});return Unit.INSTANCE;});
        } catch(Exception e) {log("INIT_ERROR "+e.getClass().getName());stopSelf();}
    }
    @Override public int onStartCommand(Intent intent,int flags,int startId) {return START_NOT_STICKY;}
    @Override public IBinder onBind(Intent intent) {return null;}
    @Override public void onDestroy() {
        closed=true;handler.removeCallbacksAndMessages(null);
        if(gps!=null)gps.removeNmeaListener(nmeaListener);
        if(navi!=null) {
            try {if(listening)navi.removeListener(listener);} catch(Exception e){log("REMOVE_ERROR "+e.getClass().getName());}
            try {navi.release();} catch(Exception e){log("RELEASE_ERROR "+e.getClass().getName());}
        }
        log("CLOSED");super.onDestroy();
    }
}
