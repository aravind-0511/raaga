import { create } from 'zustand'
import { engine } from '../lib/player/engine'
import { blobUrl, getWaveform, putWaveform, getBlobRecord } from '../lib/repo'
import { computePeaks } from '../lib/player/waveform'
import { pickStreamUrl } from '../lib/catalog/saavn'
import { shuffleArray } from '../lib/utils'
import { useSettings } from './settingsStore'
import { useLibrary } from './libraryStore'

async function resolveUrl(track) {
  if (track.blobId) {
    const url = await blobUrl(track.blobId)
    if (url) return url
  }
  return pickStreamUrl(track, useSettings.getState().quality)
}

let listenStart = null // { track, startedAt }

function flushListenLog() {
  if (listenStart) {
    useLibrary.getState().logPlay(listenStart.track, Date.now() - listenStart.startedAt)
    listenStart = null
  }
}

function applyMediaSession(track) {
  if (!('mediaSession' in navigator) || !track) return
  navigator.mediaSession.metadata = new MediaMetadata({
    title: track.title,
    artist: track.artist,
    album: track.album || 'Riff',
    artwork: track.artUrl ? [{ src: track.artUrl }] : [],
  })
}

// ---- session persistence (resume where you left off across reloads) ----
const SESSION_KEY = 'raaga:session'

// drop the local blob: art URL — it's a session-scoped object URL that's dead
// after reload; it re-resolves from the track's artBlobId via the library.
function stripArt(t) {
  if (t && t.source === 'local' && typeof t.artUrl === 'string' && t.artUrl.startsWith('blob:')) {
    const { artUrl, ...rest } = t
    return rest
  }
  return t
}

function saveSession() {
  const { current, queue, originalQueue, index, position, shuffle, repeat } = usePlayer.getState()
  if (!current || !queue.length) return clearSession()
  try {
    localStorage.setItem(
      SESSION_KEY,
      JSON.stringify({
        queue: queue.map(stripArt),
        originalQueue: originalQueue.map(stripArt),
        index,
        position,
        shuffle,
        repeat,
      })
    )
  } catch {
    /* storage full / unavailable — non-fatal */
  }
}

function clearSession() {
  try {
    localStorage.removeItem(SESSION_KEY)
  } catch {
    /* ignore */
  }
}

let lastSessionSave = 0
function persistSession(force) {
  const now = Date.now()
  if (!force && now - lastSessionSave < 3000) return
  lastSessionSave = now
  saveSession()
}

export const usePlayer = create((set, get) => ({
  current: null,
  queue: [],
  originalQueue: [],
  index: -1,
  playing: false,
  position: 0,
  duration: 0,
  shuffle: false,
  repeat: 'off', // off | all | one
  peaks: null, // waveform of current track
  advancing: false,
  loadError: null,
  queueOpen: false,
  nowPlayingOpen: false,
  sleepTimerEndsAt: null,
  _sleepTimerId: null,

  // Play `track` in the context of `context` (playlist/album/search results).
  playTrack: async (track, context) => {
    const list = context?.length ? context : [track]
    const original = [...list]
    let queue = original
    if (get().shuffle) {
      queue = [track, ...shuffleArray(original.filter((t) => t.id !== track.id))]
    }
    set({ originalQueue: original, queue, index: queue.findIndex((t) => t.id === track.id) })
    await get()._start(track, { fade: false })
  },

  playAt: async (i) => {
    const track = get().queue[i]
    if (!track) return
    set({ index: i })
    await get()._start(track, { fade: false })
  },

  // Shuffle-play an arbitrary list (a whole library or playlist "shuffle"
  // button) — turns shuffle on and starts from a random track in it.
  shufflePlayList: async (list) => {
    if (!list.length) return
    if (!get().shuffle) set({ shuffle: true })
    const track = list[Math.floor(Math.random() * list.length)]
    await get().playTrack(track, list)
  },

  _start: async (track, { fade = false } = {}) => {
    flushListenLog()
    // pull bassGain/vocalGain from the library copy — `track` as passed in
    // (e.g. from a queue) may be a stale snapshot without the latest EQ
    const lib = useLibrary.getState().tracks.find((t) => t.id === track.id)
    if (lib) track = { ...track, bassGain: lib.bassGain, vocalGain: lib.vocalGain }
    set({ current: track, position: 0, duration: track.duration || 0, advancing: false, loadError: null, peaks: null })
    try {
      const url = await resolveUrl(track)
      if (!url) throw new Error('No playable source for this track')
      const crossfade = fade ? useSettings.getState().crossfade : 0
      await engine.playUrl(url, { fadeSeconds: crossfade })
      engine.setBass(track.bassGain ?? 0)
      engine.setVocal(track.vocalGain ?? 0)
      listenStart = { track, startedAt: Date.now() }
      set({ playing: true })
      applyMediaSession(track)
      useLibrary.getState().saveRemoteTrack(track)
      getWaveform(track.id).then(async (w) => {
        if (w?.peaks) {
          if (get().current?.id === track.id) set({ peaks: w.peaks })
          return
        }
        if (!track.blobId) return
        // backfill peaks for stored blobs that never got them
        const rec = await getBlobRecord(track.blobId)
        const peaks = rec && (await computePeaks(rec.blob))
        if (peaks) {
          putWaveform(track.id, peaks)
          if (get().current?.id === track.id) set({ peaks })
        }
      })
    } catch (err) {
      if (err?.message === 'superseded') return
      set({ playing: false, loadError: `Couldn't play “${track.title}”` })
    }
  },

  toggle: async () => {
    const s = get()
    if (!s.current) return
    if (engine.playing) {
      engine.pause()
      return
    }
    if (engine.hasLoaded) {
      await engine.resume()
    } else {
      // restored session whose audio isn't loaded yet — (re)load then resume
      const resumeAt = s.position
      await get()._start(s.current, { fade: false })
      if (resumeAt > 1) engine.seek(resumeAt)
    }
  },

  next: async ({ fade = false, manual = true } = {}) => {
    const { queue, index, repeat } = get()
    if (!queue.length) return
    let nextIndex = index + 1
    if (nextIndex >= queue.length) {
      if (repeat === 'all') nextIndex = 0
      else if (manual) nextIndex = 0
      else {
        // end of queue, no repeat — stop, and clear the advance guard so a
        // later manual play isn't blocked by a stuck `advancing` flag
        set({ playing: false, advancing: false })
        engine.pause()
        return
      }
    }
    set({ index: nextIndex })
    await get()._start(queue[nextIndex], { fade })
  },

  prev: async () => {
    const { queue, index, position } = get()
    if (position > 3 || index <= 0) {
      engine.seek(0)
      return
    }
    set({ index: index - 1 })
    await get()._start(queue[index - 1], { fade: false })
  },

  seek: (seconds) => {
    engine.seek(seconds)
    set({ position: seconds })
  },

  toggleShuffle: () => {
    const { shuffle, queue, originalQueue, current } = get()
    if (!shuffle) {
      const rest = queue.filter((t) => t.id !== current?.id)
      const newQueue = current ? [current, ...shuffleArray(rest)] : shuffleArray(queue)
      set({ shuffle: true, queue: newQueue, index: current ? 0 : -1 })
    } else {
      const idx = originalQueue.findIndex((t) => t.id === current?.id)
      set({ shuffle: false, queue: [...originalQueue], index: idx })
    }
  },

  setRepeat: (mode) => set({ repeat: mode }),

  addToQueue: (track, { next = false } = {}) => {
    const { queue, index } = get()
    if (!queue.length) return get().playTrack(track)
    const insertAt = next ? index + 1 : queue.length
    const newQueue = [...queue]
    newQueue.splice(insertAt, 0, track)
    set({ queue: newQueue, originalQueue: [...get().originalQueue, track] })
  },

  removeFromQueue: (i) => {
    const { queue, index } = get()
    if (i === index) return
    const newQueue = queue.filter((_, x) => x !== i)
    set({ queue: newQueue, index: i < index ? index - 1 : index })
  },

  // Drag-reorder within the live queue. Keeps `index` pointing at the same
  // currently-playing track as rows shift around it.
  moveInQueue: (from, to) => {
    const { queue, index } = get()
    if (from == null || to == null || from === to) return
    if (from < 0 || to < 0 || from >= queue.length || to >= queue.length) return
    const newQueue = [...queue]
    const [moved] = newQueue.splice(from, 1)
    newQueue.splice(to, 0, moved)
    let newIndex = index
    if (from === index) newIndex = to
    else if (from < index && to >= index) newIndex = index - 1
    else if (from > index && to <= index) newIndex = index + 1
    set({ queue: newQueue, index: newIndex })
  },

  // A track was deleted from the library — its blob is gone, so it can't
  // keep playing and can't be skipped to. Stop it if it's current (mirrors
  // close()), and strip it out of both queues either way.
  removeTrackEverywhere: (id) => {
    const { current, queue, originalQueue, index } = get()
    if (current?.id === id) {
      get().close()
      return
    }
    const qi = queue.findIndex((t) => t.id === id)
    set({
      queue: queue.filter((t) => t.id !== id),
      originalQueue: originalQueue.filter((t) => t.id !== id),
      index: qi !== -1 && qi < index ? index - 1 : index,
    })
  },

  setQueueOpen: (open) => set({ queueOpen: open }),
  setNowPlayingOpen: (open) => set({ nowPlayingOpen: open }),

  // Sleep timer: pause playback once `minutes` elapses, regardless of which
  // screen is open (the timeout lives here, not in a component).
  setSleepTimer: (minutes) => {
    get().clearSleepTimer()
    const id = setTimeout(() => {
      engine.pause()
      set({ sleepTimerEndsAt: null, _sleepTimerId: null })
    }, minutes * 60000)
    set({ sleepTimerEndsAt: Date.now() + minutes * 60000, _sleepTimerId: id })
  },
  clearSleepTimer: () => {
    const id = get()._sleepTimerId
    if (id) clearTimeout(id)
    set({ sleepTimerEndsAt: null, _sleepTimerId: null })
  },

  // full state restore (Connect handoff / group session join)
  restoreState: async ({ queue, index, position, playing }) => {
    const track = queue[index]
    if (!track) return
    set({ queue, originalQueue: [...queue], index })
    await get()._start(track, { fade: false })
    if (position > 1) engine.seek(position)
    if (!playing) engine.pause()
  },

  snapshotState: () => {
    const { queue, index, position, playing } = get()
    return { queue, index, position, playing }
  },

  // Close the current song entirely: stop playback, clear the player bar, and
  // forget the saved session so a refresh won't bring it back.
  close: () => {
    flushListenLog()
    engine.stop()
    clearSession()
    get().clearSleepTimer()
    set({
      current: null,
      queue: [],
      originalQueue: [],
      index: -1,
      playing: false,
      position: 0,
      duration: 0,
      peaks: null,
      loadError: null,
      queueOpen: false,
      nowPlayingOpen: false,
    })
  },

  // Restore the last session on boot (loaded but paused at its position, since
  // browsers block autoplay before a user gesture). Call after the library has
  // loaded so local artwork can be re-hydrated.
  restoreSession: async () => {
    if (get().current) return
    let saved
    try {
      saved = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null')
    } catch {
      saved = null
    }
    if (!saved || !Array.isArray(saved.queue) || !saved.queue.length) return

    const libTracks = useLibrary.getState().tracks
    const hydrate = (t) => {
      const lib = libTracks.find((x) => x.id === t.id)
      return lib ? { ...t, ...lib } : t // library copy has a fresh art URL / blobId
    }
    const queue = saved.queue.map(hydrate)
    const originalQueue = (saved.originalQueue?.length ? saved.originalQueue : saved.queue).map(hydrate)
    const index = saved.index >= 0 && saved.index < queue.length ? saved.index : 0
    const cur = queue[index]
    if (!cur) return

    set({
      queue,
      originalQueue,
      index,
      current: cur,
      shuffle: !!saved.shuffle,
      repeat: saved.repeat || 'off',
      position: saved.position || 0,
      duration: cur.duration || 0,
      playing: false,
    })
    applyMediaSession(cur)
    getWaveform(cur.id).then((w) => {
      if (get().current?.id === cur.id) set({ peaks: w?.peaks || null })
    })
    try {
      const url = await resolveUrl(cur)
      if (url) {
        await engine.loadPaused(url)
        engine.setBass(cur.bassGain ?? 0)
        engine.setVocal(cur.vocalGain ?? 0)
        if (saved.position > 1) engine.seek(saved.position)
        set({ position: saved.position || 0 })
      }
    } catch {
      /* couldn't preload (e.g. offline remote track) — will load on first play */
    }
  },
}))

// ---- engine wiring (module scope, once) ----
engine.on('time', ({ position, duration }) => {
  const s = usePlayer.getState()
  usePlayer.setState({ position, duration: duration || s.duration })
  persistSession() // throttled: keeps the saved resume-position current

  if (!engine.playing || !duration || s.advancing) return
  const remaining = duration - position
  const { crossfade, gapless } = useSettings.getState()
  const hasNext = s.index + 1 < s.queue.length || s.repeat === 'all'
  if (s.repeat !== 'one' && hasNext && crossfade > 0 && remaining <= crossfade + 0.1) {
    usePlayer.setState({ advancing: true })
    s.next({ fade: true, manual: false })
  } else if (s.repeat !== 'one' && hasNext && crossfade === 0 && remaining <= 0.25) {
    // Safety net: the media element's native 'ended' event is unreliable for
    // some sources (it occasionally never fires, dead-ending a track on its
    // final frame). While we still know we're playing, advance a hair early.
    // The 'ended' handler is guarded by `advancing`, so this never double-fires.
    usePlayer.setState({ advancing: true })
    s.next({ fade: false, manual: false })
  } else if (remaining <= 14 && gapless && s.repeat !== 'one' && hasNext && crossfade === 0) {
    const nextTrack = s.queue[(s.index + 1) % s.queue.length]
    if (nextTrack) resolveUrl(nextTrack).then((url) => url && engine.preloadUrl(url))
  }
})

engine.on('ended', () => {
  const s = usePlayer.getState()
  if (s.advancing) return // the time-based safety net already started the advance
  if (s.repeat === 'one') {
    engine.seek(0)
    engine.resume()
    return
  }
  usePlayer.setState({ advancing: true })
  s.next({ fade: false, manual: false })
})

engine.on('state', ({ playing }) => {
  const s = usePlayer.getState()
  usePlayer.setState({ playing })
  if (!playing) {
    // pause: bank the listened time so far
    if (listenStart) {
      useLibrary.getState().logPlay(listenStart.track, Date.now() - listenStart.startedAt)
      listenStart = null
    }
  } else if (!listenStart && s.current) {
    listenStart = { track: s.current, startedAt: Date.now() }
  }
})

if ('mediaSession' in navigator) {
  const ms = navigator.mediaSession
  ms.setActionHandler('play', () => usePlayer.getState().toggle())
  ms.setActionHandler('pause', () => usePlayer.getState().toggle())
  ms.setActionHandler('nexttrack', () => usePlayer.getState().next())
  ms.setActionHandler('previoustrack', () => usePlayer.getState().prev())
  ms.setActionHandler('seekto', (e) => usePlayer.getState().seek(e.seekTime))
}

window.addEventListener('beforeunload', flushListenLog)

// Persist the session immediately when the track/position-relevant state
// changes, and flush on hide/unload so a resume is always up to date.
usePlayer.subscribe((state, prev) => {
  if (
    state.current?.id !== prev.current?.id ||
    state.index !== prev.index ||
    state.shuffle !== prev.shuffle ||
    state.repeat !== prev.repeat ||
    state.playing !== prev.playing
  ) {
    persistSession(true)
  }
})
window.addEventListener('pagehide', saveSession)
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') saveSession()
})

if (import.meta.env.DEV) window.__raagaStores = { usePlayer, useSettings, useLibrary }

// module-level singletons: never hot-swap, always full-reload
if (import.meta.hot) import.meta.hot.decline()
