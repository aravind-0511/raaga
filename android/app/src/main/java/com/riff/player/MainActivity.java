package com.riff.player;

import android.os.Bundle;
import android.view.View;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(RiffMediaSessionPlugin.class);
        super.onCreate(savedInstanceState);

        // Android draws content edge-to-edge behind the status bar, and this
        // WebView doesn't bridge that to CSS env(safe-area-inset-top) the way
        // a mobile browser does — header content renders flush against (or
        // under) the status bar. Best-effort fix: pad the WebView by the
        // platform's real status bar height plus a bit of breathing room.
        // NOTE: tried this plus a WindowInsets-listener variant plus
        // WindowCompat.setDecorFitsSystemWindows(true) — none visibly changed
        // the rendered layout on-device, and added logging confirmed this
        // onCreate code path isn't even being hit, which points at something
        // more fundamental (likely a Gradle "UP-TO-DATE" stale-compile issue
        // not picking up MainActivity.java changes) rather than the inset
        // logic itself being wrong. Needs a clean (non-incremental) rebuild
        // to properly diagnose — left as-is for now.
        View webView = getBridge().getWebView();
        int statusBarHeight = 0;
        int resId = getResources().getIdentifier("status_bar_height", "dimen", "android");
        if (resId > 0) statusBarHeight = getResources().getDimensionPixelSize(resId);
        int extra = Math.round(16 * getResources().getDisplayMetrics().density);
        webView.setPadding(webView.getPaddingLeft(), statusBarHeight + extra, webView.getPaddingRight(), webView.getPaddingBottom());
    }
}
