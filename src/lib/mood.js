// Mood-prompt -> search terms + local-library matcher for mood playlists.

const MOOD_RULES = [
  { match: /rain|monsoon|cozy|chill|lofi|lo-fi|calm|relax/i, terms: ['lofi chill', 'melody', 'unplugged'], genres: ['lo-fi', 'ambient', 'chill', 'melody', 'acoustic'] },
  { match: /code|coding|study|focus|work|deep|concentrat/i, terms: ['instrumental', 'lofi study', 'bgm'], genres: ['ambient', 'lo-fi', 'instrumental', 'carnatic'] },
  { match: /gym|workout|run|beast|pump|energy|mass/i, terms: ['mass beats', 'kuthu', 'workout tamil'], genres: ['dance', 'hip hop', 'rock', 'kuthu'] },
  { match: /party|dance|celebrat|festival|wedding/i, terms: ['kuthu dance', 'party tamil', 'folk dance'], genres: ['dance', 'folk', 'pop', 'kuthu'] },
  { match: /sad|heartbreak|breakup|cry|melanchol|lonely/i, terms: ['sad melody', 'pathos', 'feeling songs'], genres: ['melody', 'sad', 'blues'] },
  { match: /love|romance|romantic|crush|date/i, terms: ['love melody', 'romantic hits', 'duet'], genres: ['melody', 'romance', 'pop'] },
  { match: /sleep|night|dream|wind down|bedtime/i, terms: ['veena instrumental', 'sleep melody', 'ambient'], genres: ['ambient', 'classical', 'melody'] },
  { match: /drive|road|trip|travel|highway/i, terms: ['road trip tamil', 'synthwave', 'long drive'], genres: ['synthwave', 'pop', 'rock'] },
  { match: /devotion|temple|pray|bhakti|spiritual/i, terms: ['devotional', 'bhakti', 'carnatic'], genres: ['devotional', 'carnatic', 'classical'] },
]

export function moodPlan(prompt) {
  const hits = MOOD_RULES.filter((r) => r.match.test(prompt))
  const terms = hits.flatMap((r) => r.terms)
  const genres = hits.flatMap((r) => r.genres)
  // always try the raw prompt itself as a catalog query too
  const words = prompt.trim().split(/\s+/).filter((w) => w.length > 3).slice(0, 4)
  if (words.length) terms.push(words.join(' '))
  if (!terms.length) terms.push(prompt.trim() || 'melody')
  return { terms: [...new Set(terms)].slice(0, 3), genres: [...new Set(genres)] }
}

export function matchLocalTracks(tracks, plan, prompt) {
  const p = prompt.toLowerCase()
  return tracks.filter((t) => {
    const hay = `${t.title} ${t.artist} ${t.album} ${t.genre}`.toLowerCase()
    if (plan.genres.some((g) => hay.includes(g.toLowerCase()))) return true
    return p.split(/\s+/).some((w) => w.length > 3 && hay.includes(w))
  })
}
