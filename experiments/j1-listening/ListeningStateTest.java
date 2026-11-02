import org.example.j1listening.ListeningState;
public class ListeningStateTest {
    public static void main(String[] args) {
        ListeningState s = new ListeningState(); s.active=true;
        s.restore("old",2,5000,false); assert s.index==0 && s.offset==0;
        s.restore(ListeningState.REVISION,4,5000,false); assert s.index==0;
        s.restore(ListeningState.REVISION,2,-1,false); assert s.index==0;
        s.restore(ListeningState.REVISION,1,12000,false); assert s.index==1 && s.offset==12000 && !s.intent;
        s.start(); int token=s.generation; assert s.mayPlay(token); s.pause(); assert !s.mayPlay(token);
        s.start(); s.active=false; assert !s.mayPlay(s.generation); s.active=true;
        s.stop(); assert s.index==0 && s.offset==0 && !s.intent;
        s.start(); for(int i=0;i<4;i++) s.next(); assert s.exhausted && !s.intent && s.index==3;
        s.start(); assert s.index==0 && s.offset==0 && !s.exhausted;
        System.out.println("ListeningState assertions passed (restore, invalid values, stale intent, lifecycle, stop, exhaustion)");
    }
}
