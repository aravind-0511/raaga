// Single BroadcastChannel bus powering the multi-tab simulations:
// Connect-style device handoff, group listening sessions, and
// collaborative-playlist presence. Same-origin tabs only (by design —
// this is the local stand-in for a realtime backend).

import { uid } from '../utils'

const DEVICE_NAMES = ['Chrome Tab', 'Desktop', 'Laptop', 'Studio', 'Bedroom', 'Phone']
const COLORS = ['#a78bfa', '#fbbf24', '#fb7185', '#22d3ee', '#34d399', '#f472b6']

export const deviceId = uid('dev_')
export const deviceName = `${DEVICE_NAMES[Math.floor(Math.random() * DEVICE_NAMES.length)]} · ${deviceId.slice(4, 8)}`
export const deviceColor = COLORS[Math.floor(Math.random() * COLORS.length)]

const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('raaga-sync') : null
const handlers = new Set()

channel?.addEventListener('message', (e) => {
  const msg = e.data
  if (!msg || msg.from === deviceId) return
  handlers.forEach((h) => h(msg))
})

export function send(type, payload = {}) {
  channel?.postMessage({ type, from: deviceId, fromName: deviceName, fromColor: deviceColor, ts: Date.now(), ...payload })
}

export function onMessage(handler) {
  handlers.add(handler)
  return () => handlers.delete(handler)
}

// module-level singletons: never hot-swap, always full-reload
if (import.meta.hot) import.meta.hot.decline()
