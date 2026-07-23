import { Sliders } from 'lucide-react'
import { useLibrary } from '../store/libraryStore'
import { engine } from '../lib/player/engine'

function EQSlider({ label, value, onChange, onReset }) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-muted">{label}</span>
        <span className="text-ink/70 tabular-nums">{value > 0 ? `+${value}` : value} dB</span>
      </div>
      <input
        type="range"
        min={-12}
        max={12}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        onDoubleClick={onReset}
        className="w-full"
        style={{ '--fill': `${((value + 12) / 24) * 100}%` }}
      />
    </div>
  )
}

// Per-track bass/vocal EQ, wired to the library store so values persist and
// recall next time the track plays. Disabled when the current slot has no
// Web Audio graph (CORS-blocked remote stream) since filters have no effect.
export default function SoundControls({ track }) {
  const lib = useLibrary.getState()
  const available = !!engine.getAnalyser()
  const bass = track?.bassGain ?? 0
  const vocal = track?.vocalGain ?? 0

  return (
    <div className="glass rounded-2xl p-4 w-full flex flex-col gap-3">
      <div className="flex items-center gap-2 text-xs text-muted">
        <Sliders size={14} />
        Sound
        {!available && <span className="ml-auto text-[10px] text-muted/70">Unavailable for this stream</span>}
      </div>
      <div className={available ? '' : 'opacity-40 pointer-events-none'}>
        <div className="grid grid-cols-1 gap-3">
          <EQSlider
            label="Bass"
            value={bass}
            onChange={(v) => lib.setTrackEQ(track, { bass: v })}
            onReset={() => lib.setTrackEQ(track, { bass: 0 })}
          />
          <EQSlider
            label="Vocal"
            value={vocal}
            onChange={(v) => lib.setTrackEQ(track, { vocal: v })}
            onReset={() => lib.setTrackEQ(track, { vocal: 0 })}
          />
        </div>
      </div>
    </div>
  )
}
