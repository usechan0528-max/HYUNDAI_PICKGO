package org.example.j1listening;

import java.util.*;

/** Synthetic-only fixed fixture adapter. Not a location SDK or general recommendation API. */
public final class JourneyDemo {
    public long generation;
    boolean active;
    long started, received, read, observed;
    final List<double[]> points = new ArrayList<>();
    public String reason = "not-started";
    public final List<Integer> candidates = new ArrayList<>();
    public int current = -1, next = -1, heardMask, changes;
    public boolean queuedJourney, initial = true;
    long lastChange = Long.MIN_VALUE / 2;

    public long begin(long now) {
        revoke("invalid-start");
        if (now < 0) return -1;
        active = true; started = received = read = now;
        reason = "no-observation";
        return generation;
    }
    public void revoke(String why) {
        generation++; active = false; points.clear(); candidates.clear(); reason = why;
        next = -1; queuedJourney = false;
    }
    boolean reject(String why) { revoke(why); return false; }
    public boolean point(long token, double lat, double lon, long at, long now) {
        if (!active || token != generation) return false;
        if (now < received || now < read) return reject("invalid-receive-clock");
        if (!Double.isFinite(lat) || !Double.isFinite(lon) || Math.abs(lat)>90 || Math.abs(lon)>180 || at<started || at>now)
            return reject("invalid-observation");
        if (!points.isEmpty() && at <= observed) return reject("non-increasing-observation");
        if (at - (points.isEmpty() ? started : observed)>30000)
            return reject(points.isEmpty() ? "first-observation-delay" : "observation-gap");
        if (now-at>30000) return reject("stale-on-arrival");
        if (points.isEmpty() && now-started>30000) return reject("first-observation-delay");
        if (points.size()>=256) return reject("input-limit");
        points.add(new double[]{lat,lon}); observed=at; received=now; return true;
    }
    public void context(long now) {
        candidates.clear();
        if (!active) return;
        if (now<received || now<read) { revoke("invalid-read-clock"); return; }
        read=now;
        if (points.isEmpty()) {
            if (now-started>30000) revoke("first-observation-delay");
            else reason="no-observation";
            return;
        }
        if (now-observed>30000) { reason="stale"; return; }
        for (int r=0;r<JourneyFixture.ROUTES.length;r++) {
            double[][] route=JourneyFixture.ROUTES[r];
            if (JourneyFixture.ENDED[r]>=started || distance(points.get(0),route[0])>60) continue;
            Set<Integer> positions=new HashSet<>(); positions.add(0);
            for (int i=1;i<points.size()&&!positions.isEmpty();i++) {
                Set<Integer> aligned=new HashSet<>();
                for (int pos:positions) for (int j=pos;j<=Math.min(route.length-1,pos+2);j++)
                    if (distance(points.get(i),route[j])<=60) aligned.add(j);
                positions=aligned;
            }
            if (!positions.isEmpty()) candidates.add(r);
        }
        reason=candidates.isEmpty()?"no-pattern":"synthetic-coordinate-alignment";
    }
    static double distance(double[] a,double[] b) {
        double rad=Math.PI/180, dlat=(b[0]-a[0])*rad, dlon=(b[1]-a[1])*rad;
        double h=Math.pow(Math.sin(dlat/2),2)+Math.cos(a[0]*rad)*Math.cos(b[0]*rad)*Math.pow(Math.sin(dlon/2),2);
        return 6371000*2*Math.atan2(Math.sqrt(Math.min(1,h)),Math.sqrt(Math.max(0,1-h)));
    }
    public int proposal() {
        int best=-1; double score=Double.NEGATIVE_INFINITY;
        for (int i=0;i<JourneyFixture.IDS.length;i++) {
            if (i==current || (heardMask & (1<<i))!=0) continue;
            double contextual=0;
            if (!candidates.isEmpty()) {
                contextual=Double.POSITIVE_INFINITY;
                for(int r:candidates) contextual=Math.min(contextual,JourneyFixture.PURPOSE_WEIGHTS[r][i]);
            }
            double s=JourneyFixture.TASTE[i]+contextual;
            if (s>score || (s==score && (best<0 || JourneyFixture.IDS[i].compareTo(JourneyFixture.IDS[best])<0))) { best=i; score=s; }
        }
        return best;
    }
    public void refresh(long now) {
        context(now);
        if (candidates.isEmpty() && queuedJourney) { next=-1; queuedJourney=false; }
        int proposed=proposal();
        if (proposed<0 || proposed==current || proposed==next) return;
        if (!initial && (now-lastChange<60000 || changes>=3)) return;
        if (!initial) changes++;
        initial=false; next=proposed; lastChange=now; queuedJourney=!candidates.isEmpty();
    }
    /** Revalidate before consuming; a blocked queue requires explicit new listening. */
    public int take(long now) {
        refresh(now);
        if(next<0) return -1;
        current=next; next=-1; initial=true; queuedJourney=false;
        heardMask|=1<<current; return current;
    }
    public void adopt(int index, int heard) {
        current=index; heardMask=(heard&15)|(1<<index); next=-1; initial=true;
    }
    /** Only a user-requested new listening session calls this. Input reconnect never does. */
    public void resetListening() {
        current=next=-1; heardMask=changes=0; initial=true; queuedJourney=false; lastChange=Long.MIN_VALUE/2;
    }
}
