import { create } from 'zustand'
import { getAllSettings, putSetting } from '../lib/repo'
import { setCatalogBase, DEFAULT_CATALOG_URL } from '../lib/catalog/saavn'
import { engine } from '../lib/player/engine'

const DEFAULTS = {
  quality: 'high', // normal | high | vhigh
  crossfade: 0, // seconds, 0-12
  accent: 'violet', // violet | amber | rose | cyan
  catalogUrl: DEFAULT_CATALOG_URL,
  volume: 1,
  gapless: true,
}

function applySideEffects(state) {
  document.documentElement.dataset.accent = state.accent
  setCatalogBase(state.catalogUrl)
  engine.setVolume(state.volume)
}

export const useSettings = create((set, get) => ({
  ...DEFAULTS,
  ready: false,

  init: async () => {
    const saved = await getAllSettings()
    const state = { ...DEFAULTS, ...saved }
    applySideEffects(state)
    set({ ...state, ready: true })
  },

  setSetting: (key, value) => {
    set({ [key]: value })
    applySideEffects(get())
    putSetting(key, value)
  },
}))

// module-level singletons: never hot-swap, always full-reload
if (import.meta.hot) import.meta.hot.decline()
