import { NavLink } from 'react-router-dom'
import { Home, Search, Compass, Library, Settings } from 'lucide-react'
import { cn } from '../lib/utils'

const TABS = [
  { to: '/', label: 'Home', icon: Home },
  { to: '/search', label: 'Search', icon: Search },
  { to: '/browse', label: 'Browse', icon: Compass },
  { to: '/library', label: 'Library', icon: Library },
  { to: '/settings', label: 'Settings', icon: Settings },
]

export default function MobileTabBar() {
  return (
    <nav className="md:hidden glass border-t border-line flex justify-around px-2 pb-[max(env(safe-area-inset-bottom),6px)] pt-2 z-30">
      {TABS.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            cn('flex flex-col items-center gap-0.5 px-3 py-1.5 text-[10px] transition', isActive ? 'text-ink' : 'text-muted')
          }
        >
          <Icon size={19} />
          {label}
        </NavLink>
      ))}
    </nav>
  )
}
