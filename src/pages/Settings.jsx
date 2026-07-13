import { useState } from 'react'
import { Volume2, Palette, Waves, Globe, MonitorSmartphone, Check, RotateCcw, Sun, Moon } from 'lucide-react'
import { useSettings } from '../store/settingsStore'
import { useSession } from '../store/sessionStore'
import { DEFAULT_CATALOG_URL } from '../lib/catalog/saavn'
import { cn } from '../lib/utils'

const QUALITIES = [
  { id: 'normal', label: 'Normal', hint: '96 kbps · saves data' },
  { id: 'high', label: 'High', hint: '160 kbps · balanced' },
  { id: 'vhigh', label: 'Very High', hint: '320 kbps · best' },
]

const ACCENTS = [
  { id: 'copper', color: '#e0a05c', label: 'Copper' },
  { id: 'terracotta', color: '#c15a3e', label: 'Terracotta' },
  { id: 'violet', color: '#a78bfa', label: 'Electric Violet' },
  { id: 'amber', color: '#fbbf24', label: 'Amber' },
  { id: 'rose', color: '#fb7185', label: 'Rose' },
  { id: 'cyan', color: '#22d3ee', label: 'Cyan' },
]

function Section({ icon: Icon, title, hint, children }) {
  return (
    <div className="glass rounded-2xl p-5 mb-4">
      <p className="flex items-center gap-2 font-semibold text-sm">
        <Icon size={16} className="text-accent-hi" /> {title}
      </p>
      {hint && <p className="text-xs text-muted mt-1 mb-3">{hint}</p>}
      {children}
    </div>
  )
}

export default function Settings() {
  const settings = useSettings()
  const session = useSession.getState()
  const peers = useSession((s) => s.peers)
  const [urlDraft, setUrlDraft] = useState(settings.catalogUrl)
  const isLight = settings.theme === 'light'

  return (
    <div className="fade-up max-w-2xl">
      <h1 className="text-2xl md:text-3xl font-bold tracking-tight mb-6">Settings</h1>

      <Section
        icon={isLight ? Sun : Moon}
        title="Appearance"
        hint={isLight ? 'Sandalwood — warm cream with a red-brown accent.' : 'Espresso — warm brown-black with a copper accent.'}
      >
        <button
          onClick={settings.toggleTheme}
          className="relative w-full flex items-center rounded-2xl border border-line p-1 bg-overlay/4"
        >
          <span
            className="absolute top-1 bottom-1 w-1/2 rounded-xl bg-accent transition-all duration-300"
            style={{ left: isLight ? '50%' : '0.25rem', width: 'calc(50% - 0.25rem)' }}
          />
          <span className={cn('relative z-10 flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors', !isLight ? 'text-white' : 'text-muted')}>
            <Moon size={15} /> Espresso
          </span>
          <span className={cn('relative z-10 flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors', isLight ? 'text-white' : 'text-muted')}>
            <Sun size={15} /> Sandalwood
          </span>
        </button>
      </Section>

      <Section icon={Volume2} title="Audio quality" hint="Applies to catalog streaming. Your own uploaded files always play at original quality.">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {QUALITIES.map((q) => (
            <button
              key={q.id}
              onClick={() => settings.setSetting('quality', q.id)}
              className={cn(
                'rounded-xl p-3 text-left border transition',
                settings.quality === q.id ? 'border-accent-hi bg-accent/15' : 'border-line bg-overlay/4 hover:bg-overlay/8'
              )}
            >
              <p className="text-sm font-medium flex items-center gap-1.5">
                {q.label}
                {settings.quality === q.id && <Check size={13} className="text-accent-hi" />}
              </p>
              <p className="text-[11px] text-muted mt-0.5">{q.hint}</p>
            </button>
          ))}
        </div>
      </Section>

      <Section icon={Waves} title="Crossfade" hint="Blend the end of one track into the next. Set to 0 for gapless playback.">
        <div className="flex items-center gap-3">
          <input
            type="range"
            min="0"
            max="12"
            step="1"
            value={settings.crossfade}
            onChange={(e) => settings.setSetting('crossfade', Number(e.target.value))}
            className="flex-1"
            style={{ '--fill': `${(settings.crossfade / 12) * 100}%` }}
          />
          <span className="text-sm tabular-nums w-14 text-right">
            {settings.crossfade === 0 ? 'Off' : `${settings.crossfade}s`}
          </span>
        </div>
        <label className="flex items-center gap-2.5 mt-4 cursor-pointer">
          <input
            type="checkbox"
            checked={settings.gapless}
            onChange={(e) => settings.setSetting('gapless', e.target.checked)}
            className="accent-[var(--accent)] w-4 h-4"
          />
          <span className="text-sm">Gapless playback (preload the next track)</span>
        </label>
      </Section>

      <Section icon={Palette} title="Accent color" hint="Switching the theme above picks a matching accent automatically — fine-tune it here if you'd like something different.">
        <div className="flex flex-wrap gap-3">
          {ACCENTS.map((a) => (
            <button
              key={a.id}
              title={a.label}
              onClick={() => settings.setSetting('accent', a.id)}
              className={cn(
                'w-10 h-10 rounded-full grid place-items-center transition hover:scale-110',
                settings.accent === a.id && 'ring-2 ring-ink ring-offset-2 ring-offset-bg'
              )}
              style={{ background: a.color }}
            >
              {settings.accent === a.id && <Check size={15} className="text-black" />}
            </button>
          ))}
        </div>
      </Section>

      <Section
        icon={Globe}
        title="Catalog API"
        hint="Raaga uses an unofficial JioSaavn API for the online catalog (Tamil, Hindi & more). Public instances can rate-limit; you can self-host and point this at your own URL."
      >
        <div className="flex gap-2">
          <input
            value={urlDraft}
            onChange={(e) => setUrlDraft(e.target.value)}
            spellCheck={false}
            className="flex-1 rounded-xl bg-overlay/5 border border-line px-3.5 py-2.5 text-sm outline-none focus:border-accent-hi/60 font-mono"
          />
          <button
            onClick={() => settings.setSetting('catalogUrl', urlDraft.trim() || DEFAULT_CATALOG_URL)}
            className="rounded-xl bg-accent hover:bg-accent-hi px-4 text-sm font-medium text-white transition"
          >
            Save
          </button>
          <button
            onClick={() => {
              setUrlDraft(DEFAULT_CATALOG_URL)
              settings.setSetting('catalogUrl', DEFAULT_CATALOG_URL)
            }}
            className="rounded-xl bg-overlay/6 hover:bg-overlay/12 px-3 text-muted hover:text-ink transition"
            title="Reset to default"
          >
            <RotateCcw size={15} />
          </button>
        </div>
      </Section>

      <Section
        icon={MonitorSmartphone}
        title="Devices"
        hint="Every open Raaga tab is a “device”. Use the device icon in the player bar to hand playback off between them."
      >
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2.5 text-sm">
            <span className="w-2 h-2 rounded-full bg-accent-hi" />
            {session.deviceName} <span className="text-[11px] text-muted">(this tab)</span>
          </div>
          {Object.entries(peers).map(([id, p]) => (
            <div key={id} className="flex items-center gap-2.5 text-sm text-muted">
              <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
              {p.name}
              {p.playingTitle && <span className="text-[11px]">· playing “{p.playingTitle}”</span>}
            </div>
          ))}
          {Object.keys(peers).length === 0 && (
            <p className="text-xs text-muted">No other tabs open right now.</p>
          )}
        </div>
      </Section>

      <p className="text-[11px] text-muted mt-6 leading-relaxed">
        Raaga stores everything locally in your browser (IndexedDB) — library, playlists, likes, history, downloads. The catalog
        API is unofficial and best-effort; your uploads and downloads keep working even fully offline.
      </p>
    </div>
  )
}
