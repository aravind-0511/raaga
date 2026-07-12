import { create } from 'zustand'
import {
  getAllTracks, putTrack, deleteTrack, getTrack,
  putBlob, getBlobRecord, deleteBlob, blobUrl,
  getAllPlaylists, putPlaylist, deletePlaylist,
  getAllLikes, setLiked,
  addPlayEvent, getAllPlayEvents,
  putWaveform,
} from '../lib/repo'
import { extractMetadata, isMediaFile } from '../lib/metadata'
import { computePeaks } from '../lib/player/waveform'
import { ensureDemoCatalog } from '../lib/catalog/demoCatalog'
import { pickStreamUrl } from '../lib/catalog/saavn'
import { uid } from '../lib/utils'

async function withArtUrl(track) {
  if (track.artBlobId && !track.artUrl?.startsWith('http')) {
    return { ...track, artUrl: await blobUrl(track.artBlobId) }
  }
  return track
}

export const useLibrary = create((set, get) => ({
  tracks: [],
  playlists: [],
  likes: {}, // trackId -> likedAt
  playEvents: [],
  loading: true,
  uploading: null, // { done, total, current }
  downloadingIds: new Set(),

  init: async () => {
    if (get()._initialized) return
    set({ _initialized: true })
    await ensureDemoCatalog()
    const [tracks, playlists, likes, playEvents] = await Promise.all([
      getAllTracks(), getAllPlaylists(), getAllLikes(), getAllPlayEvents(),
    ])
    const resolved = await Promise.all(tracks.map(withArtUrl))
    const withCovers = await Promise.all(
      playlists.map(async (p) => (p.coverBlobId ? { ...p, coverUrl: await blobUrl(p.coverBlobId) } : p))
    )
    set({
      tracks: resolved.sort((a, b) => b.addedAt - a.addedAt),
      playlists: withCovers.sort((a, b) => b.createdAt - a.createdAt),
      likes: Object.fromEntries(likes.map((l) => [l.trackId, l.likedAt])),
      playEvents,
      loading: false,
    })
  },

  // ---- uploads (any audio/video file; playback uses audio only) ----
  addFiles: async (fileList) => {
    const files = [...fileList].filter(isMediaFile)
    if (!files.length) return { added: 0, skipped: fileList.length }
    set({ uploading: { done: 0, total: files.length, current: files[0].name } })
    let added = 0
    for (const file of files) {
      set((s) => ({ uploading: { ...s.uploading, current: file.name } }))
      try {
        const meta = await extractMetadata(file)
        const id = uid('local:')
        const blobId = 'blob:' + id
        await putBlob(blobId, file)
        let artBlobId = null
        if (meta.artBlob) {
          artBlobId = 'art:' + id
          await putBlob(artBlobId, meta.artBlob)
        }
        const track = {
          id, source: 'local',
          title: meta.title, artist: meta.artist, album: meta.album,
          genre: meta.genre, year: meta.year, duration: meta.duration,
          blobId, artBlobId, artUrl: null,
          fileName: file.name, fileType: file.type,
          addedAt: Date.now(),
        }
        await putTrack(track)
        const resolved = await withArtUrl(track)
        set((s) => ({ tracks: [resolved, ...s.tracks] }))
        added++
        // waveform peaks in the background — playback never waits on this
        computePeaks(file).then((peaks) => peaks && putWaveform(id, peaks))
      } catch {
        // unreadable file — skip
      }
      set((s) => ({ uploading: { ...s.uploading, done: s.uploading.done + 1 } }))
    }
    set({ uploading: null })
    return { added, skipped: files.length - added }
  },

  removeTrack: async (id) => {
    await deleteTrack(id)
    set((s) => ({
      tracks: s.tracks.filter((t) => t.id !== id),
      playlists: s.playlists.map((p) => ({ ...p, trackIds: p.trackIds.filter((x) => x !== id) })),
      likes: Object.fromEntries(Object.entries(s.likes).filter(([k]) => k !== id)),
    }))
    for (const p of get().playlists) await putPlaylist(p)
  },

  // Persist a catalog track's metadata locally (called on play/like/add)
  saveRemoteTrack: async (track) => {
    if (get().tracks.some((t) => t.id === track.id)) return
    const existing = await getTrack(track.id)
    if (!existing) await putTrack(track)
    set((s) => ({ tracks: [track, ...s.tracks.filter((t) => t.id !== track.id)] }))
  },

  // ---- likes ----
  toggleLike: async (track) => {
    const liked = !!get().likes[track.id]
    if (!liked) await get().saveRemoteTrack(track)
    await setLiked(track.id, !liked)
    set((s) => {
      const likes = { ...s.likes }
      if (liked) delete likes[track.id]
      else likes[track.id] = Date.now()
      return { likes }
    })
  },

  // ---- playlists ----
  createPlaylist: async ({ name, description = '', trackIds = [], collaborative = false }) => {
    const playlist = {
      id: uid('pl_'), name, description, trackIds, collaborative,
      coverBlobId: null, coverUrl: null, createdAt: Date.now(), updatedAt: Date.now(),
    }
    await putPlaylist(playlist)
    set((s) => ({ playlists: [playlist, ...s.playlists] }))
    return playlist
  },

  updatePlaylist: async (id, patch, { broadcast = true } = {}) => {
    const current = get().playlists.find((p) => p.id === id)
    if (!current) return
    let updated = { ...current, ...patch, updatedAt: Date.now() }
    if (patch.coverBlob) {
      const coverBlobId = 'cover:' + id
      await putBlob(coverBlobId, patch.coverBlob)
      delete updated.coverBlob
      updated.coverBlobId = coverBlobId
      updated.coverUrl = URL.createObjectURL(patch.coverBlob)
    }
    const { coverUrl, ...persisted } = updated
    await putPlaylist(persisted)
    set((s) => ({ playlists: s.playlists.map((p) => (p.id === id ? updated : p)) }))
    if (broadcast && updated.collaborative) {
      const { notifyPlaylistChange } = await import('./sessionStore').then((m) => m.useSession.getState())
      notifyPlaylistChange(updated)
    }
    return updated
  },

  removePlaylist: async (id) => {
    await deletePlaylist(id)
    set((s) => ({ playlists: s.playlists.filter((p) => p.id !== id) }))
  },

  addToPlaylist: async (playlistId, tracks) => {
    const list = Array.isArray(tracks) ? tracks : [tracks]
    for (const t of list) await get().saveRemoteTrack(t)
    const pl = get().playlists.find((p) => p.id === playlistId)
    if (!pl) return
    const trackIds = [...pl.trackIds, ...list.map((t) => t.id).filter((id) => !pl.trackIds.includes(id))]
    return get().updatePlaylist(playlistId, { trackIds })
  },

  // apply a playlist replica arriving from another tab (no re-broadcast)
  applyRemotePlaylist: async (playlist) => {
    const { coverUrl, ...persisted } = playlist
    await putPlaylist(persisted)
    set((s) => {
      const exists = s.playlists.some((p) => p.id === playlist.id)
      return {
        playlists: exists
          ? s.playlists.map((p) => (p.id === playlist.id ? { ...p, ...playlist } : p))
          : [playlist, ...s.playlists],
      }
    })
  },

  // ---- history ----
  logPlay: async (track, msListened) => {
    if (!track || msListened < 3000) return
    const event = {
      trackId: track.id, title: track.title, artist: track.artist,
      genre: track.genre || '', playedAt: Date.now(), msListened,
    }
    await addPlayEvent(event)
    set((s) => ({ playEvents: [...s.playEvents, event] }))
  },

  // ---- offline downloads ----
  downloadForOffline: async (track) => {
    if (track.blobId) return true
    const { useSettings } = await import('./settingsStore')
    const url = pickStreamUrl(track, useSettings.getState().quality)
    if (!url) return false
    set((s) => ({ downloadingIds: new Set([...s.downloadingIds, track.id]) }))
    try {
      const res = await fetch(url)
      if (!res.ok) throw new Error('download failed')
      const blob = await res.blob()
      const blobId = 'dl:' + track.id
      await putBlob(blobId, blob)
      await get().saveRemoteTrack(track)
      const updated = { ...(await getTrack(track.id)), blobId, downloadedAt: Date.now() }
      await putTrack(updated)
      set((s) => ({ tracks: s.tracks.map((t) => (t.id === track.id ? { ...t, ...updated } : t)) }))
      computePeaks(blob).then((peaks) => peaks && putWaveform(track.id, peaks))
      return true
    } catch {
      return false
    } finally {
      set((s) => {
        const ids = new Set(s.downloadingIds)
        ids.delete(track.id)
        return { downloadingIds: ids }
      })
    }
  },

  removeDownload: async (track) => {
    if (!track.blobId || track.source === 'local') return
    await deleteBlob(track.blobId)
    const updated = { ...(await getTrack(track.id)), blobId: null, downloadedAt: null }
    await putTrack(updated)
    set((s) => ({ tracks: s.tracks.map((t) => (t.id === track.id ? { ...t, blobId: null, downloadedAt: null } : t)) }))
  },
}))

// ---- derived helpers ----
export function recentTracks(state, limit = 12) {
  const seen = new Set()
  const out = []
  for (let i = state.playEvents.length - 1; i >= 0 && out.length < limit; i--) {
    const ev = state.playEvents[i]
    if (seen.has(ev.trackId)) continue
    seen.add(ev.trackId)
    const track = state.tracks.find((t) => t.id === ev.trackId)
    if (track) out.push({ track, playedAt: ev.playedAt })
  }
  return out
}

export function likedTracks(state) {
  return Object.entries(state.likes)
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => state.tracks.find((t) => t.id === id))
    .filter(Boolean)
}

// module-level singletons: never hot-swap, always full-reload
if (import.meta.hot) import.meta.hot.decline()
