// Singleton playback engine, deliberately outside React.
//
// Core: two hidden <video> elements (slots A/B). A <video> element plays any
// audio OR video container the browser supports and is never rendered, so any
// media file in -> audio alone out. Two slots enable crossfade and gapless.
//
// Web Audio: each slot's "wired" element is routed
//   MediaElementSource -> AnalyserNode -> destination
// and always loads with crossOrigin="anonymous" (safe for blob: URLs and
// CORS-enabled CDNs). If a remote URL fails the CORS load, the slot falls
// back to a plain un-wired element (playback works, analyser unavailable) —
// a wired element must never play a non-CORS source or the graph goes silent.

const FADE_TICK_MS = 50

function makeVideoEl(cors) {
  const el = document.createElement('video')
  el.preload = 'auto'
  el.style.display = 'none'
  el.playsInline = true
  if (cors) el.crossOrigin = 'anonymous'
  document.body.appendChild(el)
  return el
}

class Slot {
  constructor(engine, name) {
    this.engine = engine
    this.name = name
    this.wiredEl = makeVideoEl(true)
    this.plainEl = null
    this.el = this.wiredEl // element currently in use
    this.source = null
    this.analyser = null
    this.loadedUrl = null
    this.fadeTimer = null
    this.fadeFactor = 1
  }

  ensureGraph() {
    const ctx = this.engine.ensureCtx()
    if (!this.source && ctx) {
      this.source = ctx.createMediaElementSource(this.wiredEl)
      this.bassFilter = ctx.createBiquadFilter()
      this.bassFilter.type = 'lowshelf'
      this.bassFilter.frequency.value = 200
      this.bassFilter.gain.value = this.engine.bassDb
      this.vocalFilter = ctx.createBiquadFilter()
      this.vocalFilter.type = 'peaking'
      this.vocalFilter.frequency.value = 2200
      this.vocalFilter.Q.value = 1
      this.vocalFilter.gain.value = this.engine.vocalDb
      this.analyser = ctx.createAnalyser()
      this.analyser.fftSize = 256
      this.analyser.smoothingTimeConstant = 0.82
      this.source.connect(this.bassFilter)
      this.bassFilter.connect(this.vocalFilter)
      this.vocalFilter.connect(this.analyser)
      this.analyser.connect(ctx.destination)
    }
  }

  get wired() {
    return this.el === this.wiredEl
  }

  applyVolume() {
    this.el.volume = Math.min(1, Math.max(0, this.engine.volume * this.fadeFactor))
  }

  setFade(f) {
    this.fadeFactor = f
    this.applyVolume()
  }

  stopFade() {
    if (this.fadeTimer) {
      clearInterval(this.fadeTimer)
      this.fadeTimer = null
    }
  }

  fadeTo(target, seconds, onDone) {
    this.stopFade()
    if (seconds <= 0) {
      this.setFade(target)
      onDone?.()
      return
    }
    const start = this.fadeFactor
    const t0 = performance.now()
    this.fadeTimer = setInterval(() => {
      const p = Math.min(1, (performance.now() - t0) / (seconds * 1000))
      this.setFade(start + (target - start) * p)
      if (p >= 1) {
        this.stopFade()
        onDone?.()
      }
    }, FADE_TICK_MS)
  }

  // Load url into this slot. Tries the wired element first; on failure with a
  // remote URL, retries on a plain element (CORS-blocked CDN).
  load(url, { allowFallback = true } = {}) {
    this.stopFade()
    this.loadedUrl = url
    return new Promise((resolve, reject) => {
      const tryEl = (el, fallbackNext) => {
        this.el = el
        const cleanup = () => {
          el.removeEventListener('canplay', ok)
          el.removeEventListener('error', bad)
        }
        const ok = () => {
          cleanup()
          if (this.loadedUrl !== url) return reject(new Error('superseded'))
          resolve()
        }
        const bad = () => {
          cleanup()
          if (this.loadedUrl !== url) return reject(new Error('superseded'))
          if (fallbackNext) fallbackNext()
          else reject(new Error('media load failed'))
        }
        el.addEventListener('canplay', ok)
        el.addEventListener('error', bad)
        el.src = url
        el.load()
      }
      const isRemote = /^https?:/.test(url)
      const fallback =
        allowFallback && isRemote
          ? () => {
              this.wiredEl.removeAttribute('src')
              if (!this.plainEl) this.plainEl = makeVideoEl(false)
              tryEl(this.plainEl, null)
            }
          : null
      // pause whichever element was last active in this slot
      this.wiredEl.pause()
      this.plainEl?.pause()
      this.plainEl?.removeAttribute('src')
      tryEl(this.wiredEl, fallback)
    })
  }

  async play() {
    if (this.wired) {
      this.ensureGraph()
      await this.engine.ctx?.resume().catch(() => {})
    }
    this.applyVolume()
    return this.el.play()
  }

  pause() {
    this.el.pause()
  }

  clear() {
    this.stopFade()
    this.wiredEl.pause()
    this.plainEl?.pause()
    this.loadedUrl = null
  }
}

class PlayerEngine {
  constructor() {
    this.listeners = new Map()
    this.ctx = null
    this.volume = 1
    this.bassDb = 0
    this.vocalDb = 0
    this.slots = [new Slot(this, 'A'), new Slot(this, 'B')]
    this.activeIndex = 0
    this.preloadedUrl = null
    this._raf = null
    this._attachElementEvents()
  }

  ensureCtx() {
    if (!this.ctx) {
      try {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)()
      } catch {
        this.ctx = null
      }
    }
    return this.ctx
  }

  get active() {
    return this.slots[this.activeIndex]
  }
  get idle() {
    return this.slots[1 - this.activeIndex]
  }

  on(event, fn) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set())
    this.listeners.get(event).add(fn)
    return () => this.listeners.get(event).delete(fn)
  }
  emit(event, payload) {
    this.listeners.get(event)?.forEach((fn) => fn(payload))
  }

  _attachElementEvents() {
    for (const slot of this.slots) {
      const forward = (el) => {
        el.addEventListener('timeupdate', () => {
          if (slot !== this.active || el !== slot.el) return
          this.emit('time', { position: el.currentTime, duration: el.duration || 0 })
        })
        el.addEventListener('ended', () => {
          if (slot !== this.active || el !== slot.el) return
          this.emit('ended')
        })
        el.addEventListener('play', () => {
          if (slot === this.active && el === slot.el) this.emit('state', { playing: true })
        })
        el.addEventListener('pause', () => {
          if (slot === this.active && el === slot.el) this.emit('state', { playing: false })
        })
        el.addEventListener('durationchange', () => {
          if (slot === this.active && el === slot.el)
            this.emit('time', { position: el.currentTime, duration: el.duration || 0 })
        })
      }
      forward(slot.wiredEl)
      // plain elements are created lazily; patch events on creation
      const origLoad = slot.load.bind(slot)
      slot.load = async (url, opts) => {
        const hadPlain = !!slot.plainEl
        const result = await origLoad(url, opts)
        if (!hadPlain && slot.plainEl) forward(slot.plainEl)
        return result
      }
    }
  }

  // Play a URL. If it was preloaded into the idle slot, swap instantly
  // (gapless); with fadeSeconds > 0, crossfade from the current slot.
  async playUrl(url, { fadeSeconds = 0 } = {}) {
    const old = this.active
    const next = this.idle
    const wasPlaying = !old.el.paused && old.loadedUrl

    if (this.preloadedUrl !== url) {
      await next.load(url)
    }
    this.preloadedUrl = null
    this.activeIndex = 1 - this.activeIndex

    if (wasPlaying && fadeSeconds > 0) {
      next.setFade(0)
      await next.play()
      next.fadeTo(1, fadeSeconds)
      old.fadeTo(0, fadeSeconds, () => {
        old.clear()
        old.setFade(1)
      })
    } else {
      old.clear()
      old.setFade(1)
      next.setFade(1)
      await next.play()
    }
    this.emit('time', { position: next.el.currentTime, duration: next.el.duration || 0 })
  }

  async preloadUrl(url) {
    if (this.preloadedUrl === url || this.active.loadedUrl === url) return
    try {
      await this.idle.load(url)
      this.preloadedUrl = url
    } catch {
      this.preloadedUrl = null
    }
  }

  // Load a url into the active slot WITHOUT playing (autoplay is blocked on
  // page load) — used to restore a saved session paused at its position.
  async loadPaused(url) {
    const old = this.active
    const next = this.idle
    await next.load(url)
    old.clear()
    old.setFade(1)
    this.activeIndex = 1 - this.activeIndex
    this.active.setFade(1)
    this.preloadedUrl = null
    this.emit('time', { position: this.active.el.currentTime, duration: this.active.el.duration || 0 })
  }

  pause() {
    this.active.pause()
  }
  async resume() {
    await this.active.play().catch(() => {})
  }
  get playing() {
    return !this.active.el.paused
  }
  get hasLoaded() {
    return !!this.active.loadedUrl
  }
  get position() {
    return this.active.el.currentTime
  }
  get duration() {
    return this.active.el.duration || 0
  }
  seek(seconds) {
    const el = this.active.el
    if (Number.isFinite(el.duration)) el.currentTime = Math.min(Math.max(0, seconds), el.duration)
    else el.currentTime = Math.max(0, seconds)
  }
  setVolume(v) {
    this.volume = Math.min(1, Math.max(0, v))
    this.slots.forEach((s) => s.applyVolume())
  }
  // Per-track bass/vocal EQ, in dB. Stored on the engine so a value set on
  // one slot carries over when crossfade swaps the active slot.
  setBass(db) {
    this.bassDb = db
    this.slots.forEach((s) => {
      if (s.bassFilter) s.bassFilter.gain.value = db
    })
  }
  setVocal(db) {
    this.vocalDb = db
    this.slots.forEach((s) => {
      if (s.vocalFilter) s.vocalFilter.gain.value = db
    })
  }
  stop() {
    this.slots.forEach((s) => s.clear())
    this.preloadedUrl = null
    this.emit('state', { playing: false })
  }

  // Analyser of the active slot, if its element is wired (null => simulate).
  getAnalyser() {
    const slot = this.active
    return slot.wired && slot.analyser ? slot.analyser : null
  }
}

export const engine = new PlayerEngine()

if (import.meta.env.DEV) window.__raagaEngine = engine

// module-level singletons: never hot-swap, always full-reload
if (import.meta.hot) import.meta.hot.decline()
