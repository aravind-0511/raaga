import { useMemo, useState } from 'react'
import { Loader2, WifiOff, Play } from 'lucide-react'
import { searchSongs } from '../lib/catalog/saavn'
import { usePlayer } from '../store/playerStore'
import { useLibrary } from '../store/libraryStore'
import { TrackList } from '../components/TrackRow'
import { SectionTitle } from '../components/ui'
import { cn } from '../lib/utils'

const CATEGORIES = [
  { name: 'Tamil Hits', query: 'tamil hits', hue: '265' },
  { name: 'Kuthu & Dance', query: 'kuthu dance tamil', hue: '10' },
  { name: 'Melody', query: 'tamil melody hits', hue: '200' },
  { name: 'Ilaiyaraaja', query: 'ilaiyaraaja hits', hue: '35' },
  { name: 'A.R. Rahman', query: 'ar rahman tamil', hue: '150' },
  { name: 'Anirudh', query: 'anirudh ravichander', hue: '320' },
  { name: 'Love Songs', query: 'tamil love songs', hue: '340' },
  { name: '90s Rewind', query: '90s tamil hits', hue: '55' },
  { name: 'Devotional', query: 'tamil devotional', hue: '25' },
  { name: 'Lo-fi & Chill', query: 'tamil lofi', hue: '230' },
  { name: 'Hindi Top', query: 'hindi top hits', hue: '0' },
  { name: 'Telugu Beats', query: 'telugu hits', hue: '110' },
  { name: 'Malayalam Vibes', query: 'malayalam hits', hue: '175' },
  { name: 'English Pop', query: 'english pop hits', hue: '285' },
  { name: 'Workout', query: 'workout motivation tamil', hue: '80' },
  { name: 'Sleep & Calm', query: 'sleep instrumental veena', hue: '250' },
]

export default function Browse() {
  const [active, setActive] = useState(null)
  const [songs, setSongs] = useState([])
  const [busy, setBusy] = useState(false)
  const [offline, setOffline] = useState(false)
  const player = usePlayer.getState()
  const tracks = useLibrary((s) => s.tracks)
  const demoTracks = useMemo(() => tracks.filter((t) => t.source === 'demo'), [tracks])

  const open = async (cat) => {
    setActive(cat)
    setBusy(true)
    setOffline(false)
    try {
      const results = await searchSongs(cat.query, { limit: 25 })
      setSongs(results)
      if (!results.length) setOffline(true)
    } catch {
      setSongs([])
      setOffline(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fade-up max-w-5xl">
      <h1 className="text-2xl md:text-3xl font-bold tracking-tight mb-6">Browse</h1>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.name}
            onClick={() => open(cat)}
            className={cn(
              'relative overflow-hidden rounded-2xl p-4 h-24 text-left font-semibold transition hover:scale-[1.02]',
              active?.name === cat.name && 'ring-2 ring-white/40'
            )}
            style={{
              background: `linear-gradient(135deg, oklch(0.35 0.09 ${cat.hue}), oklch(0.22 0.06 ${cat.hue}))`,
            }}
          >
            {cat.name}
            <span
              className="absolute -bottom-3 -right-3 w-14 h-14 rounded-xl rotate-12 opacity-40"
              style={{ background: `oklch(0.55 0.15 ${cat.hue})` }}
            />
          </button>
        ))}
      </div>

      {active && (
        <>
          <SectionTitle
            action={
              songs.length > 0 && (
                <button
                  onClick={() => player.playTrack(songs[0], songs)}
                  className="flex items-center gap-1.5 text-sm bg-accent hover:bg-accent-hi rounded-full px-4 py-1.5 font-medium transition"
                >
                  <Play size={13} fill="currentColor" /> Play all
                </button>
              )
            }
          >
            {active.name}
          </SectionTitle>
          {busy && (
            <div className="flex justify-center py-10">
              <Loader2 className="animate-spin text-accent-hi" size={24} />
            </div>
          )}
          {!busy && offline && (
            <div className="glass rounded-xl p-4 flex items-center gap-3 text-sm text-muted">
              <WifiOff size={16} className="text-amber-400 shrink-0" />
              Catalog unreachable. Meanwhile, the built-in demo tracks below always work offline.
            </div>
          )}
          {!busy && songs.length > 0 && <TrackList tracks={songs} />}
        </>
      )}

      {(offline || !active) && demoTracks.length > 0 && (
        <>
          <SectionTitle>Built-in demos (always offline)</SectionTitle>
          <TrackList tracks={demoTracks} />
        </>
      )}
    </div>
  )
}
