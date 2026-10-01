import { Capacitor, registerPlugin } from '@capacitor/core'

// Bridges playerStore to the native RiffMediaSession plugin (see
// android/app/src/main/java/com/riff/player/) when running as the installed
// Android app. A bare WebView doesn't bridge the Web MediaSession API to a
// real Android notification the way Chrome does, so this is what actually
// drives the lock-screen/notification controls there. On the web (dev,
// GitHub Pages PWA) every export here is a safe no-op — the existing
// navigator.mediaSession wiring in playerStore covers that case instead.
export const isNative = Capacitor.isNativePlatform()

const RiffMediaSession = isNative ? registerPlugin('RiffMediaSession') : null

const FALLBACK_ART_URL = `${import.meta.env.BASE_URL}pwa-192.png`
const artworkCache = new Map() // artUrl -> base64 data URL

async function resolveArtworkBase64(artUrl) {
  const key = artUrl || FALLBACK_ART_URL
  if (artworkCache.has(key)) return artworkCache.get(key)
  try {
    const res = await fetch(key)
    const blob = await res.blob()
    const base64 = await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
    artworkCache.set(key, base64)
    return base64
  } catch {
    return null
  }
}

export async function updateMetadata(track) {
  if (!isNative || !track) return
  const artworkBase64 = await resolveArtworkBase64(track.artUrl)
  RiffMediaSession.updateMetadata({
    title: track.title || '',
    artist: track.artist || '',
    album: track.album || 'Riff',
    duration: track.duration || 0,
    artworkBase64,
  })
}

export function updatePlaybackState(playing, position) {
  if (!isNative) return
  RiffMediaSession.updatePlaybackState({ playing, position: position || 0 })
}

export function stop() {
  if (!isNative) return
  RiffMediaSession.stop()
}

// Registers a handler for native notification/lock-screen/hardware button
// presses: ({ action: 'play'|'pause'|'next'|'previous'|'seek'|'stop', position? }).
// Returns an unsubscribe function; safe to call on web (returns a no-op).
export function onAction(handler) {
  if (!isNative) return () => {}
  const handle = RiffMediaSession.addListener('mediaButton', handler)
  return () => handle.remove()
}
