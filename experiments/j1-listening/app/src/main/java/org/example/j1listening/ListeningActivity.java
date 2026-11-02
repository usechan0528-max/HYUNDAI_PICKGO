package org.example.j1listening;

import android.app.Activity;
import android.os.*;
import android.content.*;
import android.content.pm.PackageManager;
import android.content.res.AssetFileDescriptor;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.media.*;
import android.view.*;
import android.widget.*;
import android.car.Car;
import android.car.drivingstate.*;

/** Foreground-only local listening milestone. No boot receiver, network or location access. */
public final class ListeningActivity extends Activity {
    final ListeningState state = new ListeningState();
    final Handler handler = new Handler(Looper.getMainLooper());
    final int[] tracks = {R.raw.story, R.raw.story2, R.raw.pause, R.raw.pause2};
    final String[] titles = {"주머니 속 작은 지도", "불이 켜진 창문", "오늘의 작은 여백", "끝내지 않아도 되는 문장"};
    MediaPlayer player;
    AudioManager audio;
    AudioFocusRequest focus;
    int focusEpoch, uxEpoch;
    boolean prepared, focused, ducked, restricted = true;
    Car car;
    CarUxRestrictionsManager ux;
    TextView title, status, context;
    Button play, stop;
    Button demoControl;
    boolean demoMode, demoNeedsNext = true;
    final JourneyDemo journey = new JourneyDemo();
    long demoClockOffset;
    android.widget.PopupMenu demoMenu;
    Typeface font;
    String message = "시작하려면 ‘바로 듣기’를 누르세요";
    final BroadcastReceiver noisy = new BroadcastReceiver() {
        @Override public void onReceive(Context c, Intent i) { if (state.intent) pause("오디오 출력이 바뀌어 일시정지했습니다"); }
    };
    final Runnable tick = new Runnable() {
        public void run() {
            if (!state.active) return;
            if (prepared && player != null) { state.offset = player.getCurrentPosition(); save(false); }
            if (demoMode) refreshDemo(demoNow());
            render(); handler.postDelayed(this, 1000);
        }
    };
    @Override public void onCreate(Bundle b) {
        super.onCreate(b);
        audio = (AudioManager)getSystemService(AUDIO_SERVICE);
        demoMode = (getApplicationInfo().flags & android.content.pm.ApplicationInfo.FLAG_DEBUGGABLE) != 0
            && getIntent().getBooleanExtra("synthetic_journey", false);
        SharedPreferences p = checkpoint();
        try { state.restore(p.getString("revision", ""), p.getInt("index", 0), p.getInt("offset", 0), p.getBoolean("exhausted", false)); }
        catch (ClassCastException e) { p.edit().clear().apply(); }
        if (demoMode && ListeningState.REVISION.equals(p.getString("revision", ""))) {
            try {
                demoNeedsNext = p.getBoolean("needsNext", true);
                journey.changes = Math.max(0, Math.min(3, p.getInt("changes", 0)));
                journey.heardMask = p.getInt("heard", 0) & 15;
                if (!demoNeedsNext) journey.adopt(state.index, journey.heardMask);
                // Losing an unconsumed queue on process death must not reset its budget.
                if (p.getBoolean("reserved", false)) { journey.initial=false; journey.lastChange=demoNow(); }
            } catch (ClassCastException e) { journey.resetListening(); demoNeedsNext=true; state.stop(); }
        }
        try { font = Typeface.createFromAsset(getAssets(), "fonts/AstaSans.ttf"); } catch (RuntimeException e) { font = Typeface.DEFAULT; }
        buildUi();
        if (state.offset > 0) message = "저장된 위치에서 이어들을 수 있습니다";
        if (state.exhausted) message = "모두 들었습니다 · 다시 시작할 수 있습니다";
        if (demoMode && state.exhausted && journey.proposal()>=0)
            message="다음 추천 변경 제한으로 멈췄습니다 · ‘새 듣기’를 눌러 주세요";
        render();
    }
    @Override public void onStart() {
        super.onStart(); state.active = true;
        if (Build.VERSION.SDK_INT >= 33) registerReceiver(noisy, new IntentFilter(AudioManager.ACTION_AUDIO_BECOMING_NOISY), Context.RECEIVER_NOT_EXPORTED);
        else registerReceiver(noisy, new IntentFilter(AudioManager.ACTION_AUDIO_BECOMING_NOISY));
        connectUx(); handler.post(tick);
    }
    @Override public void onStop() {
        if (demoMode) journey.revoke("screen-left");
        if (demoMenu != null) demoMenu.dismiss();
        pause("화면을 벗어나 일시정지했습니다"); state.active = false;
        handler.removeCallbacksAndMessages(null); save(true);
        unregisterReceiver(noisy); disconnectUx(); super.onStop();
    }
    void connectUx() {
        final int epoch = ++uxEpoch;
        restricted = true;
        if (!getPackageManager().hasSystemFeature(PackageManager.FEATURE_AUTOMOTIVE)) return;
        try {
            car = Car.createCar(this, handler, Car.CAR_WAIT_TIMEOUT_DO_NOT_WAIT, (connected, ready) -> {
                if (!state.active || epoch != uxEpoch) return;
                if (!ready) { restricted = true; ux = null; render(); return; }
                try {
                    ux = (CarUxRestrictionsManager)connected.getCarManager(Car.CAR_UX_RESTRICTION_SERVICE);
                    ux.registerListener(value -> { if (state.active && epoch == uxEpoch) restrictions(value); });
                    restrictions(ux.getCurrentCarUxRestrictions());
                } catch (RuntimeException e) { restricted = true; render(); }
            });
        } catch (RuntimeException | LinkageError e) { restricted = true; }
    }
    void restrictions(CarUxRestrictions value) {
        restricted = value == null || value.isRequiresDistractionOptimization() || value.getActiveRestrictions() != 0;
        android.util.Log.i("J1Listening", "ux restricted=" + restricted);
        render();
    }
    void disconnectUx() {
        uxEpoch++;
        if (ux != null) { try { ux.unregisterListener(); } catch (RuntimeException ignored) { } ux = null; }
        if (car != null) { car.disconnect(); car = null; }
        restricted = true;
    }
    void begin() {
        if (!state.active || state.intent) return;
        if (demoMode && state.exhausted) { journey.resetListening(); demoNeedsNext=true; }
        state.start(); state.generation++;
        final int token = ++focusEpoch;
        AudioAttributes attributes = new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_MEDIA).setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build();
        focus = new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN).setAudioAttributes(attributes)
            .setWillPauseWhenDucked(false).setAcceptsDelayedFocusGain(false)
            .setOnAudioFocusChangeListener(change -> focusChanged(token, change), handler).build();
        if (audio.requestAudioFocus(focus) != AudioManager.AUDIOFOCUS_REQUEST_GRANTED) {
            pause("다른 오디오 사용 중입니다 · 잠시 후 다시 눌러 주세요"); return;
        }
        focused = true;
        if (demoMode && demoNeedsNext) prepareDemoNext(); else load();
    }
    void focusChanged(int token, int change) {
        // Focus belongs to the listening session, independently of each track's player generation.
        if (token != focusEpoch || !state.active || !state.intent) return;
        if (change == AudioManager.AUDIOFOCUS_LOSS) { pause("다른 오디오로 전환되어 일시정지했습니다"); return; }
        if (change == AudioManager.AUDIOFOCUS_LOSS_TRANSIENT) {
            focused = false;
            if (prepared && player != null && player.isPlaying()) { player.pause(); state.offset = player.getCurrentPosition(); save(false); }
            message = "다른 오디오가 끝나기를 기다립니다";
        } else if (change == AudioManager.AUDIOFOCUS_LOSS_TRANSIENT_CAN_DUCK) {
            ducked = true; if (prepared && player != null) player.setVolume(.2f, .2f);
        } else if (change == AudioManager.AUDIOFOCUS_GAIN) {
            focused = true; ducked = false;
            if (prepared && player != null) { player.setVolume(1, 1); startReady(state.generation); }
        }
        render();
    }
    void load() {
        final int token = state.generation;
        releasePlayer(); message = "이야기를 준비하고 있습니다"; render();
        MediaPlayer p = new MediaPlayer(); player = p;
        handler.postDelayed(() -> {
            if (player == p && token == state.generation && !prepared) pause("음원 준비가 지연되었습니다 · 다시 눌러 주세요");
        }, 10000);
        p.setAudioAttributes(new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_MEDIA).setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build());
        p.setOnErrorListener((mp, what, extra) -> { if (player == mp && token == state.generation) pause("재생하지 못했습니다 · 다시 눌러 주세요"); return true; });
        p.setOnPreparedListener(mp -> {
            if (player != mp || !state.mayPlay(token)) return;
            if (state.offset >= mp.getDuration()) { queueAdvance(mp, token); return; }
            if (state.offset > 0) {
                mp.setOnSeekCompleteListener(seeked -> { if (player == seeked && state.mayPlay(token)) { prepared = true; startReady(token); } });
                mp.seekTo(state.offset, MediaPlayer.SEEK_CLOSEST);
            } else { prepared = true; startReady(token); }
        });
        p.setOnCompletionListener(mp -> queueAdvance(mp, token));
        try (AssetFileDescriptor fd = getResources().openRawResourceFd(tracks[state.index])) {
            p.setDataSource(fd.getFileDescriptor(), fd.getStartOffset(), fd.getLength()); p.prepareAsync();
        } catch (Exception e) { pause("음원을 열지 못했습니다 · 다시 눌러 주세요"); }
    }
    void startReady(int token) {
        if (!state.mayPlay(token) || !focused || !prepared || player == null) return;
        if (demoMode && demoNeedsNext) {
            // The load/seek/focus wait may have outlived the route's freshness window.
            long selectionTime=demoNow(); refreshDemo(selectionTime);
            if (journey.next < 0) { demoBlocked(); return; }
            if (journey.next != state.index) { state.generation++; prepareDemoNext(); return; }
            if (journey.take(selectionTime)<0) { demoBlocked(); return; }
            demoNeedsNext=false; save(true);
        }
        player.setVolume(ducked ? .2f : 1, ducked ? .2f : 1); player.start();
        message = "이야기가 끝나면 다음 편이 이어집니다";
        android.util.Log.i("J1Listening", "playing index=" + state.index + " offset=" + player.getCurrentPosition()); render();
    }
    void queueAdvance(MediaPlayer completed, int token) {
        handler.post(() -> { if (player == completed && state.mayPlay(token)) advance(); });
    }
    void advance() {
        if (demoMode) {
            releasePlayer(); state.generation++; state.offset=0; demoNeedsNext=true;
            prepareDemoNext(); return;
        }
        releasePlayer(); state.next(); save(false);
        if (state.exhausted) { abandon(); message = "모두 들었습니다 · 다시 시작할 수 있습니다"; render(); }
        else load();
    }
    void pause(String reason) {
        if (prepared && player != null) state.offset = player.getCurrentPosition();
        state.pause(); releasePlayer(); abandon(); save(false); message = reason; render();
    }
    void end() {
        if (demoMode) { journey.revoke("listening-ended"); journey.resetListening(); demoNeedsNext=true; }
        state.stop(); releasePlayer(); abandon(); save(true);
        message = "듣기를 종료했습니다 · 저장 위치를 지웠습니다"; render();
    }
    void releasePlayer() { prepared = false; if (player != null) { player.release(); player = null; } }
    void abandon() { focusEpoch++; focused = false; ducked = false; if (focus != null) { audio.abandonAudioFocusRequest(focus); focus = null; } }
    void save(boolean sync) {
        SharedPreferences.Editor e = checkpoint().edit().putString("revision", ListeningState.REVISION)
            .putInt("index", state.index).putInt("offset", state.offset).putBoolean("exhausted", state.exhausted);
        if (demoMode) e.putBoolean("needsNext",demoNeedsNext).putInt("heard",journey.heardMask)
            .putInt("changes",journey.changes).putBoolean("reserved",!journey.initial);
        if (sync) e.commit(); else e.apply();
    }
    void render() {
        if (play == null) return;
        label(title,restricted ? "오디오 이야기" : titles[state.index]);
        if (!demoMode) label(context,restricted ? "간단한 듣기 모드" : "경로 정보 없음 · 기본 순서");
        if (demoMode) {
            label(context,restricted ? "모의 운행 · 실제 SDK 미연결" : "모의 운행 · 실제 SDK 미연결 · "
                + (journey.candidates.isEmpty() ? "취향 대안" : "경로 후보 "+journey.candidates.size()+"개 · 목적지 미확정")
                + " · 다음: "+(journey.next<0?"대기":titles[journey.next]));
            demoControl.setVisibility(restricted ? View.GONE : View.VISIBLE);
            if (restricted && demoMenu != null) demoMenu.dismiss();
        }
        label(play,state.intent ? "일시정지" : state.exhausted ? (demoMode ? "새 듣기" : "다시 듣기") : state.offset > 0 ? "이어듣기" : "바로 듣기");
        stop.setEnabled(state.intent || state.offset > 0 || state.index > 0 || state.exhausted
            || (demoMode && (!journey.initial || journey.changes>0)));
        label(status,message + "  ·  " + (state.index + 1) + "/4  ·  " + state.offset / 1000 + "초");
    }
    void label(TextView view,String value) { if(!android.text.TextUtils.equals(view.getText(),value)) view.setText(value); }
    int dp(int n) { return (int)(getResources().getDisplayMetrics().density * n + .5f); }
    TextView text(String s, int size, int color) {
        TextView t = new TextView(this); t.setText(s); t.setTextSize(size); t.setTextColor(color); t.setTypeface(font); t.setPadding(0, dp(6), 0, dp(6)); return t;
    }
    GradientDrawable background(int color) { GradientDrawable g = new GradientDrawable(); g.setColor(color); g.setCornerRadius(dp(12)); return g; }
    void buildUi() {
        int white = Color.rgb(250,250,250), grey = Color.rgb(188,190,196);
        LinearLayout root = new LinearLayout(this); root.setOrientation(LinearLayout.VERTICAL); root.setPadding(dp(28),dp(14),dp(28),dp(14)); root.setBackgroundColor(Color.rgb(18,19,21));
        root.addView(text("이번 길     오디오", 26, white));
        context = text("",18,grey); root.addView(context);
        if (demoMode) {
            demoControl=new Button(this); demoControl.setText("모의 운행 입력 · 개발 전용");
            demoControl.setTypeface(font); demoControl.setTextSize(18); demoControl.setMinHeight(dp(48));
            demoControl.setOnClickListener(v -> showDemoMenu()); root.addView(demoControl);
        }
        root.addView(text("지금, 이야기 한 편 들어보세요",30,white));
        LinearLayout card = new LinearLayout(this); card.setOrientation(LinearLayout.VERTICAL); card.setPadding(dp(24),dp(14),dp(24),dp(14)); card.setBackground(background(Color.rgb(29,30,32)));
        card.setGravity(Gravity.CENTER_VERTICAL);
        card.addView(text("▂  ▅  █  ▅  ▂",40,grey));
        title = text("",32,white); card.addView(title); card.addView(text("AI 생성 음성 · Supertonic 3",18,grey));
        root.addView(card, new LinearLayout.LayoutParams(-1,0,1));
        LinearLayout controls = new LinearLayout(this); controls.setPadding(0,dp(16),0,dp(8));
        play = new Button(this); play.setTypeface(font); play.setTextSize(24); play.setTextColor(Color.rgb(22,23,25)); play.setBackground(background(Color.rgb(240,240,242)));
        stop = new Button(this); stop.setTypeface(font); stop.setTextSize(23); stop.setText("듣기 종료"); stop.setTextColor(white); stop.setBackground(background(Color.rgb(68,70,79)));
        LinearLayout.LayoutParams left = new LinearLayout.LayoutParams(0,dp(88),1.4f); left.setMarginEnd(dp(20)); controls.addView(play,left); controls.addView(stop,new LinearLayout.LayoutParams(0,dp(88),1)); root.addView(controls);
        play.setOnClickListener(v -> { if (state.intent) pause("일시정지했습니다"); else begin(); }); stop.setOnClickListener(v -> end());
        status = text("",16,grey); root.addView(status);
        root.addView(text("로컬 음원 시연 · 음성 인식 미연결 · 실차 미검증",14,grey)); setContentView(root);
    }

    SharedPreferences checkpoint() { return demoMode ? getSharedPreferences("synthetic-listening",MODE_PRIVATE) : getPreferences(MODE_PRIVATE); }
    long demoNow() { return 100 + SystemClock.elapsedRealtime() + demoClockOffset; }
    void refreshDemo(long now) {
        // Preview input before the first user start must not reserve/persist a listening queue.
        if (journey.current<0 && !state.intent && journey.initial) { journey.context(now); return; }
        int beforeNext=journey.next, beforeChanges=journey.changes;
        boolean beforeInitial=journey.initial;
        journey.refresh(now);
        // Persist queue budget even while paused or before the first media start.
        if(beforeNext!=journey.next || beforeChanges!=journey.changes || beforeInitial!=journey.initial) save(true);
    }
    void prepareDemoNext() {
        if (!state.intent || !state.active) return;
        refreshDemo(demoNow());
        if (journey.next<0) { demoBlocked(); return; }
        state.index=journey.next; state.offset=0; save(false); load();
    }
    void demoBlocked() {
        state.pause(); state.exhausted=true; releasePlayer(); abandon(); save(true);
        message=journey.proposal()<0 ? "모두 들었습니다 · ‘새 듣기’로 시작할 수 있습니다"
            : "다음 추천 변경 제한으로 멈췄습니다 · ‘새 듣기’를 눌러 주세요";
        render();
    }
    void showDemoMenu() {
        if (!demoMode || restricted || !state.active) return;
        demoMenu=new PopupMenu(this,demoControl);
        String[] labels={"새 모의 입력 · 동의/권한 허용 · 공통 구간","출근 분기","심부름 분기","경로 이탈","31초 경과 · 만료","연결 단절","명시 도착","동의 철회","권한 철회","경로 변경"};
        for(int i=0;i<labels.length;i++) demoMenu.getMenu().add(0,i,i,labels[i]);
        demoMenu.setOnMenuItemClickListener(item -> { demoEvent(item.getItemId()); return true; }); demoMenu.show();
    }
    void demoEvent(int event) {
        if (!demoMode || restricted || !state.active) return;
        long now=demoNow();
        if (event==0) {
            long token=journey.begin(now);
            // Observation and receive share the monotonic synthetic clock. Delayed callbacks retain their token.
            handler.postDelayed(() -> demoPoint(token,0,0),100);
            handler.postDelayed(() -> demoPoint(token,0,.001),1100);
        } else if(event==1 || event==2) demoPoint(journey.generation,event==1?.001:-.001,.001);
        else if(event==3) demoPoint(journey.generation,.02,.02);
        else if(event==4) demoClockOffset+=31001;
        else {
            String[] reasons={"disconnect","arrival","consent-revoked","permission-revoked","route-change"};
            if(event>=5 && event<=9) journey.revoke(reasons[event-5]);
        }
        refreshDemo(demoNow()); render();
    }
    void demoPoint(long token,double lat,double lon) {
        if(!demoMode || !state.active) return;
        long now=demoNow(); journey.point(token,lat,lon,now,now); refreshDemo(now); render();
    }
}
