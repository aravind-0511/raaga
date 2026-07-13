import { decodeHtml } from '../utils'

// Client for the unofficial JioSaavn API (https://saavn.dev docs,
// default public instance saavn.sumit.co). No API key; the base URL is
// user-configurable in Settings since public instances rate-limit.

export const DEFAULT_CATALOG_URL = 'https://jiosavan-api2.vercel.app'
// community instances of the same API, tried in order when one fails/rate-limits
const FALLBACK_URLS = [DEFAULT_CATALOG_URL, 'https://saavn.sumit.co']

let baseUrl = DEFAULT_CATALOG_URL
let workingUrl = null // last instance that actually answered

// Only accept well-formed http(s) origins — rejects things like `javascript:`,
// bare garbage strings, or other schemes that would otherwise throw deep
// inside fetch() call sites instead of failing fast with a clear reason.
export function isValidCatalogUrl(url) {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

export function setCatalogBase(url) {
  const clean = (url || '').trim().replace(/\/+$/, '')
  baseUrl = clean && isValidCatalogUrl(clean) ? clean : DEFAULT_CATALOG_URL
  workingUrl = null
}

// quality setting -> saavn bitrate label
const QUALITY_MAP = { normal: '96kbps', high: '160kbps', vhigh: '320kbps' }

export function pickStreamUrl(track, quality = 'high') {
  if (!track.urls) return track.streamUrl || null
  const want = QUALITY_MAP[quality] || '160kbps'
  return track.urls[want] || track.urls['320kbps'] || track.urls['160kbps'] || track.urls['96kbps'] || Object.values(track.urls)[0] || null
}

function bestImage(images) {
  if (!Array.isArray(images) || !images.length) return null
  const q = (s) => parseInt(s?.quality) || 0
  return [...images].sort((a, b) => q(b) - q(a))[0]?.url || null
}

export function normalizeSong(s) {
  const urls = {}
  for (const d of s.downloadUrl || []) urls[d.quality] = d.url
  return {
    id: 'saavn:' + s.id,
    source: 'saavn',
    title: decodeHtml(s.name),
    artist: decodeHtml((s.artists?.primary || []).map((a) => a.name).join(', ')) || 'Unknown Artist',
    album: decodeHtml(s.album?.name || ''),
    genre: s.language ? s.language[0].toUpperCase() + s.language.slice(1) : '',
    year: s.year ? Number(s.year) : null,
    duration: Number(s.duration) || 0,
    artUrl: bestImage(s.image),
    urls,
    addedAt: Date.now(),
  }
}

async function apiAt(instance, path, params) {
  const url = new URL(instance + path)
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v)
  }
  const res = await fetch(url, { signal: AbortSignal.timeout(12000) })
  if (!res.ok) throw new Error(`Catalog request failed (${res.status})`)
  const json = await res.json()
  if (json.success === false) throw new Error(json.message || 'Catalog error')
  return json.data
}

async function api(path, params = {}) {
  const candidates = [...new Set([workingUrl, baseUrl, ...FALLBACK_URLS].filter(Boolean))]
  let lastErr
  for (const instance of candidates) {
    try {
      const data = await apiAt(instance, path, params)
      workingUrl = instance
      return data
    } catch (err) {
      lastErr = err
      if (workingUrl === instance) workingUrl = null
    }
  }
  throw lastErr
}

export async function searchSongs(query, { page = 0, limit = 20 } = {}) {
  const data = await api('/api/search/songs', { query, page, limit })
  return (data?.results || []).map(normalizeSong)
}

export async function searchAlbums(query, { limit = 10 } = {}) {
  const data = await api('/api/search/albums', { query, page: 0, limit })
  return (data?.results || []).map((a) => ({
    id: a.id,
    name: decodeHtml(a.name),
    artist: decodeHtml((a.artists?.primary || []).map((x) => x.name).join(', ')),
    year: a.year,
    language: a.language,
    artUrl: bestImage(a.image),
  }))
}

export async function searchArtists(query, { limit = 10 } = {}) {
  const data = await api('/api/search/artists', { query, page: 0, limit })
  return (data?.results || []).map((a) => ({
    id: a.id,
    name: decodeHtml(a.name),
    role: a.role,
    artUrl: bestImage(a.image),
  }))
}

export async function getAlbumSongs(albumId) {
  const data = await api('/api/albums', { id: albumId })
  return (data?.songs || []).map(normalizeSong)
}

export async function getArtistSongs(artistId) {
  const data = await api(`/api/artists/${artistId}/songs`, { page: 0, sortBy: 'popularity', sortOrder: 'desc' })
  return (data?.songs || []).map(normalizeSong)
}
