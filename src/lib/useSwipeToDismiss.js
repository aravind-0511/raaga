import { useCallback, useRef, useState } from 'react'

// Drag-down-to-dismiss for bottom sheets / the Now Playing overlay. Spread
// `handlers` onto a small grab-handle/header area (not the scrollable body —
// that would fight the browser's native scroll gesture), and `style` onto the
// sheet's outer element. Follows the finger 1:1 while dragging; snaps back if
// released short of the threshold, otherwise animates off-screen and fires
// `onDismiss` once the exit transition finishes.
export function useSwipeToDismiss(onDismiss, { threshold = 90 } = {}) {
  const startY = useRef(0)
  const active = useRef(false)
  const [dragY, setDragY] = useState(0)
  const [dragging, setDragging] = useState(false)

  const onPointerDown = useCallback((e) => {
    // Header rows spread these handlers over buttons (close/X, chevron, ...)
    // too. Capturing the pointer here would retarget the matching pointerup
    // (and the click it synthesizes) away from that button to this wrapper,
    // silently swallowing the click — so skip starting a drag from one.
    if (e.target.closest('button, a, input, textarea, select')) return
    startY.current = e.clientY
    active.current = true
    setDragging(true)
    // Without capture, pointermove stops reaching this element the instant
    // the finger drags outside its (small) bounds — capture keeps the whole
    // gesture routed here regardless of where the pointer physically is.
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }, [])

  const onPointerMove = useCallback((e) => {
    if (!active.current) return
    setDragY(Math.max(0, e.clientY - startY.current)) // downward only
  }, [])

  const finish = useCallback(() => {
    if (!active.current) return
    active.current = false
    setDragging(false)
    setDragY((y) => {
      if (y > threshold) {
        setTimeout(onDismiss, 200)
        return typeof window !== 'undefined' ? window.innerHeight : 800
      }
      return 0
    })
  }, [threshold, onDismiss])

  const style = {
    transform: dragY ? `translateY(${dragY}px)` : undefined,
    transition: dragging ? 'none' : 'transform 0.2s cubic-bezier(0.22, 0.8, 0.36, 1)',
  }

  // For sheets that stay mounted and toggle visibility (rather than unmount
  // on dismiss) — call before showing again, so it doesn't reappear already
  // translated off-screen from the last swipe.
  const reset = useCallback(() => setDragY(0), [])

  return {
    handlers: { onPointerDown, onPointerMove, onPointerUp: finish, onPointerCancel: finish },
    style,
    dragging,
    reset,
  }
}
