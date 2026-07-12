import { useEffect, useRef, useState } from 'react'
import { Users, X, Send, Crown } from 'lucide-react'
import { useSession } from '../store/sessionStore'
import { usePlayer } from '../store/playerStore'

export default function GroupSessionPanel() {
  const group = useSession((s) => s.group)
  const availableGroup = useSession((s) => s.availableGroup)
  const session = useSession.getState()
  const current = usePlayer((s) => s.current)
  const [text, setText] = useState('')
  const chatEnd = useRef(null)

  useEffect(() => {
    chatEnd.current?.scrollIntoView({ behavior: 'smooth' })
  }, [group?.chat?.length])

  // join toast
  if (!group) {
    if (!availableGroup) return null
    return (
      <div className="fixed bottom-24 right-4 z-40 glass rounded-2xl p-4 w-72 fade-up" style={{ background: 'color-mix(in srgb, var(--color-surface-2) 92%, white 3%)' }}>
        <p className="text-sm font-medium flex items-center gap-2">
          <Users size={15} className="text-accent-hi" /> Group session live
        </p>
        <p className="text-xs text-muted mt-1">{availableGroup.hostName} is listening — join to sync playback and chat.</p>
        <button
          onClick={session.joinGroup}
          className="mt-3 w-full rounded-lg bg-accent hover:bg-accent-hi text-sm font-medium py-1.5 transition"
        >
          Join session
        </button>
      </div>
    )
  }

  const isHost = group.hostId === session.deviceId
  const memberCount = Object.keys(group.members).length + 1

  return (
    <aside className="hidden md:flex flex-col w-72 shrink-0 border-l border-line">
      <div className="flex items-center justify-between px-4 py-4 border-b border-line">
        <div>
          <h3 className="font-semibold text-sm flex items-center gap-1.5">
            <Users size={14} className="text-accent-hi" /> Group session
          </h3>
          <p className="text-[11px] text-muted mt-0.5">
            {isHost ? 'You are hosting' : `Hosted by ${group.hostName}`} · {memberCount} listening
          </p>
        </div>
        <button onClick={session.leaveGroup} className="p-1.5 rounded-full hover:bg-white/10 text-muted hover:text-white transition">
          <X size={15} />
        </button>
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
            <p className="text-white/85 text-[13px] leading-snug">{m.text}</p>
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
          className="flex-1 rounded-full bg-white/5 border border-line px-3.5 py-1.5 text-sm outline-none focus:border-accent-hi/60"
        />
        <button type="submit" className="p-2 rounded-full bg-accent hover:bg-accent-hi transition">
          <Send size={14} />
        </button>
      </form>
    </aside>
  )
}
