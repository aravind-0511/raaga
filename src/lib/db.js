import { openDB } from 'idb'

// Object stores:
//  tracks     — track metadata (local uploads, saved saavn tracks, demo tracks)
//  blobs      — raw media blobs: uploads, offline downloads, cover art
//  playlists  — user playlists
//  likes      — liked track ids
//  playEvents — listening history (feeds recents, time capsule, insights)
//  waveforms  — precomputed peak arrays per track
//  settings   — key/value app settings
export const dbPromise = openDB('raaga', 1, {
  upgrade(db) {
    db.createObjectStore('tracks', { keyPath: 'id' })
    db.createObjectStore('blobs', { keyPath: 'id' })
    db.createObjectStore('playlists', { keyPath: 'id' })
    db.createObjectStore('likes', { keyPath: 'trackId' })
    const events = db.createObjectStore('playEvents', { keyPath: 'id', autoIncrement: true })
    events.createIndex('byTime', 'playedAt')
    events.createIndex('byTrack', 'trackId')
    db.createObjectStore('waveforms', { keyPath: 'trackId' })
    db.createObjectStore('settings', { keyPath: 'key' })
  },
})
