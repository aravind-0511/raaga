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
// actively playing (was killing mobile playback mid-song) — and never do
// it while the page is backgrounded either, since a silent reload behind
// the user's back is indistinguishable from "the app just closed". Only
// reload once both playback is stopped AND the page is the visible/
// foreground tab.
if ('serviceWorker' in navigator) {
  let reloading = false
  let pendingReload = false
  const safeToReload = () => !usePlayer.getState().playing && document.visibilityState === 'visible'
  const reloadNow = () => {
    if (reloading) return
    reloading = true
    window.location.reload()
  }
  const maybeReload = () => {
    if (pendingReload && safeToReload()) reloadNow()
  }
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    pendingReload = true
    maybeReload()
  })
  usePlayer.subscribe(maybeReload)
  document.addEventListener('visibilitychange', maybeReload)
}
registerSW({ immediate: true })
