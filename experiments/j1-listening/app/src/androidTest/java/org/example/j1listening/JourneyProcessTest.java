package org.example.j1listening;

import android.test.ActivityInstrumentationTestCase2;
import android.content.Intent;
import android.os.SystemClock;
import android.os.Bundle;

/** Run the two methods in separate instrumentation invocations with am force-stop between them. */
@SuppressWarnings("deprecation")
public final class JourneyProcessTest extends ActivityInstrumentationTestCase2<ListeningActivity> {
    ListeningActivity a;
    public JourneyProcessTest(){super(ListeningActivity.class);}
    void ui(Runnable r){getInstrumentation().runOnMainSync(r);getInstrumentation().waitForIdleSync();}
    @Override protected void setUp() throws Exception {
        super.setUp();setActivityIntent(new Intent().putExtra("synthetic_journey",true));a=getActivity();
    }
    void waitPlaying(){
        boolean[] playing={false};long end=SystemClock.elapsedRealtime()+8000;
        while(SystemClock.elapsedRealtime()<end){ui(()->playing[0]=a.prepared&&a.player!=null&&a.player.isPlaying());if(playing[0])return;SystemClock.sleep(100);}
        fail("real MediaPlayer did not start");
    }
    void report(String phase,int value){Bundle b=new Bundle();b.putString("J1_PROCESS",phase+" offset="+value);getInstrumentation().sendStatus(0,b);}
    public void testPrepareCheckpoint(){
        ui(()->{a.end();a.begin();});waitPlaying();SystemClock.sleep(1800);
        ui(()->{a.pause("process test");assertTrue(a.state.offset>1000);assertEquals(1,a.journey.heardMask);a.save(true);report("prepared",a.state.offset);});
        // Parent teardown finishes Activity but deliberately preserves this checkpoint.
    }
    public void testRestoreCheckpoint(){
        final int[] before={0};
        ui(()->{before[0]=a.state.offset;assertTrue(before[0]>1000);assertFalse(a.state.intent);assertNull(a.player);
            assertTrue(a.journey.candidates.isEmpty());assertEquals(1,a.journey.heardMask);a.begin();});
        waitPlaying();SystemClock.sleep(1200);
        ui(()->{a.pause("process test");assertTrue(a.state.offset>before[0]);report("restored",a.state.offset);
            a.end();assertEquals(0,a.checkpoint().getInt("offset",-1));assertEquals(0,a.checkpoint().getInt("heard",-1));});
    }
}
