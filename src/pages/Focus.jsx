import { useEffect, useRef, useState } from 'react'
import { Play, Pause, SkipForward, RotateCcw, Coffee, Brain } from 'lucide-react'
import { usePlayer } from '../store/playerStore'
import { Art } from '../components/ui'
import Visualizer from '../components/Visualizer'
import WaveformSeekBar from '../components/WaveformSeekBar'
import { cn, formatTime } from '../lib/utils'

const MODES = {
  focus: { label: 'Focus', minutes: 25, icon: Brain },
  break: { label: 'Break', minutes: 5, icon: Coffee },
}

export default function Focus() {
  const { current, playing, position, duration, peaks } = usePlayer()
  const player = usePlayer.getState()

  const [mode, setMode] = useState('focus')
  const [secondsLeft, setSecondsLeft] = useState(MODES.focus.minutes * 60)
  const [running, setRunning] = useState(false)
  const [rounds, setRounds] = useState(0)
  const tick = useRef(null)

  useEffect(() => {
    if (!running) return
    tick.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s > 1) return s - 1
        // session complete: swap mode, pause on break, resume on focus
        const nextMode = mode === 'focus' ? 'break' : 'focus'
        if (mode === 'focus') {
          setRounds((r) => r + 1)
          if (usePlayer.getState().playing) player.toggle()
        } else if (!usePlayer.getState().playing && usePlayer.getState().current) {
          player.toggle()
        }
        setMode(nextMode)
        return MODES[nextMode].minutes * 60
      })
    }, 1000)
    return () => clearInterval(tick.current)
  }, [running, mode])

  const total = MODES[mode].minutes * 60
  const pct = 1 - secondsLeft / total
  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, '0')
  const ss = String(secondsLeft % 60).padStart(2, '0')
  const R = 110
  const C = 2 * Math.PI * R

  return (
    <div className="fade-up flex flex-col items-center max-w-2xl mx-auto pt-4 md:pt-10">
      <div className="flex gap-2 mb-8">
        {Object.entries(MODES).map(([key, m]) => (
          <button
            key={key}
            onClick={() => {
              setMode(key)
              setSecondsLeft(m.minutes * 60)
              setRunning(false)
            }}
            className={cn(
              'flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium transition',
              mode === key ? 'bg-white text-black' : 'bg-white/6 text-muted hover:text-white'
            )}
          >
            <m.icon size={14} />
            {m.label}
          </button>
        ))}
        <span className="flex items-center px-3 text-xs text-muted">{rounds} rounds done</span>
      </div>

      <div className="relative w-72 h-72 grid place-items-center">
        <svg className="absolute inset-0 -rotate-90" viewBox="0 0 240 240">
          <circle cx="120" cy="120" r={R} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="6" />
          <circle
            cx="120" cy="120" r={R} fill="none"
            stroke="var(--accent-hi)" strokeWidth="6" strokeLinecap="round"
            strokeDasharray={C} strokeDashoffset={C * (1 - pct)}
            className="transition-all duration-1000"
          />
        </svg>
        <div className="text-center">
          <p className="text-6xl font-bold tabular-nums tracking-tight">{mm}:{ss}</p>
          <p className="text-xs uppercase tracking-widest text-muted mt-2">{MODES[mode].label}</p>
        </div>
      </div>

      <div className="flex items-center gap-3 mt-8">
        <button
          onClick={() => setRunning(!running)}
          className="flex items-center gap-2 bg-accent hover:bg-accent-hi rounded-full px-7 py-2.5 font-medium transition"
        >
          {running ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
          {running ? 'Pause' : 'Start'}
        </button>
        <button
          onClick={() => {
            setSecondsLeft(total)
            setRunning(false)
          }}
          className="p-3 rounded-full bg-white/6 hover:bg-white/12 text-muted hover:text-white transition"
          title="Reset"
        >
          <RotateCcw size={16} />
        </button>
      </div>

      {current ? (
        <div className="glass rounded-2xl p-4 mt-10 w-full max-w-md">
          <div className="flex items-center gap-3">
            <Art src={current.artUrl} size="w-12 h-12" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium line-clamp-1">{current.title}</p>
              <p className="text-xs text-muted line-clamp-1">{current.artist}</p>
            </div>
            <button onClick={player.toggle} className="w-10 h-10 rounded-full bg-white text-black grid place-items-center hover:scale-105 transition">
              {playing ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" className="ml-0.5" />}
            </button>
            <button onClick={() => player.next()} className="p-2 text-muted hover:text-white transition">
              <SkipForward size={18} fill="currentColor" />
            </button>
          </div>
          <div className="mt-2">
            <WaveformSeekBar peaks={peaks} position={position} duration={duration} onSeek={player.seek} height={26} />
            <div className="flex justify-between text-[10px] text-muted tabular-nums">
              <span>{formatTime(position)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>
          <Visualizer bars={40} height={30} className="mt-1 opacity-60" />
        </div>
      ) : (
        <p className="text-sm text-muted mt-10">Play something first — lo-fi or instrumental works great for focus.</p>
      )}
    </div>
  )
}
