package org.example.j1listening;

import android.test.ActivityInstrumentationTestCase2;
import android.content.Intent;
import android.os.SystemClock;
import android.media.AudioManager;

/** Actual player tests; injected UX/focus and synthetic input are not SDK road evidence. */
@SuppressWarnings("deprecation")
public final class JourneyListeningTest extends ActivityInstrumentationTestCase2<ListeningActivity> {
    ListeningActivity a;
    public JourneyListeningTest() { super(ListeningActivity.class); }
    void ui(Runnable r) { getInstrumentation().runOnMainSync(r); getInstrumentation().waitForIdleSync(); }
    @Override protected void setUp() throws Exception {
        super.setUp();setActivityIntent(new Intent().putExtra("synthetic_journey",true));a=getActivity();
        ui(()->{a.end();assertTrue(a.demoMode);});
    }
    @Override protected void tearDown() throws Exception { if(a!=null)ui(()->a.end());super.tearDown(); }
    boolean playing() { boolean[] b={false};ui(()->b[0]=a.prepared&&a.player!=null&&a.player.isPlaying());return b[0]; }
    void awaitPlaying() { long end=SystemClock.elapsedRealtime()+8000;while(!playing()&&SystemClock.elapsedRealtime()<end)SystemClock.sleep(100);assertTrue(playing()); }
    void route() {
        long n=a.demoNow(),t=a.journey.begin(n-3);
        assertTrue(a.journey.point(t,0,0,n-2,n-2));assertTrue(a.journey.point(t,0,.001,n-1,n-1));
        assertTrue(a.journey.point(t,.001,.001,n,n));a.refreshDemo(n);
    }
    public void testCurrentAudioSurvivesRouteAndRevocation() {
        ui(()->a.begin());awaitPlaying();SystemClock.sleep(300);
        ui(()->{int index=a.state.index;android.media.MediaPlayer p=a.player;route();
            assertSame(p,a.player);assertEquals(index,a.state.index);a.journey.revoke("consent-revoked");
            a.journey.refresh(a.demoNow());assertSame(p,a.player);assertEquals(index,a.state.index);});
        assertTrue(playing());ui(()->a.pause("test"));assertFalse(playing());
        ui(()->{int offset=a.state.offset;route();assertEquals(offset,a.state.offset);assertFalse(a.state.intent);});
        assertFalse(playing());ui(()->a.begin());awaitPlaying();
    }
    public void testFreshnessAfterPrepareFocusWait() {
        ui(()->{route();a.begin();a.focusChanged(a.focusEpoch,AudioManager.AUDIOFOCUS_LOSS_TRANSIENT);});
        SystemClock.sleep(700);
        ui(()->{assertTrue(a.prepared);assertTrue(a.demoNeedsNext);assertEquals(2,a.state.index);
            a.demoClockOffset+=31001;a.focusChanged(a.focusEpoch,AudioManager.AUDIOFOCUS_GAIN);
            assertTrue(a.state.exhausted);assertFalse(a.state.intent);assertEquals(-1,a.journey.current);});
        assertFalse(playing());ui(()->a.begin());awaitPlaying();ui(()->assertEquals(0,a.state.index));
    }
    public void testControlsRespectUnknownUxAndOldInput() {
        ui(()->{a.restrictions(null);long g=a.journey.generation;a.demoEvent(0);assertEquals(g,a.journey.generation);
            assertEquals(android.view.View.GONE,a.demoControl.getVisibility());
            a.restricted=false;a.demoEvent(0);long old=a.journey.generation;a.demoEvent(5);
            assertFalse(a.journey.point(old,0,0,a.demoNow(),a.demoNow()));});
        SystemClock.sleep(1400);ui(()->assertTrue(a.journey.candidates.isEmpty()));assertFalse(playing());
    }
    public void testIdlePreviewDoesNotReserveListeningBudget() {
        SystemClock.sleep(1200);
        ui(()->{assertTrue(a.journey.initial);assertEquals(-1,a.journey.next);
            route();assertTrue(a.journey.initial);assertEquals(-1,a.journey.next);
            assertEquals(0,a.checkpoint().getInt("changes",-1));assertFalse(a.checkpoint().getBoolean("reserved",true));
            a.begin();});awaitPlaying();ui(()->assertEquals(2,a.state.index));
    }
    public void testNaturalRecommendedQueueExhaustion() {
        ui(()->{route();a.begin();});awaitPlaying();ui(()->assertEquals(2,a.state.index));
        // First route-picked WAV finishes naturally. Expiry may conservatively stop the queue;
        // remove context only after the first started and refill on a fresh listening boundary.
        long end=SystemClock.elapsedRealtime()+100000;boolean[] exhausted={false};
        while(SystemClock.elapsedRealtime()<end) {ui(()->exhausted[0]=a.state.exhausted);if(exhausted[0])break;SystemClock.sleep(250);}
        assertTrue(exhausted[0]);assertFalse(playing());
        ui(()->{assertTrue(Integer.bitCount(a.journey.heardMask)>=2);assertFalse(a.state.intent);});
    }
    public void testPausedReplacementBudgetIsPersisted() {
        ui(()->a.begin());awaitPlaying();SystemClock.sleep(1200);
        ui(()->{
            a.pause("test");a.restricted=false;
            for(int i=0;i<3;i++) {
                a.demoClockOffset+=61000;a.demoEvent(0);
                assertEquals(i+1,a.journey.changes);
                assertEquals(a.journey.changes,a.checkpoint().getInt("changes",-1));
                assertTrue(a.checkpoint().getBoolean("reserved",false));
            }
            a.demoEvent(5);a.demoClockOffset+=61000;a.demoEvent(0);
            assertEquals(3,a.journey.changes);assertEquals(-1,a.journey.next);assertFalse(a.state.intent);
        });assertFalse(playing());
        ui(()->a.finish());
        setActivity(null);a=getActivity();
        ui(()->{
            assertEquals(3,a.journey.changes);assertFalse(a.journey.initial);
            assertTrue(a.journey.lastChange<=a.demoNow());
            assertTrue(a.demoNow()-a.journey.lastChange<10000);
            assertFalse(a.state.intent);assertTrue(a.state.offset>0);
            a.refreshDemo(a.demoNow());assertEquals(-1,a.journey.next);
            a.end();assertEquals(0,a.journey.changes);assertEquals(0,a.journey.heardMask);
            a.begin();
        });awaitPlaying();
    }
}
