package com.riff.player;

import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.util.Base64;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

// JS-facing half of the native media session. The web app's playerStore
// calls these methods on every track/state change (mirroring what it
// already does for navigator.mediaSession); this plugin decodes artwork off
// the main thread, starts/updates the real MediaPlaybackService, and
// forwards hardware/notification button presses back to JS as a
// "mediaButton" event so the existing play/pause/next/prev/seek actions in
// playerStore handle them exactly like any other control.
@CapacitorPlugin(name = "RiffMediaSession")
public class RiffMediaSessionPlugin extends Plugin {
    private static RiffMediaSessionPlugin instance;
    private final ExecutorService ioExecutor = Executors.newSingleThreadExecutor();
    private final Handler mainHandler = new Handler(Looper.getMainLooper());

    @Override
    public void load() {
        instance = this;
    }

    @PluginMethod
    public void updateMetadata(PluginCall call) {
        String title = call.getString("title", "");
        String artist = call.getString("artist", "");
        String album = call.getString("album", "");
        String artworkBase64 = call.getString("artworkBase64", null);
        double durationSeconds = call.getDouble("duration", 0.0);
        long durationMs = Math.round(durationSeconds * 1000);

        ensureServiceStarted();

        if (artworkBase64 != null && !artworkBase64.isEmpty()) {
            ioExecutor.execute(() -> {
                Bitmap bmp = decodeBase64(artworkBase64);
                mainHandler.post(() -> applyMetadataWhenReady(title, artist, album, bmp, durationMs, 0));
            });
        } else {
            applyMetadataWhenReady(title, artist, album, null, durationMs, 0);
        }
        call.resolve();
    }

    @PluginMethod
    public void updatePlaybackState(PluginCall call) {
        boolean playing = call.getBoolean("playing", false);
        double positionSeconds = call.getDouble("position", 0.0);
        long positionMs = Math.round(positionSeconds * 1000);
        ensureServiceStarted();
        applyPlaybackStateWhenReady(playing, positionMs, 0);
        call.resolve();
    }

    @PluginMethod
    public void stop(PluginCall call) {
        if (MediaPlaybackService.instance != null) {
            MediaPlaybackService.instance.stopPlayback();
        }
        call.resolve();
    }

    private void ensureServiceStarted() {
        if (MediaPlaybackService.instance != null) return;
        Context ctx = getContext();
        Intent intent = new Intent(ctx, MediaPlaybackService.class);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            ContextCompat.startForegroundService(ctx, intent);
        } else {
            ctx.startService(intent);
        }
    }

    // The service's onCreate() runs asynchronously relative to this call, so
    // retry briefly rather than assume `instance` is already set.
    private void applyMetadataWhenReady(String title, String artist, String album, Bitmap art, long durationMs, int attempt) {
        MediaPlaybackService svc = MediaPlaybackService.instance;
        if (svc != null) {
            svc.updateMetadata(title, artist, album, art, durationMs);
        } else if (attempt < 20) {
            mainHandler.postDelayed(() -> applyMetadataWhenReady(title, artist, album, art, durationMs, attempt + 1), 50);
        }
    }

    private void applyPlaybackStateWhenReady(boolean playing, long positionMs, int attempt) {
        MediaPlaybackService svc = MediaPlaybackService.instance;
        if (svc != null) {
            svc.updatePlaybackState(playing, positionMs);
        } else if (attempt < 20) {
            mainHandler.postDelayed(() -> applyPlaybackStateWhenReady(playing, positionMs, attempt + 1), 50);
        }
    }

    private Bitmap decodeBase64(String data) {
        try {
            String raw = data;
            int comma = data.indexOf(',');
            if (data.startsWith("data:") && comma != -1) {
                raw = data.substring(comma + 1);
            }
            byte[] bytes = Base64.decode(raw, Base64.DEFAULT);
            return BitmapFactory.decodeByteArray(bytes, 0, bytes.length);
        } catch (Exception e) {
            return null;
        }
    }

    static void notifyAction(String action) {
        if (instance == null) return;
        JSObject data = new JSObject();
        data.put("action", action);
        instance.notifyListeners("mediaButton", data);
    }

    static void notifySeek(long positionMs) {
        if (instance == null) return;
        JSObject data = new JSObject();
        data.put("action", "seek");
        data.put("position", positionMs / 1000.0);
        instance.notifyListeners("mediaButton", data);
    }
}
