import { dbPromise } from './db'

// Single data-access seam. Everything below is async CRUD over IndexedDB;
// swapping in Supabase later means reimplementing this module only.

// blobId -> object URL (session cache). Each entry pins its Blob in memory
// for as long as the URL is registered, so this is capped LRU rather than
// unbounded — over a long session (many tracks played/downloaded/art
// fetched) an ever-growing cache here was a real contributor to memory
// pressure, one of the things that makes a background tab a kill target.
const objectUrls = new Map()
const MAX_OBJECT_URLS = 40
// Blobs that must never be evicted regardless of LRU order — the playback
// engine pins whatever's actually loaded into a <video> element, since
// revoking a URL still assigned as an element's src would cut the audio out
// from under itself.
const pinnedBlobIds = new Set()

export function pinBlobUrl(blobId) {
  if (blobId) pinnedBlobIds.add(blobId)
}
export function unpinBlobUrl(blobId) {
  if (blobId) pinnedBlobIds.delete(blobId)
}

export async function blobUrl(blobId) {
  if (!blobId) return null
  if (objectUrls.has(blobId)) {
    // touch: move to most-recently-used position
    const url = objectUrls.get(blobId)
    objectUrls.delete(blobId)
    objectUrls.set(blobId, url)
    return url
  }
  const rec = await (await dbPromise).get('blobs', blobId)
  if (!rec) return null
  const url = URL.createObjectURL(rec.blob)
  objectUrls.set(blobId, url)
  if (objectUrls.size > MAX_OBJECT_URLS) {
    for (const [key, u] of objectUrls) {
      if (pinnedBlobIds.has(key)) continue
      URL.revokeObjectURL(u)
      objectUrls.delete(key)
      break
    }
  }
  return url
}

// tracks
export async function getAllTracks() {
  return (await dbPromise).getAll('tracks')
}
export async function getTrack(id) {
  return (await dbPromise).get('tracks', id)
}
export async function putTrack(track) {
  return (await dbPromise).put('tracks', track)
}
export async function deleteTrack(id) {
  const db = await dbPromise
  const track = await db.get('tracks', id)
  if (track?.blobId) await db.delete('blobs', track.blobId)
  if (track?.artBlobId) await db.delete('blobs', track.artBlobId)
  await db.delete('waveforms', id)
  await db.delete('likes', id)
  await db.delete('tracks', id)
}

// blobs
export async function putBlob(id, blob) {
  await (await dbPromise).put('blobs', { id, blob })
  return id
}
export async function getBlobRecord(id) {
  return (await dbPromise).get('blobs', id)
}
export async function deleteBlob(id) {
  const db = await dbPromise
  await db.delete('blobs', id)
  const url = objectUrls.get(id)
  if (url) {
    URL.revokeObjectURL(url)
    objectUrls.delete(id)
  }
}

// playlists
export async function getAllPlaylists() {
  return (await dbPromise).getAll('playlists')
}
export async function putPlaylist(playlist) {
  return (await dbPromise).put('playlists', playlist)
}
export async function deletePlaylist(id) {
  const db = await dbPromise
  const pl = await db.get('playlists', id)
  if (pl?.coverBlobId) await deleteBlob(pl.coverBlobId)
  await db.delete('playlists', id)
}

// likes
export async function getAllLikes() {
  return (await dbPromise).getAll('likes')
}
export async function setLiked(trackId, liked) {
  const db = await dbPromise
  if (liked) await db.put('likes', { trackId, likedAt: Date.now() })
  else await db.delete('likes', trackId)
}

// play events
export async function addPlayEvent(event) {
  return (await dbPromise).add('playEvents', event)
}
export async function getAllPlayEvents() {
  return (await dbPromise).getAllFromIndex('playEvents', 'byTime')
}

// waveforms
export async function getWaveform(trackId) {
  return (await dbPromise).get('waveforms', trackId)
}
export async function putWaveform(trackId, peaks) {
  return (await dbPromise).put('waveforms', { trackId, peaks })
}

// settings
export async function getAllSettings() {
  const rows = await (await dbPromise).getAll('settings')
  return Object.fromEntries(rows.map((r) => [r.key, r.value]))
}
export async function putSetting(key, value) {
  return (await dbPromise).put('settings', { key, value })
}
