package org.example.j1input;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.*;
import android.os.SystemClock;
import android.util.Log;
/** Debug-only status transport. No coordinates or source timestamps can enter its API. */
final class SdkStatusPublisher implements AutoCloseable {
 private final long generation=SystemClock.elapsedRealtime();
 private long sequence;private boolean closed;
 private final ThreadPoolExecutor worker=new ThreadPoolExecutor(1,1,0L,TimeUnit.MILLISECONDS,new ArrayBlockingQueue<>(8),new ThreadPoolExecutor.DiscardPolicy());
 synchronized void send(String state,int sampleCount){
  if(closed)return;
  String normalized=switch(state){case "WAITING","CALLBACK","REVOKED","ACCESS_DENIED","STOPPED"->state;default->"ERROR";};
  String json="{\"source\":\"pleos-sdk-1.1.3\",\"generation\":"+generation+",\"sequence\":"+(sequence++)+",\"state\":\""+normalized+"\",\"sampleCount\":"+sampleCount+",\"clockStatus\":\"UNVERIFIED_CLOCK\"}";
  worker.execute(()->{HttpURLConnection connection=null;
   try{connection=(HttpURLConnection)new URL("http://127.0.0.1:4177/sdk-status").openConnection();
    connection.setConnectTimeout(1000);connection.setReadTimeout(1000);connection.setRequestMethod("POST");connection.setRequestProperty("Content-Type","application/json");connection.setDoOutput(true);
    byte[] bytes=json.getBytes(StandardCharsets.UTF_8);connection.setFixedLengthStreamingMode(bytes.length);
    try(var output=connection.getOutputStream()){output.write(bytes);}
    Log.i("J1Bridge","STATUS_HTTP="+connection.getResponseCode());
   }catch(Exception e){Log.i("J1Bridge","TRANSPORT_ERROR="+e.getClass().getSimpleName());}
   finally{if(connection!=null)connection.disconnect();}
  });
 }
 public synchronized void close(){closed=true;worker.shutdown();}
}
