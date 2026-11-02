package org.example.j1listening;

import android.test.ActivityInstrumentationTestCase2;
import android.os.SystemClock;
import android.media.*;
import android.content.Context;

/** Real MediaPlayer instrumentation; direct callback injection is explicitly labeled. */
@SuppressWarnings("deprecation")
public class ListeningTest extends ActivityInstrumentationTestCase2<ListeningActivity> {
    ListeningActivity a;
    public ListeningTest() { super(ListeningActivity.class); }
    @Override protected void setUp() throws Exception { super.setUp(); a = getActivity(); ui(() -> a.end()); }
    void ui(Runnable r) { getInstrumentation().runOnMainSync(r); getInstrumentation().waitForIdleSync(); }
    boolean exhausted() { final boolean[] b={false}; ui(() -> b[0]=a.state.exhausted); return b[0]; }
    boolean playing() { final boolean[] b = {false}; ui(() -> b[0] = a.player != null && a.prepared && a.player.isPlaying()); return b[0]; }
    void awaitPlaying() { long end = SystemClock.elapsedRealtime()+8000; while (!playing() && SystemClock.elapsedRealtime()<end) SystemClock.sleep(100); assertTrue("actual MediaPlayer started",playing()); }
    @Override protected void tearDown() throws Exception { if(a != null) ui(() -> a.end()); super.tearDown(); }
    public void testStartPauseResumeStop() {
        ui(() -> a.play.performClick()); awaitPlaying(); SystemClock.sleep(1800);
        final int[] saved={0}; ui(() -> { a.play.performClick(); saved[0]=a.state.offset; }); int position = saved[0]; assertTrue(position > 1000); assertFalse(playing());
        ui(() -> a.play.performClick()); awaitPlaying(); ui(() -> assertTrue(a.player.getCurrentPosition() >= position - 150));
        ui(() -> { a.stop.performClick(); assertEquals(0,a.state.offset); assertFalse(a.state.intent); }); assertFalse(playing());
        SystemClock.sleep(600); assertFalse(playing());
    }
    public void testNaturalQueueExhaustion() {
        ui(() -> a.play.performClick()); awaitPlaying();
        // Real WAVs finish naturally, without synthetic completion callbacks or accelerated seeks.
        long end = SystemClock.elapsedRealtime()+100000;
        while (!exhausted() && SystemClock.elapsedRealtime()<end) SystemClock.sleep(250);
        assertTrue("all four real WAV completions",exhausted()); ui(() -> assertEquals(3,a.state.index)); assertFalse(playing());
        ui(() -> a.play.performClick()); awaitPlaying(); ui(() -> assertEquals(0,a.state.index));
    }
    public void testStopDuringPrepareAndLateFocusInjection() {
        ui(() -> { a.begin(); int token=a.focusEpoch; a.end(); a.focusChanged(token, AudioManager.AUDIOFOCUS_GAIN); });
        SystemClock.sleep(1000); assertFalse(playing()); ui(() -> assertEquals(0,a.state.offset));
        ui(() -> { int old=a.focusEpoch; a.begin(); a.focusChanged(old,AudioManager.AUDIOFOCUS_LOSS); assertTrue(a.state.intent); }); awaitPlaying();
    }
    public void testTransientAndDuckCallbackInjection() {
        ui(() -> a.begin()); awaitPlaying();
        ui(() -> { a.focusChanged(a.focusEpoch,AudioManager.AUDIOFOCUS_LOSS_TRANSIENT_CAN_DUCK); assertTrue(a.ducked); }); assertTrue(playing());
        ui(() -> { a.focusChanged(a.focusEpoch,AudioManager.AUDIOFOCUS_GAIN); assertFalse(a.ducked); });
        ui(() -> a.focusChanged(a.focusEpoch,AudioManager.AUDIOFOCUS_LOSS_TRANSIENT)); assertFalse(playing());
        ui(() -> a.focusChanged(a.focusEpoch,AudioManager.AUDIOFOCUS_GAIN)); awaitPlaying();
        ui(() -> { a.focusChanged(a.focusEpoch,AudioManager.AUDIOFOCUS_LOSS_TRANSIENT); int old=a.focusEpoch; a.pause("test"); a.focusChanged(old,AudioManager.AUDIOFOCUS_GAIN); }); assertFalse(playing());
    }
    public void testSystemFocusLoss() {
        ui(() -> a.begin()); awaitPlaying();
        AudioManager manager=(AudioManager)a.getSystemService(Context.AUDIO_SERVICE);
        AudioFocusRequest competing=new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN)
            .setAudioAttributes(new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_MEDIA).setContentType(AudioAttributes.CONTENT_TYPE_MUSIC).build())
            .setOnAudioFocusChangeListener(change -> {}).build();
        try {
            assertEquals(AudioManager.AUDIOFOCUS_REQUEST_GRANTED,manager.requestAudioFocus(competing));
            SystemClock.sleep(800); assertFalse("real focus request pauses player",playing()); ui(() -> assertFalse(a.state.intent));
        } finally { manager.abandonAudioFocusRequest(competing); }
        SystemClock.sleep(400); assertFalse(playing());
    }
    public void testBackgroundAndRestore() {
        ui(() -> a.begin()); awaitPlaying(); SystemClock.sleep(1400);
        final int[] offset={0}; ui(() -> { getInstrumentation().callActivityOnStop(a); offset[0]=a.state.offset; }); int saved=offset[0];
        assertFalse(playing()); assertTrue(saved>700);
        ui(() -> { getInstrumentation().callActivityOnStart(a); }); assertFalse(playing());
        ui(() -> a.begin()); awaitPlaying(); ui(() -> assertTrue(a.player.getCurrentPosition() >= saved-150));
    }
    public void testUnknownUxAndNoisyInjection() {
        ui(() -> { String old=a.message; a.noisy.onReceive(a,new android.content.Intent(AudioManager.ACTION_AUDIO_BECOMING_NOISY)); assertEquals(old,a.message); });
        ui(() -> { a.restrictions(null); assertEquals("오디오 이야기",a.title.getText().toString()); });
        ui(() -> a.begin()); awaitPlaying(); ui(() -> a.noisy.onReceive(a,new android.content.Intent(AudioManager.ACTION_AUDIO_BECOMING_NOISY)));
        assertFalse(playing()); ui(() -> assertFalse(a.state.intent));
    }
    public void testTransientDuringPreparationInjection() {
        ui(() -> { a.begin(); a.focusChanged(a.focusEpoch,AudioManager.AUDIOFOCUS_LOSS_TRANSIENT); });
        SystemClock.sleep(11000); assertFalse(playing());
        ui(() -> { assertTrue(a.prepared); assertTrue(a.state.intent); a.focusChanged(a.focusEpoch,AudioManager.AUDIOFOCUS_GAIN); }); awaitPlaying();
    }
}
