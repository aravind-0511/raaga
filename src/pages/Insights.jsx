import { useMemo } from 'react'
import { BarChart3, Clock, Mic2, Disc3, Flame } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { useLibrary } from '../store/libraryStore'
import { EmptyState, SectionTitle } from '../components/ui'
import { formatHours } from '../lib/utils'

function aggregate(events) {
  const byArtist = new Map()
  const byGenre = new Map()
  const byTrack = new Map()
  const byDay = new Map()
  let totalMs = 0
  const dayKey = (ts) => new Date(ts).toISOString().slice(0, 10)

  for (const e of events) {
    totalMs += e.msListened
    for (const artist of (e.artist || 'Unknown').split(',').map((s) => s.trim())) {
      byArtist.set(artist, (byArtist.get(artist) || 0) + e.msListened)
    }
    if (e.genre) byGenre.set(e.genre, (byGenre.get(e.genre) || 0) + e.msListened)
    byTrack.set(e.title, (byTrack.get(e.title) || 0) + e.msListened)
    const dk = dayKey(e.playedAt)
    byDay.set(dk, (byDay.get(dk) || 0) + e.msListened)
  }

  // last 14 days series
  const days = []
  for (let i = 13; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000)
    const key = d.toISOString().slice(0, 10)
    days.push({
      day: d.toLocaleDateString(undefined, { weekday: 'short' }),
      minutes: Math.round((byDay.get(key) || 0) / 60000),
    })
  }

  const top = (map, n = 5) => [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, n)
  return { totalMs, topArtists: top(byArtist), topGenres: top(byGenre), topTracks: top(byTrack), days, uniqueTracks: byTrack.size }
}

function StatCard({ icon: Icon, label, value }) {
  return (
    <div className="glass rounded-2xl p-4">
      <Icon size={18} className="text-accent-hi mb-2" />
      <p className="text-xl font-bold tracking-tight">{value}</p>
      <p className="text-xs text-muted mt-0.5">{label}</p>
    </div>
  )
}

function RankList({ title, icon: Icon, entries, totalMs }) {
  return (
    <div className="glass rounded-2xl p-4">
      <p className="flex items-center gap-2 text-sm font-semibold mb-3">
        <Icon size={15} className="text-accent-hi" /> {title}
      </p>
      {entries.length === 0 && <p className="text-xs text-muted">Not enough data yet.</p>}
      <div className="flex flex-col gap-2">
        {entries.map(([name, ms], i) => (
          <div key={name} className="flex items-center gap-2.5">
            <span className="text-xs text-muted w-4">{i + 1}</span>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-medium line-clamp-1">{name}</p>
              <div className="h-1 rounded-full bg-white/8 mt-1">
                <div
                  className="h-full rounded-full bg-accent-hi"
                  style={{ width: `${Math.max(4, (ms / (entries[0]?.[1] || 1)) * 100)}%` }}
                />
              </div>
            </div>
            <span className="text-[11px] text-muted tabular-nums">{formatHours(ms)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function Insights() {
  const playEvents = useLibrary((s) => s.playEvents)
  const stats = useMemo(() => aggregate(playEvents), [playEvents])

  if (!playEvents.length) {
    return (
      <EmptyState
        icon={BarChart3}
        title="Your listening story starts here"
        hint="Play some music and Raaga builds a continuously updated recap — top artists, genres, and hours listened."
      />
    )
  }

  return (
    <div className="fade-up max-w-4xl">
      <h1 className="text-2xl md:text-3xl font-bold tracking-tight mb-1">Listening Insights</h1>
      <p className="text-sm text-muted mb-6">Your recap, updated live — not once a year.</p>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={Clock} label="Total listening" value={formatHours(stats.totalMs)} />
        <StatCard icon={Flame} label="Plays logged" value={playEvents.length} />
        <StatCard icon={Disc3} label="Unique tracks" value={stats.uniqueTracks} />
        <StatCard icon={Mic2} label="Artists heard" value={stats.topArtists.length >= 5 ? '5+' : stats.topArtists.length} />
      </div>

      <SectionTitle>Last 14 days</SectionTitle>
      <div className="glass rounded-2xl p-4 h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={stats.days} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
            <XAxis dataKey="day" tick={{ fill: '#8b87a0', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#8b87a0', fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip
              cursor={{ fill: 'rgba(255,255,255,0.05)' }}
              contentStyle={{ background: '#1c1930', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, fontSize: 12 }}
              formatter={(v) => [`${v} min`, 'Listened']}
            />
            <Bar dataKey="minutes" radius={[4, 4, 0, 0]}>
              {stats.days.map((d, i) => (
                <Cell key={i} fill={i === stats.days.length - 1 ? 'var(--accent-hi)' : 'color-mix(in srgb, var(--accent) 55%, transparent)'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-8">
        <RankList title="Top artists" icon={Mic2} entries={stats.topArtists} totalMs={stats.totalMs} />
        <RankList title="Top genres" icon={Disc3} entries={stats.topGenres} totalMs={stats.totalMs} />
      </div>
      <div className="mt-3">
        <RankList title="Most played tracks" icon={Flame} entries={stats.topTracks} totalMs={stats.totalMs} />
      </div>
    </div>
  )
}
