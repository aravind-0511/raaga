import { useEffect, useRef, useState } from 'react'
import { Users, X, Send, Crown, ChevronDown } from 'lucide-react'
import { useSession } from '../store/sessionStore'
import { usePlayer } from '../store/playerStore'
import { useSwipeToDismiss } from '../lib/useSwipeToDismiss'
import { cn } from '../lib/utils'

export default function GroupSessionPanel() {
  const group = useSession((s) => s.group)
  const availableGroup = useSession((s) => s.availableGroup)
  const session = useSession.getState()
  const current = usePlayer((s) => s.current)
  const [text, setText] = useState('')
  const [minimized, setMinimized] = useState(false)
  const chatEnd = useRef(null)
  // swipe down minimizes (keeps the session alive) — leaving is an explicit X tap
  const swipe = useSwipeToDismiss(() => setMinimized(true))

  useEffect(() => {
    chatEnd.current?.scrollIntoView({ behavior: 'smooth' })
  }, [group?.chat?.length])

  // join toast
  if (!group) {
    if (!availableGroup) return null
    return (
      <div
        className="fixed bottom-32 md:bottom-24 inset-x-4 md:inset-x-auto md:right-4 z-40 glass rounded-2xl p-4 md:w-72 fade-up"
        style={{ background: 'color-mix(in srgb, var(--color-surface-2) 92%, var(--color-ink) 3%)' }}
      >
        <p className="text-sm font-medium flex items-center gap-2">
          <Users size={15} className="text-accent-hi" /> Group session live
        </p>
        <p className="text-xs text-muted mt-1">{availableGroup.hostName} is listening — join to sync playback and chat.</p>
        <button
          onClick={session.joinGroup}
          className="mt-3 w-full rounded-lg bg-accent hover:bg-accent-hi text-sm font-medium text-white py-2 transition"
        >
          Join session
        </button>
      </div>
    )
  }

  const isHost = group.hostId === session.deviceId
  const memberCount = Object.keys(group.members).length + 1

  return (
    <>
      {/* minimized floating pill — mobile only */}
      {minimized && (
        <button
          onClick={() => {
            swipe.reset()
            setMinimized(false)
          }}
          className="md:hidden fixed bottom-32 right-4 z-40 glass rounded-full pl-3 pr-4 py-2 flex items-center gap-2 text-sm fade-up active:scale-95 transition-transform"
          style={{ background: 'color-mix(in srgb, var(--color-surface-2) 92%, var(--color-ink) 3%)' }}
        >
          <Users size={15} className="text-accent-hi" /> Group · {memberCount}
        </button>
      )}

      {/* mobile backdrop (tap to minimize, keeps the session alive) */}
      {!minimized && (
        <div className="md:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={() => setMinimized(true)} />
      )}

      <aside
        className={cn(
          'flex-col border-line',
          // mobile: bottom-sheet overlay
          'fixed inset-x-0 bottom-0 z-40 max-h-[75vh] rounded-t-2xl border-t bg-surface/95 backdrop-blur-xl pb-[max(env(safe-area-inset-bottom),0px)] fade-up',
          minimized ? 'hidden' : 'flex',
          // desktop: static side panel
          'md:static md:z-auto md:flex md:w-72 md:max-h-none md:rounded-none md:border-t-0 md:border-l md:bg-transparent md:backdrop-blur-none md:pb-0 md:animate-none'
        )}
        style={swipe.style}
      >
        {/* drag handle — swipe down to minimize (mobile) */}
        <div className="md:hidden flex justify-center pt-2.5 pb-0.5 shrink-0 touch-none" {...swipe.handlers}>
          <span className="w-9 h-1 rounded-full bg-overlay/20" />
        </div>
        <div className="flex items-center justify-between px-4 py-4 border-b border-line touch-none md:touch-auto" {...swipe.handlers}>
          <div className="min-w-0">
            <h3 className="font-semibold text-sm flex items-center gap-1.5">
              <Users size={14} className="text-accent-hi" /> Group session
            </h3>
            <p className="text-[11px] text-muted mt-0.5 line-clamp-1">
              {isHost ? 'You are hosting' : `Hosted by ${group.hostName}`} · {memberCount} listening
            </p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => setMinimized(true)}
              className="md:hidden p-2 rounded-full hover:bg-overlay/10 text-muted hover:text-ink transition"
              title="Minimize"
            >
              <ChevronDown size={16} />
            </button>
            <button
              onClick={session.leaveGroup}
              className="p-2 rounded-full hover:bg-overlay/10 text-muted hover:text-ink transition"
              title="Leave session"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {current && (
          <div className="px-4 py-3 border-b border-line">
            <p className="text-[11px] uppercase tracking-widest text-muted mb-1">Synced now</p>
            <p className="text-sm font-medium line-clamp-1">{current.title}</p>
            <p className="text-xs text-muted line-clamp-1">{current.artist}</p>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-2.5">
          {group.chat.length === 0 && <p className="text-xs text-muted text-center mt-6">Say something — chat is shared with everyone in the session.</p>}
          {group.chat.map((m, i) => (
            <div key={i} className="text-sm">
              <span className="font-medium text-xs" style={{ color: m.color }}>
                {m.from}
                {m.from === group.hostName && <Crown size={10} className="inline ml-1 -mt-0.5" />}
              </span>
              <p className="text-ink/85 text-[13px] leading-snug">{m.text}</p>
            </div>
          ))}
          <div ref={chatEnd} />
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            session.sendChat(text)
            setText('')
          }}
          className="flex gap-2 p-3 border-t border-line"
        >
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Message…"
            className="flex-1 rounded-full bg-overlay/5 border border-line px-3.5 py-2 text-sm outline-none focus:border-accent-hi/60"
          />
          <button type="submit" className="p-2.5 rounded-full bg-accent hover:bg-accent-hi text-white transition">
            <Send size={14} />
          </button>
        </form>
      </aside>
    </>
  )
}
