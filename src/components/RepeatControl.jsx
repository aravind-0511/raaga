import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Repeat, Repeat1 } from 'lucide-react'
import { usePlayer } from '../store/playerStore'
import { cn } from '../lib/utils'

const OPTIONS = [
  { mode: 'all', label: 'Repeat all', icon: Repeat },
  { mode: 'one', label: 'Repeat one', icon: Repeat1 },
]

// Click while off opens a picker for the loop mode; click while a mode is
// active turns it straight off (no cycling through every state to get back
// to off).
export default function RepeatControl({ size = 18 }) {
  const repeat = usePlayer((s) => s.repeat)
  const setRepeat = usePlayer((s) => s.setRepeat)
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const btnRef = useRef(null)
  const RepeatIcon = repeat === 'one' ? Repeat1 : Repeat

  const openMenu = () => {
    if (!btnRef.current) return
    const r = btnRef.current.getBoundingClientRect()
    const menuW = 160
    const left = Math.min(Math.max(8, r.left), window.innerWidth - menuW - 8)
    const top = Math.min(r.bottom + 6, window.innerHeight - 100)
    setPos({ top, left })
    setOpen(true)
  }

  const handleClick = (e) => {
    e.stopPropagation()
    if (repeat !== 'off') {
      setRepeat('off')
      setOpen(false)
      return
    }
    setOpen((o) => !o)
    if (!open) openMenu()
  }

  useEffect(() => {
    if (!open) return
    const close = () => setOpen(false)
    window.addEventListener('click', close)
    window.addEventListener('resize', close)
    return () => {
      window.removeEventListener('click', close)
      window.removeEventListener('resize', close)
    }
  }, [open])

  return (
    <>
      <button
        ref={btnRef}
        onClick={handleClick}
        title={repeat === 'off' ? 'Repeat' : `${repeat === 'all' ? 'Repeat all' : 'Repeat one'} — click to turn off`}
        className={cn('p-2 transition active:scale-90', repeat !== 'off' ? 'text-accent-hi' : 'text-muted hover:text-ink')}
      >
        <RepeatIcon size={size} />
      </button>
      {open &&
        createPortal(
          <div
            className="glass fixed z-50 w-40 rounded-xl py-1.5 shadow-2xl fade-up text-ink"
            style={{ top: pos.top, left: pos.left, background: 'color-mix(in srgb, var(--color-surface-2) 94%, var(--color-ink) 3%)' }}
            onClick={(e) => e.stopPropagation()}
          >
            {OPTIONS.map(({ mode, label, icon: Icon }) => (
              <button
                key={mode}
                onClick={() => {
                  setRepeat(mode)
                  setOpen(false)
                }}
                className="w-full flex items-center gap-3 px-3.5 py-2 text-sm text-left transition hover:bg-overlay/8 text-ink/85"
              >
                <Icon size={15} className="shrink-0 opacity-70" />
                {label}
              </button>
            ))}
          </div>,
          document.body
        )}
    </>
  )
}
