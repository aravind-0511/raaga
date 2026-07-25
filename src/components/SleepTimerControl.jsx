import { useEffect, useState } from 'react'
import { Moon } from 'lucide-react'
import { usePlayer } from '../store/playerStore'
import { Menu, MenuItem } from './ui'
import { cn } from '../lib/utils'

const PRESETS = [5, 15, 30, 45, 60]

function formatRemaining(endsAt) {
  const ms = Math.max(0, endsAt - Date.now())
  const totalMin = Math.ceil(ms / 60000)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

// Pauses playback once the timer elapses (the actual timeout lives in
// playerStore so it fires even if this screen gets closed first).
export default function SleepTimerControl() {
  const endsAt = usePlayer((s) => s.sleepTimerEndsAt)
  const setSleepTimer = usePlayer((s) => s.setSleepTimer)
  const clearSleepTimer = usePlayer((s) => s.clearSleepTimer)
  const [, forceTick] = useState(0)

  useEffect(() => {
    if (!endsAt) return
    const id = setInterval(() => forceTick((n) => n + 1), 1000)
    return () => clearInterval(id)
  }, [endsAt])

  return (
    <Menu
      align="right"
      button={
        <button
          className={cn('flex items-center gap-1.5 p-2 transition active:scale-90', endsAt ? 'text-accent-hi' : 'text-muted hover:text-ink')}
          title="Sleep timer"
        >
          <Moon size={20} />
          {endsAt && <span className="text-xs tabular-nums">{formatRemaining(endsAt)}</span>}
        </button>
      }
    >
      <div className="px-3.5 py-2 text-xs text-muted">Pause playback after…</div>
      {PRESETS.map((min) => (
        <MenuItem key={min} onClick={() => setSleepTimer(min)}>
          {min} minutes
        </MenuItem>
      ))}
      {endsAt && (
        <MenuItem danger onClick={clearSleepTimer}>
          Turn off
        </MenuItem>
      )}
    </Menu>
  )
}
