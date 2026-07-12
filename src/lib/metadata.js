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

async function probeDuration(file) {
  return new Promise((resolve) => {
    const el = document.createElement('video')
    el.preload = 'metadata'
    const url = URL.createObjectURL(file)
    const done = (d) => {
      URL.revokeObjectURL(url)
      el.removeAttribute('src')
      resolve(d)
    }
    el.onloadedmetadata = () => done(Number.isFinite(el.duration) ? el.duration : 0)
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
    const parsed = await parseBlob(file, { duration: true })
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
