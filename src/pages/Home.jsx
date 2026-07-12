import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Sparkles, History, Clock, Play } from 'lucide-react'
import { useLibrary, recentTracks } from '../store/libraryStore'
import { usePlayer } from '../store/playerStore'
import { Art, SectionTitle, EmptyState } from './../components/ui'
import UploadDropzone from '../components/UploadDropzone'
import MoodPromptModal from '../components/MoodPromptModal'
import { relativeDate } from '../lib/utils'

function greeting() {
  const h = new Date().getHours()
  if (h < 5) return 'Up late?'
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

// Time Capsule: what you were listening to around this date in past months
function timeCapsule(playEvents, tracks) {
  const now = new Date()
  const groups = []
  for (const monthsBack of [1, 2, 3, 6, 12]) {
    const target = new Date(now)
    target.setMonth(target.getMonth() - monthsBack)
    const lo = target.getTime() - 3 * 86400000
    const hi = target.getTime() + 3 * 86400000
    const events = playEvents.filter((e) => e.playedAt >= lo && e.playedAt <= hi)
    if (!events.length) continue
    const seen = new Set()
    const items = []
    for (let i = events.length - 1; i >= 0 && items.length < 5; i--) {
      if (seen.has(events[i].trackId)) continue
      seen.add(events[i].trackId)
      const track = tracks.find((t) => t.id === events[i].trackId)
      if (track) items.push(track)
    }
    if (items.length) groups.push({ monthsBack, items })
  }
  return groups
}

export default function Home() {
  const tracks = useLibrary((s) => s.tracks)
  const playEvents = useLibrary((s) => s.playEvents)
  const lib = useLibrary()
  const player = usePlayer.getState()
  const [moodOpen, setMoodOpen] = useState(false)

  const recents = useMemo(() => recentTracks(lib, 10), [lib.playEvents, lib.tracks])
  const capsule = useMemo(() => timeCapsule(playEvents, tracks), [playEvents, tracks])

  return (
    <div className="fade-up max-w-5xl">
      <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{greeting()}</h1>
      <p className="text-muted text-sm mt-1">Your music, your vibe.</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-6">
        <button
          onClick={() => setMoodOpen(true)}
          className="glass rounded-2xl p-5 text-left hover:bg-white/8 transition group"
        >
          <Sparkles className="text-accent-hi mb-3 group-hover:scale-110 transition" size={22} />
          <p className="font-semibold">Mood playlist</p>
          <p className="text-xs text-muted mt-0.5">Describe a vibe, get a playlist</p>
        </button>
        <Link to="/focus" className="glass rounded-2xl p-5 hover:bg-white/8 transition group">
          <Clock className="text-accent-hi mb-3 group-hover:scale-110 transition" size={22} />
          <p className="font-semibold">Focus session</p>
          <p className="text-xs text-muted mt-0.5">Distraction-free player + pomodoro</p>
        </Link>
      </div>

      {recents.length > 0 && (
        <>
          <SectionTitle>Recently played</SectionTitle>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {recents.map(({ track, playedAt }) => (
              <button
                key={track.id}
                onClick={() => player.playTrack(track, recents.map((r) => r.track))}
                className="glass rounded-xl p-3 text-left hover:bg-white/8 transition group"
              >
                <div className="relative mb-2.5">
                  <Art src={track.artUrl} size="w-full aspect-square h-auto" rounded="rounded-lg" iconSize={28} />
                  <span className="absolute bottom-2 right-2 w-9 h-9 rounded-full bg-accent grid place-items-center opacity-0 group-hover:opacity-100 translate-y-1 group-hover:translate-y-0 transition shadow-lg">
                    <Play size={15} fill="white" className="text-white ml-0.5" />
                  </span>
                </div>
                <p className="text-sm font-medium line-clamp-1">{track.title}</p>
                <p className="text-[11px] text-muted line-clamp-1">{relativeDate(playedAt)}</p>
              </button>
            ))}
          </div>
        </>
      )}

      {capsule.length > 0 && (
        <>
          <SectionTitle>
            <span className="flex items-center gap-2">
              <History size={19} className="text-accent-hi" /> Time Capsule
            </span>
          </SectionTitle>
          {capsule.map((g) => (
            <div key={g.monthsBack} className="glass rounded-2xl p-4 mb-3">
              <p className="text-xs text-muted mb-2.5">
                Around this time{' '}
                <span className="text-accent-hi font-medium">
                  {g.monthsBack === 12 ? 'a year ago' : g.monthsBack === 1 ? 'a month ago' : `${g.monthsBack} months ago`}
                </span>{' '}
                you had these on repeat:
              </p>
              <div className="flex flex-wrap gap-2">
                {g.items.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => player.playTrack(t, g.items)}
                    className="flex items-center gap-2 rounded-full bg-white/5 hover:bg-white/10 pl-1 pr-3 py-1 transition"
                  >
                    <Art src={t.artUrl} size="w-6 h-6" rounded="rounded-full" iconSize={11} />
                    <span className="text-xs line-clamp-1 max-w-40">{t.title}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </>
      )}

      {tracks.length <= 5 && (
        <>
          <SectionTitle>Add your music</SectionTitle>
          <UploadDropzone />
        </>
      )}

      {recents.length === 0 && tracks.length > 5 && (
        <EmptyState icon={History} title="Nothing played yet" hint="Play something and it'll show up here — plus in your Time Capsule months from now." />
      )}

      <MoodPromptModal open={moodOpen} onClose={() => setMoodOpen(false)} />
    </div>
  )
}
