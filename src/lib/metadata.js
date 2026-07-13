import { parseBlob } from 'music-metadata'

// Accepts any audio OR video file; we only ever use the audio.
export const ACCEPTED_TYPES = 'audio/*,video/*'

export function isMediaFile(file) {
  return /^(audio|video)\//.test(file.type) || /\.(mp3|wav|ogg|oga|opus|flac|m4a|aac|weba|mp4|webm|mkv|mov|avi|m4v|3gp)$/i.test(file.name)
}

function titleFromFilename(name) {
  const base = name.replace(/\.[^.]+$/, '').replace(/[_]+/g, ' ').trim()
  // "Artist - Title" convention
  const m = base.match(/^(.+?)\s*-\s*(.+)$/)
  if (m) return { artist: m[1].trim(), title: m[2].trim() }
  return { artist: 'Unknown Artist', title: base }
}

function probeDuration(file) {
  return new Promise((resolve) => {
    const el = document.createElement('video')
    el.preload = 'metadata'
    el.muted = true
    el.playsInline = true
    const url = URL.createObjectURL(file)
    let settled = false
    const done = (d) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      URL.revokeObjectURL(url)
      el.removeAttribute('src')
      el.load?.()
      resolve(Number.isFinite(d) && d > 0 ? d : 0)
    }
    // Some containers/codecs (or mobile Safari) never fire loadedmetadata OR
    // error — cap the wait so an import can never hang on one file.
    const timer = setTimeout(() => done(0), 8000)
    el.onloadedmetadata = () => done(el.duration)
    el.ondurationchange = () => done(el.duration)
    el.onerror = () => done(0)
    el.src = url
  })
}

// Returns { title, artist, album, genre, year, duration, artBlob }
export async function extractMetadata(file) {
  const fallback = titleFromFilename(file.name)
  let meta = {
    title: fallback.title,
    artist: fallback.artist,
    album: '',
    genre: '',
    year: null,
    duration: 0,
    artBlob: null,
  }
  try {
    const parsed = await Promise.race([
      parseBlob(file, { duration: true }),
      new Promise((_, rej) => setTimeout(() => rej(new Error('tag-parse timeout')), 10000)),
    ])
    const c = parsed.common
    if (c.title) meta.title = c.title
    if (c.artist || c.artists?.length) meta.artist = c.artist || c.artists.join(', ')
    if (c.album) meta.album = c.album
    if (c.genre?.length) meta.genre = c.genre.join(', ')
    if (c.year) meta.year = c.year
    if (parsed.format.duration) meta.duration = parsed.format.duration
    const pic = c.picture?.[0]
    if (pic) meta.artBlob = new Blob([pic.data], { type: pic.format || 'image/jpeg' })
  } catch {
    // unparseable container (e.g. some video formats) — filename fallback stands
  }
  if (!meta.duration) meta.duration = await probeDuration(file)
  return meta
}
