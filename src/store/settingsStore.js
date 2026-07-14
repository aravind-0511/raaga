import { create } from 'zustand'
import { getAllSettings, putSetting } from '../lib/repo'
import { setCatalogBase, DEFAULT_CATALOG_URL } from '../lib/catalog/saavn'
import { engine } from '../lib/player/engine'

// Each theme mode has a signature accent, applied automatically when the
// mode is toggled (still overridable afterward from the accent swatches).
const THEME_ACCENT = { dark: 'copper', light: 'terracotta' }

const DEFAULTS = {
  theme: 'dark', // dark (Onyx) | light (Sandalwood)
  quality: 'high', // normal | high | vhigh
  crossfade: 0, // seconds, 0-12
  accent: 'copper', // copper | terracotta | violet | amber | rose | cyan
  catalogUrl: DEFAULT_CATALOG_URL,
  volume: 1,
  gapless: true,
  sidebarCollapsed: false,
}

function applySideEffects(state) {
  document.documentElement.dataset.accent = state.accent
  document.documentElement.dataset.theme = state.theme
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

  // Flip theme mode and pair it with that theme's signature accent.
  toggleTheme: () => {
    const nextTheme = get().theme === 'dark' ? 'light' : 'dark'
    const nextAccent = THEME_ACCENT[nextTheme]
    set({ theme: nextTheme, accent: nextAccent })
    applySideEffects(get())
    putSetting('theme', nextTheme)
    putSetting('accent', nextAccent)
  },

  toggleSidebar: () => {
    const next = !get().sidebarCollapsed
    set({ sidebarCollapsed: next })
    putSetting('sidebarCollapsed', next)
  },
}))

// module-level singletons: never hot-swap, always full-reload
if (import.meta.hot) import.meta.hot.decline()
