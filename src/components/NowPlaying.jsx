import { ChevronDown, Play, Pause, SkipBack, SkipForward, Shuffle, Repeat, Repeat1, Heart, Download, ListMusic, Check } from 'lucide-react'
import { usePlayer } from '../store/playerStore'
import { useLibrary } from '../store/libraryStore'
import { Art } from './ui'
import WaveformSeekBar from './WaveformSeekBar'
import Visualizer from './Visualizer'
import { cn, formatTime } from '../lib/utils'

export default function NowPlaying() {
  const { current, playing, position, duration, shuffle, repeat, peaks, nowPlayingOpen, queue, index } = usePlayer()
  const player = usePlayer.getState()
  const liked = useLibrary((s) => (current ? !!s.likes[current.id] : false))
  const downloading = useLibrary((s) => (current ? s.downloadingIds.has(current.id) : false))
  const lib = useLibrary.getState()

  if (!nowPlayingOpen || !current) return null
  const RepeatIcon = repeat === 'one' ? Repeat1 : Repeat
  const upNext = queue[index + 1]

  return (
    <div className="fixed inset-0 z-40 bg-bg/95 backdrop-blur-2xl flex flex-col fade-up overflow-y-auto">
      {/* ambient glow behind art */}
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          background:
            'radial-gradient(600px 400px at 50% 30%, color-mix(in srgb, var(--accent) 30%, transparent), transparent 70%)',
        }}
      />

      <div className="relative flex items-center justify-between px-5 pt-5 md:px-10">
        <button
          onClick={() => player.setNowPlayingOpen(false)}
          className="p-2 rounded-full hover:bg-white/10 text-muted hover:text-white transition"
        >
          <ChevronDown size={22} />
        </button>
        <span className="text-[11px] uppercase tracking-widest text-muted">Now Playing</span>
        <button
          onClick={() => {
            player.setNowPlayingOpen(false)
            player.setQueueOpen(true)
          }}
          className="p-2 rounded-full hover:bg-white/10 text-muted hover:text-white transition"
        >
          <ListMusic size={20} />
        </button>
      </div>

      <div className="relative flex-1 flex flex-col items-center justify-center px-6 py-6 gap-6 max-w-2xl w-full mx-auto">
        {current.artUrl ? (
          <img
            src={current.artUrl}
            alt=""
            className={cn('w-64 h-64 md:w-80 md:h-80 rounded-3xl object-cover shadow-2xl accent-glow transition-transform duration-700', playing ? 'scale-100' : 'scale-95')}
          />
        ) : (
          <div className="w-64 h-64 md:w-80 md:h-80 rounded-3xl accent-glow overflow-hidden glass grid place-items-end">
            <Visualizer bars={40} height={200} className="px-4" />
          </div>
        )}

        <div className="text-center w-full">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight line-clamp-1">{current.title}</h1>
          <p className="text-muted mt-1 line-clamp-1">
            {current.artist}
            {current.album ? ` · ${current.album}` : ''}
          </p>
        </div>

        <div className="w-full">
          <WaveformSeekBar peaks={peaks} position={position} duration={duration} onSeek={player.seek} height={44} />
          <div className="flex justify-between text-[11px] text-muted tabular-nums mt-1">
            <span>{formatTime(position)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        <div className="flex items-center gap-6 md:gap-8">
          <button onClick={player.toggleShuffle} className={cn('p-2 transition', shuffle ? 'text-accent-hi' : 'text-muted hover:text-white')}>
            <Shuffle size={20} />
          </button>
          <button onClick={player.prev} className="p-2 text-white/85 hover:text-white transition">
            <SkipBack size={26} fill="currentColor" />
          </button>
          <button
            onClick={player.toggle}
            className="w-16 h-16 rounded-full bg-white text-black grid place-items-center hover:scale-105 transition shadow-xl"
          >
            {playing ? <Pause size={26} fill="currentColor" /> : <Play size={26} fill="currentColor" className="ml-1" />}
          </button>
          <button onClick={() => player.next()} className="p-2 text-white/85 hover:text-white transition">
            <SkipForward size={26} fill="currentColor" />
          </button>
          <button onClick={player.cycleRepeat} className={cn('p-2 transition', repeat !== 'off' ? 'text-accent-hi' : 'text-muted hover:text-white')}>
            <RepeatIcon size={20} />
          </button>
        </div>

        <div className="flex items-center gap-5">
          <button
            onClick={() => lib.toggleLike(current)}
            className={cn('p-2 transition', liked ? 'text-accent-hi' : 'text-muted hover:text-white')}
          >
            <Heart size={20} fill={liked ? 'currentColor' : 'none'} />
          </button>
          {current.source !== 'local' &&
            (current.blobId ? (
              <span className="flex items-center gap-1.5 text-xs text-accent-hi">
                <Check size={15} /> Downloaded
              </span>
            ) : (
              <button
                onClick={() => lib.downloadForOffline(current)}
                className={cn('p-2 transition text-muted hover:text-white', downloading && 'animate-pulse text-accent-hi')}
                title="Download for offline"
              >
                <Download size={20} />
              </button>
            ))}
        </div>

        {current.artUrl && <Visualizer bars={56} height={56} className="opacity-70" />}

        {upNext && (
          <button
            onClick={() => player.next()}
            className="glass flex items-center gap-3 rounded-full pl-2 pr-4 py-1.5 text-left hover:bg-white/10 transition"
          >
            <Art src={upNext.artUrl} size="w-8 h-8" rounded="rounded-full" iconSize={13} />
            <span className="text-xs text-muted">
              Up next: <span className="text-white/85">{upNext.title}</span>
            </span>
          </button>
        )}
      </div>
    </div>
  )
}
