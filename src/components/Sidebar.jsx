import { NavLink, useNavigate } from 'react-router-dom'
import { Home, Search, Compass, Library, BarChart3, Timer, Settings, Plus, Sparkles, Heart, Users, Sun, Moon, ChevronLeft, ChevronRight } from 'lucide-react'
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
  const collapsed = useSettings((s) => s.sidebarCollapsed)
  const toggleTheme = useSettings((s) => s.toggleTheme)
  const toggleSidebar = useSettings((s) => s.toggleSidebar)
  const navigate = useNavigate()
  const [moodOpen, setMoodOpen] = useState(false)

  return (
    <aside
      className={cn(
        'hidden md:flex flex-col shrink-0 border-r border-line py-5 gap-1 transition-[width] duration-200',
        collapsed ? 'w-[76px] px-2' : 'w-60 px-3'
      )}
    >
      <div className={cn('flex items-center mb-5', collapsed ? 'flex-col gap-2 px-0' : 'gap-2.5 px-3')}>
        <img
          src={`${import.meta.env.BASE_URL}hand-in-rock.png`}
          alt=""
          className="w-8 h-8 rounded-lg accent-glow shrink-0 object-cover"
        />
        {!collapsed && (
          <img
            src={`${import.meta.env.BASE_URL}logo.png`}
            alt="Riff"
            className="logo-wordmark h-6 flex-1 object-contain object-left"
          />
        )}
        {!collapsed && (
          <button
            onClick={toggleTheme}
            title={isLight ? 'Switch to Onyx (dark)' : 'Switch to Sandalwood (light)'}
            className="p-1.5 rounded-full text-muted hover:text-ink hover:bg-overlay/8 transition"
          >
            {isLight ? <Moon size={15} /> : <Sun size={15} />}
          </button>
        )}
        <button
          onClick={toggleSidebar}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="p-1.5 rounded-full text-muted hover:text-ink hover:bg-overlay/8 transition shrink-0"
        >
          {collapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
        </button>
      </div>

      {NAV.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          title={collapsed ? label : undefined}
          className={({ isActive }) =>
            cn(
              'flex items-center rounded-xl text-sm font-medium transition',
              collapsed ? 'justify-center px-0 py-2.5' : 'gap-3 px-3 py-2',
              isActive ? 'bg-overlay/8 text-ink' : 'text-muted hover:text-ink hover:bg-overlay/5'
            )
          }
        >
          <Icon size={17} className="shrink-0" />
          {!collapsed && label}
        </NavLink>
      ))}

      <div className={cn('mt-5 mb-1 flex items-center', collapsed ? 'flex-col gap-1 px-0' : 'justify-between px-3')}>
        {!collapsed && <span className="text-[11px] font-semibold uppercase tracking-widest text-muted">Playlists</span>}
        <div className={cn('flex gap-1', collapsed && 'flex-col')}>
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
        title={collapsed ? 'Liked Songs' : undefined}
        className={cn(
          'flex items-center rounded-lg text-sm text-muted hover:text-ink hover:bg-overlay/5 transition',
          collapsed ? 'justify-center px-0 py-1.5' : 'gap-2.5 px-3 py-1.5'
        )}
      >
        <span className="w-7 h-7 rounded-md grid place-items-center bg-gradient-to-br from-accent to-accent-hi/60 shrink-0">
          <Heart size={13} fill="white" className="text-white" />
        </span>
        {!collapsed && 'Liked Songs'}
      </NavLink>

      <div className="flex-1 overflow-y-auto -mx-1 px-1">
        {playlists.map((pl) => (
          <NavLink
            key={pl.id}
            to={`/playlist/${pl.id}`}
            title={collapsed ? pl.name : undefined}
            className={({ isActive }) =>
              cn(
                'flex items-center rounded-lg text-sm transition',
                collapsed ? 'justify-center px-0 py-1.5' : 'gap-2.5 px-3 py-1.5',
                isActive ? 'text-ink bg-overlay/5' : 'text-muted hover:text-ink hover:bg-overlay/5'
              )
            }
          >
            <Art src={pl.coverUrl} size="w-7 h-7" rounded="rounded-md" iconSize={12} />
            {!collapsed && (
              <>
                <span className="line-clamp-1 flex-1">{pl.name}</span>
                {pl.collaborative && <Users size={12} className="text-accent-hi shrink-0" />}
              </>
            )}
          </NavLink>
        ))}
      </div>

      <NavLink
        to="/settings"
        title={collapsed ? 'Settings' : undefined}
        className={({ isActive }) =>
          cn(
            'flex items-center rounded-xl text-sm font-medium transition',
            collapsed ? 'justify-center px-0 py-2.5' : 'gap-3 px-3 py-2',
            isActive ? 'bg-overlay/8 text-ink' : 'text-muted hover:text-ink hover:bg-overlay/5'
          )
        }
      >
        <Settings size={17} className="shrink-0" />
        {!collapsed && 'Settings'}
      </NavLink>

      <MoodPromptModal open={moodOpen} onClose={() => setMoodOpen(false)} />
    </aside>
  )
}
