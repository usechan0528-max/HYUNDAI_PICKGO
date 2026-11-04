package org.example.pickuppreview;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.os.Bundle;
import android.os.Message;
import android.webkit.WebChromeClient;
import android.widget.Toast;
import android.net.Uri;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import java.io.ByteArrayInputStream;

/** Local emulator visual preview only; not a driving-enabled production app. */
public final class PreviewActivity extends Activity {
 private WebView web;
 private static boolean local(Uri uri) {
  return "http".equals(uri.getScheme()) && "127.0.0.1".equals(uri.getHost()) && uri.getPort()==4180;
 }
 @SuppressLint("SetJavaScriptEnabled")
 @Override public void onCreate(Bundle saved) {
  super.onCreate(saved);
  web=new WebView(this);
  web.setBackgroundColor(0xff121212);
  web.getSettings().setJavaScriptEnabled(true);
  web.getSettings().setDomStorageEnabled(true);
  web.getSettings().setAllowFileAccess(false);
  web.getSettings().setAllowContentAccess(false);
  web.getSettings().setUseWideViewPort(true);
  web.getSettings().setLoadWithOverviewMode(true);
  web.getSettings().setSupportMultipleWindows(true);
  web.setWebChromeClient(new WebChromeClient(){
   @Override public boolean onCreateWindow(WebView view,boolean dialog,boolean userGesture,Message result){
    Toast.makeText(PreviewActivity.this,"두 역할 시험은 PC 브라우저에서 진행하세요.",Toast.LENGTH_LONG).show();
    return false;
   }
  });
  web.setWebViewClient(new WebViewClient(){
   @Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest request){ return !local(request.getUrl()); }
   @Override public WebResourceResponse shouldInterceptRequest(WebView view,WebResourceRequest request){
    return local(request.getUrl()) ? null : new WebResourceResponse("text/plain","UTF-8",403,"Blocked",null,new ByteArrayInputStream(new byte[0]));
   }
  });
  setContentView(web);
  web.loadUrl("http://127.0.0.1:4180/");
 }
 @Override protected void onPause(){web.onPause();super.onPause();}
 @Override protected void onResume(){super.onResume();if(web!=null)web.onResume();}
 @Override protected void onDestroy(){web.destroy();super.onDestroy();}
}
