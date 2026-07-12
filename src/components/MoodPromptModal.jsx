import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sparkles, Loader2 } from 'lucide-react'
import { Modal } from './ui'
import { moodPlan, matchLocalTracks } from '../lib/mood'
import { searchSongs } from '../lib/catalog/saavn'
import { useLibrary } from '../store/libraryStore'
import { shuffleArray } from '../lib/utils'

const SUGGESTIONS = ['rainy afternoon coding session', 'sunday morning filter coffee', 'gym beast mode', 'late night long drive', 'wedding kuthu party']

export default function MoodPromptModal({ open, onClose }) {
  const [prompt, setPrompt] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const navigate = useNavigate()

  const build = async () => {
    if (!prompt.trim() || busy) return
    setBusy(true)
    setError(null)
    try {
      const lib = useLibrary.getState()
      const plan = moodPlan(prompt)
      const local = matchLocalTracks(lib.tracks, plan, prompt)

      let remote = []
      const results = await Promise.allSettled(plan.terms.map((t) => searchSongs(t, { limit: 10 })))
      for (const r of results) if (r.status === 'fulfilled') remote.push(...r.value)

      const seen = new Set()
      const combined = [...local, ...shuffleArray(remote)].filter((t) => {
        if (seen.has(t.id)) return false
        seen.add(t.id)
        return true
      }).slice(0, 25)

      if (!combined.length) {
        setError('Nothing matched that vibe — try different words, or add some music to your library first.')
        return
      }
      for (const t of combined) await lib.saveRemoteTrack(t)
      const pl = await lib.createPlaylist({
        name: prompt.trim().slice(0, 40),
        description: `Mood playlist · “${prompt.trim()}”`,
        trackIds: combined.map((t) => t.id),
      })
      setPrompt('')
      onClose()
      navigate(`/playlist/${pl.id}`)
    } catch {
      setError('Could not reach the catalog — check your connection or catalog URL in Settings.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Describe a vibe">
      <p className="text-sm text-muted mb-3">
        Tell Raaga the mood and it assembles a playlist from your library plus the online catalog.
      </p>
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), build())}
        rows={2}
        placeholder="rainy afternoon coding session…"
        className="w-full rounded-xl bg-white/5 border border-line px-3.5 py-2.5 text-sm outline-none focus:border-accent-hi/60 resize-none"
      />
      <div className="flex flex-wrap gap-1.5 mt-3">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => setPrompt(s)}
            className="text-[11px] px-2.5 py-1 rounded-full bg-white/5 text-muted hover:text-white hover:bg-white/10 transition"
          >
            {s}
          </button>
        ))}
      </div>
      {error && <p className="text-xs text-rose-300 mt-3">{error}</p>}
      <button
        onClick={build}
        disabled={busy || !prompt.trim()}
        className="mt-4 w-full flex items-center justify-center gap-2 rounded-xl bg-accent hover:bg-accent-hi disabled:opacity-40 text-white font-medium py-2.5 transition"
      >
        {busy ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
        {busy ? 'Assembling…' : 'Build playlist'}
      </button>
    </Modal>
  )
}
