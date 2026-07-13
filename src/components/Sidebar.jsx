import { NavLink, useNavigate } from 'react-router-dom'
import { Home, Search, Compass, Library, BarChart3, Timer, Settings, Plus, Sparkles, Heart, Users, Sun, Moon } from 'lucide-react'
import { useLibrary } from '../store/libraryStore'
import { useSettings } from '../store/settingsStore'
import { useState } from 'react'
import { cn } from '../lib/utils'
import MoodPromptModal from './MoodPromptModal'
import { Art } from './ui'

const NAV = [
  { to: '/', label: 'Home', icon: Home },
  { to: '/search', label: 'Search', icon: Search },
  { to: '/browse', label: 'Browse', icon: Compass },
  { to: '/library', label: 'Library', icon: Library },
  { to: '/insights', label: 'Insights', icon: BarChart3 },
  { to: '/focus', label: 'Focus', icon: Timer },
]

export default function Sidebar() {
  const playlists = useLibrary((s) => s.playlists)
  const isLight = useSettings((s) => s.theme === 'light')
  const toggleTheme = useSettings((s) => s.toggleTheme)
  const navigate = useNavigate()
  const [moodOpen, setMoodOpen] = useState(false)

  return (
    <aside className="hidden md:flex flex-col w-60 shrink-0 border-r border-line px-3 py-5 gap-1">
      <div className="flex items-center gap-2.5 px-3 mb-5">
        <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" className="w-8 h-8 rounded-lg accent-glow" />
        <span className="text-lg font-bold tracking-tight flex-1">Raaga</span>
        <button
          onClick={toggleTheme}
          title={isLight ? 'Switch to Espresso (dark)' : 'Switch to Sandalwood (light)'}
          className="p-1.5 rounded-full text-muted hover:text-ink hover:bg-overlay/8 transition"
        >
          {isLight ? <Moon size={15} /> : <Sun size={15} />}
        </button>
      </div>

      {NAV.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition',
              isActive ? 'bg-overlay/8 text-ink' : 'text-muted hover:text-ink hover:bg-overlay/5'
            )
          }
        >
          <Icon size={17} />
          {label}
        </NavLink>
      ))}

      <div className="mt-5 mb-1 flex items-center justify-between px-3">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-muted">Playlists</span>
        <div className="flex gap-1">
          <button
            title="Mood playlist"
            onClick={() => setMoodOpen(true)}
            className="p-1 rounded-md text-muted hover:text-accent-hi hover:bg-overlay/5 transition"
          >
            <Sparkles size={14} />
          </button>
          <button
            title="New playlist"
            onClick={async () => {
              const pl = await useLibrary.getState().createPlaylist({ name: 'New Playlist' })
              navigate(`/playlist/${pl.id}`)
            }}
            className="p-1 rounded-md text-muted hover:text-ink hover:bg-overlay/5 transition"
          >
            <Plus size={14} />
          </button>
        </div>
      </div>

      <NavLink
        to="/library?tab=liked"
        className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-sm text-muted hover:text-ink hover:bg-overlay/5 transition"
      >
        <span className="w-7 h-7 rounded-md grid place-items-center bg-gradient-to-br from-accent to-accent-hi/60">
          <Heart size={13} fill="white" className="text-white" />
        </span>
        Liked Songs
      </NavLink>

      <div className="flex-1 overflow-y-auto -mx-1 px-1">
        {playlists.map((pl) => (
          <NavLink
            key={pl.id}
            to={`/playlist/${pl.id}`}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-sm transition',
                isActive ? 'text-ink bg-overlay/5' : 'text-muted hover:text-ink hover:bg-overlay/5'
              )
            }
          >
            <Art src={pl.coverUrl} size="w-7 h-7" rounded="rounded-md" iconSize={12} />
            <span className="line-clamp-1 flex-1">{pl.name}</span>
            {pl.collaborative && <Users size={12} className="text-accent-hi shrink-0" />}
          </NavLink>
        ))}
      </div>

      <NavLink
        to="/settings"
        className={({ isActive }) =>
          cn(
            'flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition',
            isActive ? 'bg-overlay/8 text-ink' : 'text-muted hover:text-ink hover:bg-overlay/5'
          )
        }
      >
        <Settings size={17} />
        Settings
      </NavLink>

      <MoodPromptModal open={moodOpen} onClose={() => setMoodOpen(false)} />
    </aside>
  )
}
