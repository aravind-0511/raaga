import { useEffect, useRef } from 'react'
import { engine } from '../lib/player/engine'
import { usePlayer } from '../store/playerStore'

// Frequency-bar visualizer. Uses the engine's AnalyserNode when the active
// element is wired into Web Audio; falls back to a smooth simulated animation
// for CORS-restricted remote streams.
export default function Visualizer({ bars = 48, height = 80, className = '' }) {
  const canvasRef = useRef(null)
  const playing = usePlayer((s) => s.playing)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let raf
    let freq = null
    const sim = new Array(bars).fill(0).map(() => Math.random())

    const render = (t) => {
      raf = requestAnimationFrame(render)
      const dpr = window.devicePixelRatio || 1
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      if (canvas.width !== w * dpr) {
        canvas.width = w * dpr
        canvas.height = h * dpr
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, h)
      const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent-hi').trim() || '#a78bfa'

      const analyser = engine.getAnalyser()
      let values
      if (analyser && playing) {
        if (!freq || freq.length !== analyser.frequencyBinCount) freq = new Uint8Array(analyser.frequencyBinCount)
        analyser.getByteFrequencyData(freq)
        values = []
        const usable = Math.floor(freq.length * 0.75)
        for (let i = 0; i < bars; i++) {
          const idx = Math.floor(Math.pow(i / bars, 1.4) * usable)
          values.push(freq[idx] / 255)
        }
      } else if (playing) {
        // simulated
        values = sim.map((v, i) => {
          const target = 0.25 + 0.6 * Math.abs(Math.sin(t / 400 + i * 0.7)) * (0.5 + 0.5 * Math.sin(t / 950 + i * 1.7))
          sim[i] = v + (target - v) * 0.12
          return sim[i]
        })
      } else {
        values = sim.map((v, i) => {
          sim[i] = v * 0.92
          return sim[i]
        })
      }

      const gap = 2
      const barW = Math.max(1.5, w / bars - gap)
      ctx.fillStyle = accent
      for (let i = 0; i < bars; i++) {
        const x = (i / bars) * w
        const bh = Math.max(2, values[i] * h)
        ctx.globalAlpha = 0.35 + values[i] * 0.65
        ctx.beginPath()
        ctx.roundRect(x, h - bh, barW, bh, 2)
        ctx.fill()
      }
      ctx.globalAlpha = 1
    }
    raf = requestAnimationFrame(render)
    return () => cancelAnimationFrame(raf)
  }, [bars, playing])

  return <canvas ref={canvasRef} className={className} style={{ width: '100%', height }} />
}
