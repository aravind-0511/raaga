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
    album: track.album || 'Raaga',
    artwork: track.artUrl ? [{ src: track.artUrl }] : [],
  })
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

  _start: async (track, { fade = false } = {}) => {
    flushListenLog()
    set({ current: track, position: 0, duration: track.duration || 0, advancing: false, loadError: null, peaks: null })
    try {
      const url = await resolveUrl(track)
      if (!url) throw new Error('No playable source for this track')
      const crossfade = fade ? useSettings.getState().crossfade : 0
      await engine.playUrl(url, { fadeSeconds: crossfade })
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
    if (!get().current) return
    if (engine.playing) engine.pause()
    else await engine.resume()
  },

  next: async ({ fade = false, manual = true } = {}) => {
    const { queue, index, repeat } = get()
    if (!queue.length) return
    let nextIndex = index + 1
    if (nextIndex >= queue.length) {
      if (repeat === 'all') nextIndex = 0
      else if (manual) nextIndex = 0
      else {
        set({ playing: false })
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

  cycleRepeat: () => {
    const order = ['off', 'all', 'one']
    set({ repeat: order[(order.indexOf(get().repeat) + 1) % 3] })
  },

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

  setQueueOpen: (open) => set({ queueOpen: open }),
  setNowPlayingOpen: (open) => set({ nowPlayingOpen: open }),

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
}))

// ---- engine wiring (module scope, once) ----
engine.on('time', ({ position, duration }) => {
  const s = usePlayer.getState()
  usePlayer.setState({ position, duration: duration || s.duration })

  if (!engine.playing || !duration || s.advancing) return
  const remaining = duration - position
  const { crossfade, gapless } = useSettings.getState()
  const hasNext = s.index + 1 < s.queue.length || s.repeat === 'all'
  if (s.repeat !== 'one' && hasNext && crossfade > 0 && remaining <= crossfade + 0.1) {
    usePlayer.setState({ advancing: true })
    s.next({ fade: true, manual: false })
  } else if (remaining <= 14 && gapless && s.repeat !== 'one' && hasNext && crossfade === 0) {
    const nextTrack = s.queue[(s.index + 1) % s.queue.length]
    if (nextTrack) resolveUrl(nextTrack).then((url) => url && engine.preloadUrl(url))
  }
})

engine.on('ended', () => {
  const s = usePlayer.getState()
  if (s.repeat === 'one') {
    engine.seek(0)
    engine.resume()
    return
  }
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

if (import.meta.env.DEV) window.__raagaStores = { usePlayer, useSettings, useLibrary }

// module-level singletons: never hot-swap, always full-reload
if (import.meta.hot) import.meta.hot.decline()
