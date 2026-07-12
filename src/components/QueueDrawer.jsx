import { X, ListMusic } from 'lucide-react'
import { usePlayer } from '../store/playerStore'
import { Art, EmptyState } from './ui'
import { cn, formatTime } from '../lib/utils'

export default function QueueDrawer() {
  const { queue, index, queueOpen } = usePlayer()
  const player = usePlayer.getState()
  if (!queueOpen) return null

  return (
    <aside className="hidden md:flex flex-col w-80 shrink-0 border-l border-line">
      <div className="flex items-center justify-between px-4 py-4 border-b border-line">
        <h3 className="font-semibold text-sm">Queue</h3>
        <button onClick={() => player.setQueueOpen(false)} className="p-1.5 rounded-full hover:bg-white/10 text-muted hover:text-white transition">
          <X size={16} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {queue.length === 0 && <EmptyState icon={ListMusic} title="Queue is empty" hint="Play something to build a queue." />}
        {queue.map((t, i) => (
          <div
            key={t.id + i}
            onClick={() => player.playAt(i)}
            className={cn(
              'group flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg cursor-pointer transition',
              i === index ? 'bg-white/8' : 'hover:bg-white/5',
              i < index && 'opacity-50'
            )}
          >
            <Art src={t.artUrl} size="w-9 h-9" rounded="rounded-md" iconSize={14} />
            <div className="flex-1 min-w-0">
              <p className={cn('text-[13px] font-medium line-clamp-1', i === index && 'text-accent-hi')}>{t.title}</p>
              <p className="text-[11px] text-muted line-clamp-1">{t.artist}</p>
            </div>
            <span className="text-[11px] text-muted tabular-nums">{formatTime(t.duration)}</span>
            {i !== index && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  player.removeFromQueue(i)
                }}
                className="p-1 rounded text-muted opacity-0 group-hover:opacity-100 hover:text-white transition"
              >
                <X size={13} />
              </button>
            )}
          </div>
        ))}
      </div>
    </aside>
  )
}
