import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Play, Pencil, Trash2, Users, GripVertical, ImagePlus, Check, ChevronUp, ChevronDown } from 'lucide-react'
import { useLibrary } from '../store/libraryStore'
import { usePlayer } from '../store/playerStore'
import { useSession } from '../store/sessionStore'
import TrackRow from '../components/TrackRow'
import { Art, Modal, EmptyState } from '../components/ui'
import { cn, formatTime } from '../lib/utils'
import { ListMusic } from 'lucide-react'

const EMPTY_PRESENCE = {}

export default function PlaylistDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const playlist = useLibrary((s) => s.playlists.find((p) => p.id === id))
  const tracks = useLibrary((s) => s.tracks)
  const presence = useSession((s) => s.collabPresence[id]) || EMPTY_PRESENCE
  const lib = useLibrary.getState()
  const session = useSession.getState()
  const player = usePlayer.getState()

  const [editOpen, setEditOpen] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const coverInput = useRef(null)
  const dragFrom = useRef(null)
  const [dragOverIndex, setDragOverIndex] = useState(null)

  const items = useMemo(
    () => (playlist ? playlist.trackIds.map((tid) => tracks.find((t) => t.id === tid)).filter(Boolean) : []),
    [playlist, tracks]
  )
  const totalSeconds = items.reduce((a, t) => a + (t.duration || 0), 0)

  // collaborative presence heartbeat while this page is open
  useEffect(() => {
    if (!playlist?.collaborative) return
    session.announceCollabPresence(id)
    const t = setInterval(() => session.announceCollabPresence(id), 3000)
    return () => clearInterval(t)
  }, [id, playlist?.collaborative])

  if (!playlist) {
    return <EmptyState icon={ListMusic} title="Playlist not found" hint="It may have been deleted." />
  }

  const peersHere = Object.entries(presence).filter(([, p]) => Date.now() - p.lastSeen < 8000)

  const reorder = (from, to) => {
    if (from === to || from == null || to == null) return
    const ids = [...playlist.trackIds]
    const [moved] = ids.splice(from, 1)
    ids.splice(to, 0, moved)
    lib.updatePlaylist(id, { trackIds: ids })
  }

  return (
    <div className="fade-up max-w-4xl">
      <div className="flex flex-col sm:flex-row gap-5 sm:items-end mb-6">
        <div className="relative group w-40 h-40 shrink-0">
          <Art src={playlist.coverUrl} size="w-40 h-40" rounded="rounded-2xl" iconSize={40} className="accent-glow" />
          {/* desktop: hover overlay */}
          <button
            onClick={() => coverInput.current?.click()}
            className="hidden md:grid absolute inset-0 rounded-2xl place-items-center bg-black/50 opacity-0 group-hover:opacity-100 transition"
            title="Change cover"
          >
            <ImagePlus size={22} />
          </button>
          {/* mobile: always-visible badge (avoids an invisible full-cover tap target) */}
          <button
            onClick={() => coverInput.current?.click()}
            className="md:hidden absolute bottom-2 right-2 w-9 h-9 grid place-items-center rounded-full bg-black/70 backdrop-blur text-white shadow-lg"
            title="Change cover"
          >
            <ImagePlus size={16} />
          </button>
          <input
            ref={coverInput}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) lib.updatePlaylist(id, { coverBlob: f })
              e.target.value = ''
            }}
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] uppercase tracking-widest text-muted">Playlist</p>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight line-clamp-2 mt-1">{playlist.name}</h1>
          {playlist.description && <p className="text-sm text-muted mt-1.5 line-clamp-2">{playlist.description}</p>}
          <p className="text-xs text-muted mt-2">
            {items.length} tracks · {formatTime(totalSeconds)}
          </p>
          {playlist.collaborative && (
            <div className="flex items-center gap-1.5 mt-2">
              <Users size={13} className="text-accent-hi" />
              <span className="text-xs text-accent-hi">Collaborative</span>
              {peersHere.map(([pid, p]) => (
                <span
                  key={pid}
                  title={`${p.name} is here`}
                  className="w-5 h-5 rounded-full grid place-items-center text-[9px] font-bold text-black animate-pulse"
                  style={{ background: p.color }}
                >
                  {p.name[0]}
                </span>
              ))}
              {peersHere.length > 0 && <span className="text-[11px] text-muted">editing live</span>}
            </div>
          )}
          <div className="flex items-center gap-2 mt-4">
            {items.length > 0 && (
              <button
                onClick={() => player.playTrack(items[0], items)}
                className="flex items-center gap-1.5 text-sm bg-accent hover:bg-accent-hi rounded-full px-5 py-2 font-medium transition"
              >
                <Play size={14} fill="currentColor" /> Play
              </button>
            )}
            <button
              onClick={() => {
                setName(playlist.name)
                setDescription(playlist.description || '')
                setEditOpen(true)
              }}
              className="p-2.5 rounded-full bg-white/6 hover:bg-white/12 text-muted hover:text-white transition"
              title="Edit details"
            >
              <Pencil size={15} />
            </button>
            <button
              onClick={() => lib.updatePlaylist(id, { collaborative: !playlist.collaborative })}
              className={cn(
                'p-2.5 rounded-full transition',
                playlist.collaborative ? 'bg-accent/25 text-accent-hi' : 'bg-white/6 text-muted hover:text-white hover:bg-white/12'
              )}
              title={playlist.collaborative ? 'Make private' : 'Make collaborative (live co-editing across tabs)'}
            >
              <Users size={15} />
            </button>
            <button
              onClick={async () => {
                await lib.removePlaylist(id)
                navigate('/library')
              }}
              className="p-2.5 rounded-full bg-white/6 hover:bg-rose-500/20 text-muted hover:text-rose-300 transition"
              title="Delete playlist"
            >
              <Trash2 size={15} />
            </button>
          </div>
        </div>
      </div>

      {items.length === 0 && (
        <EmptyState icon={ListMusic} title="Nothing here yet" hint="Use the ⋯ menu on any track — in Search, Browse, or your Library — to add it to this playlist." />
      )}

      <div className="flex flex-col gap-0.5">
        {items.map((t, i) => (
          <div
            key={t.id + i}
            draggable
            onDragStart={() => (dragFrom.current = i)}
            onDragOver={(e) => {
              e.preventDefault()
              setDragOverIndex(i)
            }}
            onDrop={() => {
              reorder(dragFrom.current, i)
              dragFrom.current = null
              setDragOverIndex(null)
            }}
            onDragEnd={() => setDragOverIndex(null)}
            className={cn('flex items-center gap-1 rounded-xl transition', dragOverIndex === i && 'outline-2 outline-accent-hi/60')}
          >
            {/* desktop: drag handle */}
            <GripVertical size={14} className="hidden md:block text-muted/50 cursor-grab shrink-0 ml-1" />
            {/* mobile: up/down buttons (HTML5 drag doesn't work on touch) */}
            <div className="md:hidden flex flex-col shrink-0 -my-1">
              <button
                onClick={() => reorder(i, i - 1)}
                disabled={i === 0}
                className="p-0.5 text-muted disabled:opacity-25 active:text-white"
                title="Move up"
              >
                <ChevronUp size={16} />
              </button>
              <button
                onClick={() => reorder(i, i + 1)}
                disabled={i === items.length - 1}
                className="p-0.5 text-muted disabled:opacity-25 active:text-white"
                title="Move down"
              >
                <ChevronDown size={16} />
              </button>
            </div>
            <div className="flex-1 min-w-0">
              <TrackRow
                track={t}
                context={items}
                index={i}
                onRemove={() => lib.updatePlaylist(id, { trackIds: playlist.trackIds.filter((_, x) => x !== i) })}
              />
            </div>
          </div>
        ))}
      </div>

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Edit playlist">
        <label className="text-xs text-muted">Name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-xl bg-white/5 border border-line px-3.5 py-2.5 text-sm outline-none focus:border-accent-hi/60 mt-1 mb-3"
        />
        <label className="text-xs text-muted">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="w-full rounded-xl bg-white/5 border border-line px-3.5 py-2.5 text-sm outline-none focus:border-accent-hi/60 mt-1 resize-none"
        />
        <button
          onClick={() => {
            lib.updatePlaylist(id, { name: name.trim() || playlist.name, description })
            setEditOpen(false)
          }}
          className="mt-4 w-full flex items-center justify-center gap-2 rounded-xl bg-accent hover:bg-accent-hi text-white font-medium py-2.5 transition"
        >
          <Check size={15} /> Save
        </button>
      </Modal>
    </div>
  )
}
