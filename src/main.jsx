import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import { registerSW } from 'virtual:pwa-register'
import App from './App'
import { usePlayer } from './store/playerStore'
import './index.css'

// HashRouter so deep links + refresh work on any static host (GitHub Pages,
// file://, etc.) without server-side rewrite rules.
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>
)

// Auto-apply new versions: when an updated service worker takes control,
// reload once so the device never gets stuck on a stale cached build. A
// reload tears down the audio element, so never do it while a track is
// actively playing — that's exactly what was killing mobile playback
// mid-song. Defer until playback is paused/stopped instead.
if ('serviceWorker' in navigator) {
  let reloading = false
  let pendingReload = false
  const reloadNow = () => {
    if (reloading) return
    reloading = true
    window.location.reload()
  }
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (usePlayer.getState().playing) pendingReload = true
    else reloadNow()
  })
  usePlayer.subscribe((state, prev) => {
    if (pendingReload && prev.playing && !state.playing) reloadNow()
  })
}
registerSW({ immediate: true })
