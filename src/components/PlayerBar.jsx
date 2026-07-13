import { Play, Pause, SkipBack, SkipForward, Shuffle, Repeat, Repeat1, Heart, ListMusic, Volume2, VolumeX, MonitorSmartphone, ChevronUp, Users, X } from 'lucide-react'
import { usePlayer } from '../store/playerStore'
import { useLibrary } from '../store/libraryStore'
import { useSettings } from '../store/settingsStore'
import { useSession } from '../store/sessionStore'
import { Art, Menu, MenuItem } from './ui'
import WaveformSeekBar from './WaveformSeekBar'
import { cn, formatTime } from '../lib/utils'

export default function PlayerBar() {
  const { current, playing, position, duration, shuffle, repeat, peaks, queueOpen, loadError } = usePlayer()
  const player = usePlayer.getState()
  const liked = useLibrary((s) => (current ? !!s.likes[current.id] : false))
  const volume = useSettings((s) => s.volume)
  const setSetting = useSettings((s) => s.setSetting)
  const peers = useSession((s) => s.peers)
  const group = useSession((s) => s.group)
  const session = useSession.getState()
  const peerList = Object.entries(peers)

  if (!current) {
    return loadError ? (
      <div className="fixed bottom-16 md:bottom-4 inset-x-4 z-40 text-center">
        <span className="glass inline-block px-4 py-2 rounded-full text-sm text-rose-300">{loadError}</span>
      </div>
    ) : null
  }

  const RepeatIcon = repeat === 'one' ? Repeat1 : Repeat

  return (
    <div className="glass border-t border-line px-3 md:px-5 py-2.5 z-30 relative">
      {loadError && (
        <div className="absolute -top-10 inset-x-0 text-center">
          <span className="glass inline-block px-4 py-1.5 rounded-full text-xs text-rose-300">{loadError}</span>
        </div>
      )}
      <div className="flex items-center gap-3 md:gap-6">
        {/* track info */}
        <div
          className="flex items-center gap-3 min-w-0 md:w-64 flex-1 md:flex-none cursor-pointer"
          onClick={() => player.setNowPlayingOpen(true)}
        >
          <div className="relative">
            <Art src={current.artUrl} size="w-11 h-11" />
            <span className="md:hidden absolute inset-0 grid place-items-center rounded-lg bg-black/30">
              <ChevronUp size={16} />
            </span>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium line-clamp-1">{current.title}</p>
            <p className="text-xs text-muted line-clamp-1">{current.artist}</p>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation()
              useLibrary.getState().toggleLike(current)
            }}
            className={cn('hidden md:block p-1.5 transition', liked ? 'text-accent-hi' : 'text-muted hover:text-white')}
          >
            <Heart size={16} fill={liked ? 'currentColor' : 'none'} />
          </button>
        </div>

        {/* center controls + seek (desktop) */}
        <div className="hidden md:flex flex-col flex-1 min-w-0 items-center gap-0.5">
          <div className="flex items-center gap-4">
            <button
              onClick={player.toggleShuffle}
              className={cn('p-1.5 transition', shuffle ? 'text-accent-hi' : 'text-muted hover:text-white')}
              title="Shuffle"
            >
              <Shuffle size={16} />
            </button>
            <button onClick={player.prev} className="p-1.5 text-white/80 hover:text-white transition" title="Previous">
              <SkipBack size={18} fill="currentColor" />
            </button>
            <button
              onClick={player.toggle}
              className="w-9 h-9 rounded-full bg-white text-black grid place-items-center hover:scale-105 transition"
            >
              {playing ? <Pause size={17} fill="currentColor" /> : <Play size={17} fill="currentColor" className="ml-0.5" />}
            </button>
            <button onClick={() => player.next()} className="p-1.5 text-white/80 hover:text-white transition" title="Next">
              <SkipForward size={18} fill="currentColor" />
            </button>
            <button
              onClick={player.cycleRepeat}
              className={cn('p-1.5 transition', repeat !== 'off' ? 'text-accent-hi' : 'text-muted hover:text-white')}
              title={`Repeat: ${repeat}`}
            >
              <RepeatIcon size={16} />
            </button>
          </div>
          <div className="flex items-center gap-2 w-full max-w-xl">
            <span className="text-[11px] text-muted tabular-nums w-9 text-right">{formatTime(position)}</span>
            <div className="flex-1">
              <WaveformSeekBar peaks={peaks} position={position} duration={duration} onSeek={player.seek} height={30} />
            </div>
            <span className="text-[11px] text-muted tabular-nums w-9">{formatTime(duration)}</span>
          </div>
        </div>

        {/* mobile play/next/close */}
        <div className="flex md:hidden items-center gap-1">
          <button onClick={player.toggle} className="w-10 h-10 rounded-full bg-white text-black grid place-items-center">
            {playing ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-0.5" />}
          </button>
          <button onClick={() => player.next()} className="p-2 text-white/80">
            <SkipForward size={20} fill="currentColor" />
          </button>
          <button onClick={player.close} className="p-2 text-muted hover:text-white transition" title="Close">
            <X size={19} />
          </button>
        </div>

        {/* right controls (desktop) */}
        <div className="hidden md:flex items-center gap-1.5 w-64 justify-end">
          <Menu
            align="right"
            button={
              <button
                className={cn('p-2 rounded-full transition relative', peerList.length ? 'text-accent-hi' : 'text-muted hover:text-white')}
                title="Connect to a device"
              >
                <MonitorSmartphone size={17} />
                {peerList.length > 0 && (
                  <span className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-accent-hi" />
                )}
              </button>
            }
          >
            <div className="px-3.5 py-2 text-xs text-muted">
              This device: <span className="text-white/80">{session.deviceName}</span>
            </div>
            {peerList.length === 0 && (
              <div className="px-3.5 py-2 text-xs text-muted">Open Raaga in another tab to see devices here.</div>
            )}
            {peerList.map(([id, p]) => (
              <MenuItem key={id} icon={MonitorSmartphone} onClick={() => session.handoffTo(id)}>
                Play on {p.name}
              </MenuItem>
            ))}
          </Menu>
          <button
            onClick={() => (group ? session.leaveGroup() : session.startGroup())}
            className={cn('p-2 rounded-full transition', group ? 'text-accent-hi' : 'text-muted hover:text-white')}
            title={group ? 'Leave group session' : 'Start group session'}
          >
            <Users size={17} />
          </button>
          <button
            onClick={() => player.setQueueOpen(!queueOpen)}
            className={cn('p-2 rounded-full transition', queueOpen ? 'text-accent-hi' : 'text-muted hover:text-white')}
            title="Queue"
          >
            <ListMusic size={17} />
          </button>
          <button
            onClick={() => setSetting('volume', volume === 0 ? 1 : 0)}
            className="p-2 text-muted hover:text-white transition"
          >
            {volume === 0 ? <VolumeX size={17} /> : <Volume2 size={17} />}
          </button>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={volume}
            onChange={(e) => setSetting('volume', Number(e.target.value))}
            className="w-24"
            style={{ '--fill': `${volume * 100}%` }}
          />
          <button
            onClick={player.close}
            className="p-2 rounded-full text-muted hover:text-white transition"
            title="Close song"
          >
            <X size={17} />
          </button>
        </div>
      </div>
      {/* mobile progress hairline */}
      <div className="md:hidden absolute top-0 left-0 right-0 h-0.5 bg-white/10">
        <div className="h-full bg-accent-hi" style={{ width: `${duration ? (position / duration) * 100 : 0}%` }} />
      </div>
    </div>
  )
}
