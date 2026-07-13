import { useEffect, useRef, useState, useCallback } from 'react'
import { PEAK_COUNT } from '../lib/player/waveform'

// Canvas fillStyle can't resolve CSS custom properties directly, so read the
// theme's solid hex tokens and build rgba() strings from them at draw-time —
// keeps the waveform theme-aware without hardcoding a color for either mode.
function hexToRgb(hex, fallback) {
  const m = hex.trim().match(/^#?([0-9a-f]{6})$/i)
  if (!m) return fallback
  const n = parseInt(m[1], 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

// Waveform seek bar: renders real precomputed peaks when available,
// otherwise a flat rounded bar. Click/drag to scrub.
export default function WaveformSeekBar({ peaks, position, duration, onSeek, height = 36 }) {
  const canvasRef = useRef(null)
  const wrapRef = useRef(null)
  const [hoverX, setHoverX] = useState(null)
  const dragging = useRef(false)

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    const w = canvas.clientWidth
    const h = canvas.clientHeight
    if (canvas.width !== w * dpr) {
      canvas.width = w * dpr
      canvas.height = h * dpr
    }
    const ctx = canvas.getContext('2d')
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)
    const progress = duration > 0 ? position / duration : 0
    const styles = getComputedStyle(document.documentElement)
    const accent = styles.getPropertyValue('--accent-hi').trim() || '#a78bfa'
    const [or_, og, ob] = hexToRgb(styles.getPropertyValue('--color-overlay'), [255, 255, 255])
    const [ir, ig, ib] = hexToRgb(styles.getPropertyValue('--color-ink'), [255, 255, 255])
    const overlay = (a) => `rgba(${or_},${og},${ob},${a})`
    const ink = (a) => `rgba(${ir},${ig},${ib},${a})`

    if (peaks && peaks.length) {
      const n = Math.min(peaks.length, PEAK_COUNT)
      const gap = 1
      const barW = Math.max(1.5, w / n - gap)
      for (let i = 0; i < n; i++) {
        const x = (i / n) * w
        const amp = Math.max(0.08, peaks[i])
        const bh = amp * (h - 4)
        const played = i / n <= progress
        ctx.fillStyle = played ? accent : overlay(0.22)
        ctx.beginPath()
        ctx.roundRect(x, (h - bh) / 2, barW, bh, 1.5)
        ctx.fill()
      }
    } else {
      const y = h / 2 - 2
      ctx.fillStyle = overlay(0.18)
      ctx.beginPath()
      ctx.roundRect(0, y, w, 4, 2)
      ctx.fill()
      ctx.fillStyle = accent
      ctx.beginPath()
      ctx.roundRect(0, y, Math.max(4, w * progress), 4, 2)
      ctx.fill()
      // playhead dot
      ctx.fillStyle = ink(1)
      ctx.beginPath()
      ctx.arc(Math.max(4, w * progress), h / 2, dragging.current || hoverX !== null ? 5 : 0, 0, Math.PI * 2)
      ctx.fill()
    }

    if (hoverX !== null) {
      ctx.fillStyle = ink(0.35)
      ctx.fillRect(hoverX, 0, 1, h)
    }
  }, [peaks, position, duration, hoverX])

  useEffect(() => {
    draw()
  }, [draw])

  useEffect(() => {
    const obs = new ResizeObserver(draw)
    if (wrapRef.current) obs.observe(wrapRef.current)
    return () => obs.disconnect()
  }, [draw])

  const seekFromEvent = (e) => {
    const rect = wrapRef.current.getBoundingClientRect()
    const x = Math.min(Math.max(0, e.clientX - rect.left), rect.width)
    if (duration > 0) onSeek((x / rect.width) * duration)
  }

  return (
    <div
      ref={wrapRef}
      className="w-full cursor-pointer touch-none"
      style={{ height }}
      onPointerDown={(e) => {
        dragging.current = true
        e.currentTarget.setPointerCapture(e.pointerId)
        seekFromEvent(e)
      }}
      onPointerMove={(e) => {
        const rect = wrapRef.current.getBoundingClientRect()
        setHoverX(Math.min(Math.max(0, e.clientX - rect.left), rect.width))
        if (dragging.current) seekFromEvent(e)
      }}
      onPointerUp={() => (dragging.current = false)}
      onPointerLeave={() => {
        setHoverX(null)
        dragging.current = false
      }}
    >
      <canvas ref={canvasRef} className="w-full h-full block" />
    </div>
  )
}
