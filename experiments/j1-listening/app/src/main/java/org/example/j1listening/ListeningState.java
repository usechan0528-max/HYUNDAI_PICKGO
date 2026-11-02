package org.example.j1listening;

/** Pure session policy; all calls are serialized on the Android main thread. */
public final class ListeningState {
    public static final String REVISION = "ko-f3-20261102-v1";
    public int index, offset, generation;
    public boolean intent, active, exhausted;
    public void restore(String revision, int track, int millis, boolean end) {
        if (!REVISION.equals(revision) || track < 0 || track >= 4 || millis < 0 || millis > 60000) return;
        index = track; offset = millis; exhausted = end;
    }
    public void start() { if (exhausted) { index = 0; offset = 0; exhausted = false; } intent = true; }
    public void pause() { intent = false; generation++; }
    public void stop() { pause(); index = 0; offset = 0; exhausted = false; }
    public void next() { generation++; offset = 0; if (index < 3) index++; else { exhausted = true; intent = false; } }
    public boolean mayPlay(int token) { return token == generation && active && intent && !exhausted; }
}
