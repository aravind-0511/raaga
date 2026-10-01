package com.riff.player;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.os.Build;
import android.os.IBinder;
import android.support.v4.media.MediaMetadataCompat;
import android.support.v4.media.session.MediaSessionCompat;
import android.support.v4.media.session.PlaybackStateCompat;
import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;
import androidx.core.app.ServiceCompat;
import androidx.media.app.NotificationCompat.MediaStyle;
import androidx.media.session.MediaButtonReceiver;

// A real Android media session, backed by a genuine foreground service —
// this is the piece a bare WebView can't give you. Chrome bridges the Web
// MediaSession API to a native notification automatically; a plain embedded
// WebView does not, so without this the app has no lock-screen/notification
// controls and loses the "actively playing" exemption from background
// throttling. This service is the bridge: JS calls into RiffMediaSessionPlugin,
// which drives this service, which owns the actual MediaSessionCompat,
// notification, and hardware media-button handling.
public class MediaPlaybackService extends Service {
    private static final String CHANNEL_ID = "riff_playback";
    private static final int NOTIFICATION_ID = 1001;

    public static final String ACTION_PLAY = "com.riff.player.ACTION_PLAY";
    public static final String ACTION_PAUSE = "com.riff.player.ACTION_PAUSE";
    public static final String ACTION_NEXT = "com.riff.player.ACTION_NEXT";
    public static final String ACTION_PREVIOUS = "com.riff.player.ACTION_PREVIOUS";
    public static final String ACTION_STOP = "com.riff.player.ACTION_STOP";

    static MediaPlaybackService instance;

    private MediaSessionCompat mediaSession;
    private String title = "";
    private String artist = "";
    private String album = "";
    private Bitmap artwork;
    private boolean playing = false;
    private long positionMs = 0;
    private long durationMs = 0;

    @Override
    public void onCreate() {
        super.onCreate();
        instance = this;
        createNotificationChannel();

        mediaSession = new MediaSessionCompat(this, "RiffMediaSession");
        mediaSession.setFlags(
            MediaSessionCompat.FLAG_HANDLES_MEDIA_BUTTONS | MediaSessionCompat.FLAG_HANDLES_TRANSPORT_CONTROLS
        );
        mediaSession.setCallback(new MediaSessionCompat.Callback() {
            @Override
            public void onPlay() {
                RiffMediaSessionPlugin.notifyAction("play");
            }

            @Override
            public void onPause() {
                RiffMediaSessionPlugin.notifyAction("pause");
            }

            @Override
            public void onSkipToNext() {
                RiffMediaSessionPlugin.notifyAction("next");
            }

            @Override
            public void onSkipToPrevious() {
                RiffMediaSessionPlugin.notifyAction("previous");
            }

            @Override
            public void onSeekTo(long pos) {
                RiffMediaSessionPlugin.notifySeek(pos);
            }

            @Override
            public void onStop() {
                RiffMediaSessionPlugin.notifyAction("stop");
                stopSelfSafely();
            }
        });
        mediaSession.setActive(true);
        publishState(false);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && intent.getAction() != null) {
            switch (intent.getAction()) {
                case ACTION_PLAY:
                    RiffMediaSessionPlugin.notifyAction("play");
                    break;
                case ACTION_PAUSE:
                    RiffMediaSessionPlugin.notifyAction("pause");
                    break;
                case ACTION_NEXT:
                    RiffMediaSessionPlugin.notifyAction("next");
                    break;
                case ACTION_PREVIOUS:
                    RiffMediaSessionPlugin.notifyAction("previous");
                    break;
                case ACTION_STOP:
                    RiffMediaSessionPlugin.notifyAction("stop");
                    stopSelfSafely();
                    break;
            }
        } else {
            MediaButtonReceiver.handleIntent(mediaSession, intent);
        }
        return START_STICKY;
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onDestroy() {
        if (mediaSession != null) {
            mediaSession.setActive(false);
            mediaSession.release();
        }
        instance = null;
        super.onDestroy();
    }

    // ---- called from RiffMediaSessionPlugin (same process) ----

    void updateMetadata(String title, String artist, String album, Bitmap artwork, long durationMs) {
        this.title = title == null ? "" : title;
        this.artist = artist == null ? "" : artist;
        this.album = album == null ? "" : album;
        this.artwork = artwork;
        this.durationMs = durationMs;
        publishState(true);
    }

    // Called on every playback position tick (several times a second) as well
    // as on real play/pause toggles — the session's PlaybackState always
    // updates (cheap, keeps the lock-screen scrubber accurate via the OS's
    // own position/time extrapolation), but the notification itself is only
    // rebuilt when play/pause actually changed, not on every tick.
    void updatePlaybackState(boolean playing, long positionMs) {
        boolean playingChanged = this.playing != playing;
        this.playing = playing;
        this.positionMs = positionMs;
        publishState(playingChanged);
    }

    void stopPlayback() {
        stopSelfSafely();
    }

    private void stopSelfSafely() {
        if (mediaSession != null) mediaSession.setActive(false);
        ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE);
        stopSelf();
    }

    // ---- notification + media session state ----

    private void publishState(boolean rebuildNotification) {
        if (mediaSession == null) return;

        MediaMetadataCompat.Builder metaBuilder = new MediaMetadataCompat.Builder()
            .putString(MediaMetadataCompat.METADATA_KEY_TITLE, title)
            .putString(MediaMetadataCompat.METADATA_KEY_ARTIST, artist)
            .putString(MediaMetadataCompat.METADATA_KEY_ALBUM, album)
            .putLong(MediaMetadataCompat.METADATA_KEY_DURATION, durationMs);
        if (artwork != null) {
            metaBuilder.putBitmap(MediaMetadataCompat.METADATA_KEY_ALBUM_ART, artwork);
        }
        mediaSession.setMetadata(metaBuilder.build());

        long actions = PlaybackStateCompat.ACTION_PLAY
            | PlaybackStateCompat.ACTION_PAUSE
            | PlaybackStateCompat.ACTION_PLAY_PAUSE
            | PlaybackStateCompat.ACTION_SKIP_TO_NEXT
            | PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS
            | PlaybackStateCompat.ACTION_SEEK_TO
            | PlaybackStateCompat.ACTION_STOP;
        int state = playing ? PlaybackStateCompat.STATE_PLAYING : PlaybackStateCompat.STATE_PAUSED;
        PlaybackStateCompat playbackState = new PlaybackStateCompat.Builder()
            .setActions(actions)
            .setState(state, positionMs, 1.0f)
            .build();
        mediaSession.setPlaybackState(playbackState);

        if (!rebuildNotification) return;

        Notification notification = buildNotification();
        if (playing) {
            startForegroundCompat(notification);
        } else {
            // paused: stay as a regular (dismissible) notification, not an
            // ongoing foreground one, same convention most music apps use
            ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_DETACH);
            NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null) nm.notify(NOTIFICATION_ID, notification);
        }
    }

    private void startForegroundCompat(Notification notification) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            ServiceCompat.startForeground(
                this,
                NOTIFICATION_ID,
                notification,
                android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK
            );
        } else {
            startForeground(NOTIFICATION_ID, notification);
        }
    }

    private PendingIntent actionPendingIntent(String action) {
        Intent intent = new Intent(this, MediaPlaybackService.class);
        intent.setAction(action);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;
        return PendingIntent.getService(this, action.hashCode(), intent, flags);
    }

    private Notification buildNotification() {
        Intent contentIntent = new Intent(this, MainActivity.class);
        contentIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent contentPendingIntent = PendingIntent.getActivity(
            this, 0, contentIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        int playPauseIcon = playing ? R.drawable.ic_stat_pause : R.drawable.ic_stat_play;
        String playPauseAction = playing ? ACTION_PAUSE : ACTION_PLAY;

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_riff)
            .setContentTitle(title)
            .setContentText(artist)
            .setSubText(album)
            .setLargeIcon(artwork)
            .setContentIntent(contentPendingIntent)
            .setOngoing(playing)
            .setOnlyAlertOnce(true)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .addAction(R.drawable.ic_stat_previous, "Previous", actionPendingIntent(ACTION_PREVIOUS))
            .addAction(playPauseIcon, playing ? "Pause" : "Play", actionPendingIntent(playPauseAction))
            .addAction(R.drawable.ic_stat_next, "Next", actionPendingIntent(ACTION_NEXT))
            .setDeleteIntent(actionPendingIntent(ACTION_STOP))
            .setStyle(
                new MediaStyle()
                    .setMediaSession(mediaSession.getSessionToken())
                    .setShowActionsInCompactView(0, 1, 2)
            );

        return builder.build();
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID, "Playback", NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("Music playback controls");
            channel.setShowBadge(false);
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm != null) nm.createNotificationChannel(channel);
        }
    }
}
