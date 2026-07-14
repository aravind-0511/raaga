# Riff 🎸

A Spotify-style music player that runs entirely in your browser — dark, glassy, violet-accented, and built around **your own music** plus an online catalog with deep **Tamil / Indian** coverage.

```bash
npm install
npm run dev   # http://localhost:5174
```

## What it does

**Library & playback**
- Drag-and-drop upload of **any audio or video file** (mp3, wav, ogg, flac, m4a, mp4, webm, mkv…). Video files play as **audio only** — the playback core is a pair of hidden `<video>` elements, so any container the browser can decode just works.
- ID3/tag + embedded cover-art extraction (`music-metadata`), with filename fallback (`Artist - Title.ext`).
- Full queue management, shuffle, repeat one/all, unlimited skips, ad-free (obviously).
- **Crossfade** (0–12 s slider) and **gapless playback** via dual playback slots with preloading.
- **Real waveform seek bar** — peaks precomputed with `decodeAudioData`, cached in IndexedDB.
- Live **frequency visualizer** (AnalyserNode) — real signal for local files *and* CORS-friendly catalog streams; simulated fallback otherwise.
- MediaSession integration (OS media keys / lock-screen metadata).

**Catalog (online)**
- Search + browse songs, albums, and artists via an **unofficial JioSaavn API** (Tamil, Hindi, Telugu, Malayalam, English…). No API key. Multiple public instances with automatic failover; the base URL is configurable in Settings (self-host [jiosaavn-api](https://github.com/sumitkolhe/jiosaavn-api) for reliability).
- **Audio quality** setting (Normal 96 / High 160 / Very High 320 kbps) selects the actual stream bitrate.
- **Offline downloads** — caches the stream as a blob in IndexedDB; downloaded tracks play with no network.
- Built-in demo catalog: five original synth loops rendered locally with `OfflineAudioContext` on first run, so the app is fully usable with zero network and zero uploads.

**Spotify-Premium-style extras**
- **Connect-style handoff** — every open tab is a "device"; transfer playback (track, queue, position) from the player bar.
- **Group sessions** — host a synced listening session across tabs with live chat (BroadcastChannel; a stand-in for a realtime backend).
- **Collaborative playlists** — live co-editing across tabs with presence badges.

**Original features**
- **Mood-prompt playlists** — describe a vibe ("rainy afternoon coding session") and get a playlist assembled from your library + the catalog.
- **Time Capsule** — resurfaces what you played around this date in previous months.
- **Focus Mode** — distraction-free player + Pomodoro timer.
- **Listening Insights** — continuously updated top artists/genres/tracks, hours listened, 14-day chart.

## Architecture

- React 19 + Vite + Tailwind v4, Zustand stores, `idb` for IndexedDB.
- All persistence is local (tracks, blobs, playlists, likes, play history, waveforms, settings) behind a single repository module — [src/lib/repo.js](src/lib/repo.js) — designed as the one seam to swap in Supabase (Postgres + Storage) later for real accounts and sync.
- Playback engine: [src/lib/player/engine.js](src/lib/player/engine.js) — framework-free singleton, two crossfading slots, Web Audio graph per slot, automatic plain-element fallback for CORS-blocked streams.

## Honest limitations

- The JioSaavn API is **unofficial and best-effort**: public instances rate-limit and can disappear. The app degrades gracefully (library + demo catalog keep working offline) and the instance URL is a setting.
- Group sessions / handoff / collab playlists sync across **tabs of the same browser** (BroadcastChannel), simulating what a backend would do across real devices.
- Exotic video containers (mkv/avi) depend on the codecs your browser ships.
