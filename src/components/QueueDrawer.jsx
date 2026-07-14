import { X, ListMusic } from 'lucide-react'
import { usePlayer } from '../store/playerStore'
import { Art, EmptyState } from './ui'
import { useSwipeToDismiss } from '../lib/useSwipeToDismiss'
import { cn, formatTime } from '../lib/utils'

export default function QueueDrawer() {
  const { queue, index, queueOpen } = usePlayer()
  const player = usePlayer.getState()
  const swipe = useSwipeToDismiss(() => usePlayer.getState().setQueueOpen(false))
  if (!queueOpen) return null

  return (
    <>
      {/* mobile backdrop (desktop shows it inline as a side panel) */}
      <div
        className="md:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
        onClick={() => player.setQueueOpen(false)}
      />
      <aside
        className={cn(
          'flex flex-col border-line shrink-0 fade-up',
          // mobile: bottom sheet overlay
          'fixed inset-x-0 bottom-0 z-40 w-full max-h-[75vh] rounded-t-2xl border-t bg-surface/95 backdrop-blur-xl pb-[max(env(safe-area-inset-bottom),0px)]',
          // desktop: static side panel
          'md:static md:z-auto md:w-80 md:max-h-none md:rounded-none md:border-t-0 md:border-l md:bg-transparent md:backdrop-blur-none md:pb-0'
        )}
        style={swipe.style}
      >
        {/* drag handle — swipe down to close (mobile) */}
        <div className="md:hidden flex justify-center pt-2.5 pb-0.5 shrink-0 touch-none" {...swipe.handlers}>
          <span className="w-9 h-1 rounded-full bg-overlay/20" />
        </div>
        <div className="flex items-center justify-between px-4 py-4 border-b border-line touch-none md:touch-auto" {...swipe.handlers}>
          <h3 className="font-semibold text-sm">Queue</h3>
          <button
            onClick={() => player.setQueueOpen(false)}
            className="p-2 rounded-full hover:bg-overlay/10 text-muted hover:text-ink transition active:scale-90"
          >
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
                'group flex items-center gap-2.5 px-2.5 py-2 rounded-lg cursor-pointer transition',
                i === index ? 'bg-overlay/8' : 'hover:bg-overlay/5',
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
                  className="p-1.5 rounded text-muted opacity-100 md:opacity-0 md:group-hover:opacity-100 hover:text-ink transition"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
      </aside>
    </>
  )
}
