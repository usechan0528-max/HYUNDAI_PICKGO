package org.example.j1listening;

public final class JourneyDemoTest {
    static int checks;
    static void check(boolean ok) { checks++; if(!ok) throw new AssertionError("check "+checks); }
    static long work(JourneyDemo d,long at) {
        long t=d.begin(at);check(d.point(t,0,0,at+1,at+1));check(d.point(t,0,.001,at+2,at+2));
        check(d.point(t,.001,.001,at+3,at+3));return t;
    }
    public static void main(String[] args) {
        JourneyDemo d=new JourneyDemo();
        work(d,100);d.refresh(104);check(d.candidates.size()==1);check(d.next==2);
        // The exact freshness boundary is valid, one millisecond later cannot consume it.
        d.context(30103);check(d.candidates.size()==1);
        check(d.take(30104)==-1);check(d.current==-1);check(d.next==-1);
        d.refresh(60104);check(d.next==0);check(d.take(60104)==0);
        check(d.current==0);check(d.heardMask==1);
        // Input reconnect/revoke must never restore a spent replacement budget.
        for(int i=0;i<3;i++) { d.revoke("disconnect"); d.refresh(120000+i*60000); }
        check(d.changes==3); d.revoke("permission-revoked");d.refresh(400000);check(d.next==-1);
        work(d,400001);d.refresh(400004);check(d.next==-1);check(d.changes==3);
        check(d.current==0);d.resetListening();check(d.take(400005)==2);check(d.changes==0);
        // Old tokens cannot contaminate the newly reconnected input.
        long old=d.generation;long fresh=d.begin(500000);
        check(!d.point(old,0,0,500001,500001));check(d.point(fresh,0,0,500002,500002));
        check(!d.point(fresh,0,0,500002,500003));check(d.reason.equals("non-increasing-observation"));
        fresh=d.begin(600000);check(!d.point(fresh,Double.NaN,0,600001,600001));
        check(d.reason.equals("invalid-observation"));
        fresh=d.begin(700000);check(!d.point(fresh,0,0,700001,730002));check(d.reason.equals("stale-on-arrival"));
        d=new JourneyDemo();
        for(int i=0;i<4;i++)check(d.take(100+i)>=0);
        check(d.take(200)==-1);check(d.heardMask==15);
        System.out.println("JourneyDemo boundary checks: "+checks+" passed");
    }
}
