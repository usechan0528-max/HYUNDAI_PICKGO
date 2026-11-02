package org.example.pleosprobe;

import android.app.Activity;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.util.Log;
import android.widget.TextView;
import ai.pleos.playground.location.fused.FusedLocation;
import ai.pleos.playground.location.fused.listener.FusedLocationListener;
import ai.pleos.playground.location.fused.model.LocationData;
import ai.pleos.playground.navi.helper.NaviHelper;
import ai.pleos.playground.navi.helper.listener.NaviHelperEventListener;
import ai.pleos.playground.navi.data.*;
import ai.pleos.playground.navi.constants.*;
import kotlin.Unit;
import java.util.concurrent.atomic.AtomicInteger;

/** Emulator SDK probe. Route changes require explicit test_route extra on ranchu. */
public final class ProbeActivity extends Activity {
    private final Handler handler = new Handler(Looper.getMainLooper());
    private TextView view;
    private FusedLocation location;
    private NaviHelper navi;
    private volatile boolean closed;
    private boolean locationInitialized, subscribed, naviListening;
    private final AtomicInteger locationCallbacks = new AtomicInteger();
    private final AtomicInteger validLocationCallbacks = new AtomicInteger();
    private final AtomicInteger naviCallbacks = new AtomicInteger();
    private Double previousLatitude, previousLongitude;
    private Double previousNaviLatitude, previousNaviLongitude;
    private final AtomicInteger changedLocations = new AtomicInteger();
    private int movementQueries;
    private final Runnable movementQuery = new Runnable() {
        public void run() {
            if (closed || !naviListening || movementQueries++ >= 36) return;
            try { navi.getCurrentLocationInfo(); navi.getDestinationInfo(); navi.getRouteStateInfo(); }
            catch (Exception error) { event("MOVEMENT_QUERY_ERROR " + error.getClass().getName()); }
            handler.postDelayed(this, 5000);
        }
    };
    private void event(String text) {
        handler.post(() -> {
            if (closed) return;
            String line = SystemClock.elapsedRealtime() + " " + text;
            Log.i("PleosProbe", line);
            if (view.length() > 10000) view.setText("Emulator SDK probe\n");
            view.append(line + "\n");
        });
    }
    private final FusedLocationListener locations = new FusedLocationListener() {
        public void onChanged(LocationData value) {
            if (closed) return;
            locationCallbacks.incrementAndGet();
            boolean valid = value != null && Double.isFinite(value.getLatitude()) &&
                Double.isFinite(value.getLongitude()) && Math.abs(value.getLatitude()) <= 90 &&
                Math.abs(value.getLongitude()) <= 180;
            if (valid) validLocationCallbacks.incrementAndGet();
            event("LOCATION_CALLBACK present=" + (value != null) + " validCoordinates=" + valid);
            if (valid) {
                double latitude = value.getLatitude(), longitude = value.getLongitude();
                handler.post(() -> {
                    if (closed) return;
                    boolean changed = previousLatitude != null &&
                        (Math.abs(latitude - previousLatitude) > 0.000001 || Math.abs(longitude - previousLongitude) > 0.000001);
                    if (changed) changedLocations.incrementAndGet();
                    // Match synthetic GPS fixtures without logging arbitrary coordinates.
                    int fixture = -1;
                    for (int i = 0; i <= 10; i++) {
                        if (Math.abs(latitude - (37.4000 + i * 0.0002)) < 0.00005 &&
                            Math.abs(longitude - 127.1000) < 0.00005) fixture = i;
                    }
                    event("LOCATION_CHANGE changed=" + changed + " changes=" + changedLocations.get() + " syntheticFixture=" + fixture);
                    previousLatitude = latitude;
                    previousLongitude = longitude;
                });
            }
        }
        public void onError(Exception error) { event("LOCATION_ERROR " + error.getClass().getSimpleName()); }
    };
    private final NaviHelperEventListener navigation = new NaviHelperEventListener() {
        public void onCurrentLocationInfo(CurrentLocationInfo value) {
            received("CURRENT_LOCATION", value);
            if (value == null) return;
            double latitude = value.getLatitude(), longitude = value.getLongitude();
            handler.post(() -> {
                if (closed) return;
                boolean valid = Double.isFinite(latitude) && Double.isFinite(longitude) && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180;
                if (!valid) { event("NAVI_LOCATION_INVALID"); return; }
                boolean baseline = previousNaviLatitude == null;
                boolean changed = !baseline && (Math.abs(latitude - previousNaviLatitude) > 0.000001 || Math.abs(longitude - previousNaviLongitude) > 0.000001);
                int fixture = -1;
                for (int i = 0; i <= 10; i++) {
                    if (Math.abs(latitude - (37.4000 + i * 0.0002)) < 0.00005 && Math.abs(longitude - 127.1000) < 0.00005) fixture = i;
                }
                event("NAVI_LOCATION_CHANGE baseline=" + baseline + " changed=" + changed + " syntheticFixture=" + fixture);
                previousNaviLatitude = latitude;
                previousNaviLongitude = longitude;
            });
        }
        public void onRouteStateInfo(RouteStateInfo value) {
            received("ROUTE_STATE", value);
            if (value != null) event("ROUTE_STATUS mode=" + value.getNaviMode() + " routing=" + value.isRouting());
        }
        public void onDestinationInfo(DestinationInfo value) {
            received("DESTINATION", value);
            if (value != null) event("DESTINATION_TIME remainTimeRaw=" + value.getRemainTime());
        }
        public void onDrivingInfo(DrivingInfo value) {
            received("DRIVING", value);
            if (value != null && value.getDestination() != null)
                event("DRIVING_DURATION seconds=" + value.getDestination().getDuration());
        }
        public void onTripInfo(TripInfo value) {
            received("TRIP", value);
            if (value != null) event("TRIP_ETA rawSeconds=" + value.getEta());
        }
        public void onRouteStarted(RouteStartInfo value) { event("ROUTE_STARTED"); }
        public void onRoutingCompleted() { event("ROUTING_COMPLETED"); }
        public void onRouteCancelled() { event("ROUTE_CANCELLED"); }
        public void onDestinationChanged() { event("DESTINATION_CHANGED"); }
        public void onNavigationStatus(NavigationStatus value) { received("NAVIGATION_STATUS", value); event("NAVIGATION_STATUS_VALUE=" + value); }
        public void onError(NaviErrorCode value) { event("NAVI_ERROR " + value); }
    };
    private void received(String kind, Object value) {
        if (closed) return;
        naviCallbacks.incrementAndGet();
        event("NAVI_" + kind + " present=" + (value != null));
    }
    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        view = new TextView(this);
        view.setText("Emulator SDK probe — not real vehicle data\n");
        view.setTextSize(18);
        setContentView(view);
        event("START");
        try {
            location = new FusedLocation(getApplicationContext());
            boolean supported = location.isSupported();
            event("LOCATION_SUPPORTED=" + supported);
            if (supported) {
                location.initialize();
                locationInitialized = true;
                location.registerFusedLocationCallback(locations);
                subscribed = true;
                location.getLastKnownLocation(locations);
                event("LOCATION_REQUESTED");
                // Official guide permits calls after initialize(); this is not a readiness claim.
                for (long delay : new long[]{5000, 15000, 30000}) {
                    handler.postDelayed(() -> {
                        if (closed) return;
                        try { location.getLastKnownLocation(locations); event("LOCATION_REQUERY"); }
                        catch (Exception error) { event("LOCATION_REQUERY_ERROR " + error.getClass().getSimpleName()); }
                    }, delay);
                }
            }
        } catch (Exception error) { event("LOCATION_SETUP_ERROR " + error.getClass().getSimpleName()); }
        try {
            navi = new NaviHelper(getApplicationContext());
            navi.initialize(() -> {
                handler.post(() -> {
                    if (closed) return;
                    event("NAVI_CONNECTED");
                    try {
                        navi.addListener(navigation);
                        naviListening = true;
                        navi.getRouteStateInfo();
                        navi.getCurrentLocationInfo();
                        navi.getDestinationInfo();
                        event("NAVI_REQUESTED");
                        if (getIntent().getBooleanExtra("test_movement", false) && "ranchu".equals(android.os.Build.HARDWARE))
                            handler.post(movementQuery);
                        if (getIntent().getBooleanExtra("test_route", false) && "ranchu".equals(android.os.Build.HARDWARE)) {
                            handler.postDelayed(() -> {
                                if (closed) return;
                                try {
                                    // Official public example POI. Actual SDK constructor is latitude first.
                                    navi.requestRoute(new RouteInfo(37.48544722, 127.03636666, null, null,
                                        "42dot", "36khp37hh8gqcm5nqhe5", "서울시 강남구 남부순환로 2621",
                                        "0", RouteOption.RECOMMENDED, "", false));
                                    event("TEST_ROUTE_REQUESTED fixture=official_42dot");
                                } catch (Exception error) { event("TEST_ROUTE_ERROR " + error.getClass().getName()); }
                            }, 3000);
                            for (long delay : new long[]{10000, 30000, 60000, 90000}) {
                                handler.postDelayed(() -> {
                                    if (closed) return;
                                    try { navi.getRouteStateInfo(); navi.getDestinationInfo(); event("ROUTE_REQUERY"); }
                                    catch (Exception error) { event("ROUTE_REQUERY_ERROR " + error.getClass().getName()); }
                                }, delay);
                            }
                        }
                    } catch (Exception error) { event("NAVI_REQUEST_ERROR " + error.getClass().getSimpleName()); }
                });
                return Unit.INSTANCE;
            }, error -> { event("NAVI_CONNECT_FAILED " + error.getClass().getSimpleName()); return Unit.INSTANCE; });
        } catch (Exception error) { event("NAVI_SETUP_ERROR " + error.getClass().getSimpleName()); }
        handler.postDelayed(() -> event("OBSERVATION_60S locationCallbacks=" + locationCallbacks.get() +
            " validLocationCallbacks=" + validLocationCallbacks.get() + " naviCallbacks=" + naviCallbacks.get() +
            " (counts do not imply fresh data)"), 60000);
    }
    @Override public void onDestroy() {
        closed = true;
        handler.removeCallbacksAndMessages(null);
        if (location != null && locationInitialized) {
            try { if (subscribed) location.unregisterFusedLocationCallback(locations); }
            catch (Exception ignored) { Log.w("PleosProbe", "LOCATION_UNREGISTER_FAILED"); }
            try { location.release(); } catch (Exception ignored) { Log.w("PleosProbe", "LOCATION_RELEASE_FAILED"); }
        }
        if (navi != null) {
            try { if (naviListening) navi.removeListener(navigation); }
            catch (Exception ignored) { Log.w("PleosProbe", "NAVI_UNREGISTER_FAILED"); }
            try { navi.release(); } catch (Exception ignored) { Log.w("PleosProbe", "NAVI_RELEASE_FAILED"); }
        }
        super.onDestroy();
    }
}
