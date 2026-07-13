import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Music, X } from 'lucide-react'
import { cn } from '../lib/utils'

export function Art({ src, size = 'w-12 h-12', rounded = 'rounded-lg', className = '', iconSize = 20 }) {
  const [failed, setFailed] = useState(false)
  useEffect(() => setFailed(false), [src])
  if (!src || failed) {
    return (
      <div className={cn(size, rounded, 'shrink-0 grid place-items-center bg-gradient-to-br from-surface-2 to-surface text-muted', className)}>
        <Music size={iconSize} />
      </div>
    )
  }
  return <img src={src} alt="" onError={() => setFailed(true)} className={cn(size, rounded, 'shrink-0 object-cover', className)} />
}

export function Modal({ open, onClose, title, children, wide = false }) {
  if (!open) return null
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-6" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        onClick={(e) => e.stopPropagation()}
        className={cn(
          'glass relative w-full rounded-t-2xl md:rounded-2xl p-5 pb-[max(env(safe-area-inset-bottom),1.25rem)] md:pb-5 fade-up max-h-[85vh] overflow-y-auto bg-surface/95! text-ink',
          wide ? 'md:max-w-2xl' : 'md:max-w-md'
        )}
        style={{ background: 'color-mix(in srgb, var(--color-surface) 92%, var(--color-ink) 3%)' }}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-overlay/10 text-muted hover:text-ink transition">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  )
}

// Small popover menu anchored to a trigger button, portal + fixed positioning
// so it never clips inside scroll containers.
export function Menu({ button, children, align = 'right' }) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const btnRef = useRef(null)

  const toggle = (e) => {
    e.stopPropagation()
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      const menuW = 224
      const rawLeft = align === 'right' ? r.right - menuW : r.left
      // clamp within the viewport on both edges (important on narrow phones)
      const left = Math.min(Math.max(8, rawLeft), window.innerWidth - menuW - 8)
      const top = Math.min(r.bottom + 6, window.innerHeight - 60)
      setPos({ top, left })
    }
    setOpen(!open)
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
      {/* capture phase: fires before the button's own onClick can stopPropagation() it away */}
      <span ref={btnRef} onClickCapture={toggle} className="inline-flex">
        {button}
      </span>
      {open &&
        createPortal(
          <div
            className="glass fixed z-50 w-56 rounded-xl py-1.5 shadow-2xl fade-up max-h-80 overflow-y-auto text-ink"
            style={{ top: pos.top, left: pos.left, background: 'color-mix(in srgb, var(--color-surface-2) 94%, var(--color-ink) 3%)' }}
            onClick={(e) => {
              e.stopPropagation()
              setOpen(false)
            }}
          >
            {children}
          </div>,
          document.body
        )}
    </>
  )
}

export function MenuItem({ icon: Icon, children, onClick, danger = false }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-3 px-3.5 py-2 text-sm text-left transition hover:bg-overlay/8',
        danger ? 'text-rose-400' : 'text-ink/85'
      )}
    >
      {Icon && <Icon size={15} className="shrink-0 opacity-70" />}
      <span className="line-clamp-1">{children}</span>
    </button>
  )
}

export function SectionTitle({ children, action }) {
  return (
    <div className="flex items-center justify-between mb-4 mt-8 first:mt-0">
      <h2 className="text-xl font-bold tracking-tight">{children}</h2>
      {action}
    </div>
  )
}

export function EmptyState({ icon: Icon, title, hint, children }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {Icon && <Icon size={36} className="text-muted mb-4" />}
      <p className="font-semibold mb-1">{title}</p>
      {hint && <p className="text-sm text-muted max-w-sm">{hint}</p>}
      {children}
    </div>
  )
}
