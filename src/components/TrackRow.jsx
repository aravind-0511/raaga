import { useState } from 'react'
import { Play, Heart, MoreHorizontal, Download, ListPlus, ListEnd, Trash2, Check, Loader2, Plus, HardDriveDownload, Pencil } from 'lucide-react'
import { usePlayer } from '../store/playerStore'
import { useLibrary } from '../store/libraryStore'
import { Art, Menu, MenuItem, Modal } from './ui'
import { cn, formatTime } from '../lib/utils'

export default function TrackRow({ track, context, index, onRemove, showAlbum = true }) {
  const current = usePlayer((s) => s.current)
  const playing = usePlayer((s) => s.playing)
  const liked = useLibrary((s) => !!s.likes[track.id])
  const downloading = useLibrary((s) => s.downloadingIds.has(track.id))
  const playlists = useLibrary((s) => s.playlists)
  const isCurrent = current?.id === track.id
  const lib = useLibrary.getState()
  const player = usePlayer.getState()

  const [renameOpen, setRenameOpen] = useState(false)
  const [rTitle, setRTitle] = useState('')
  const [rArtist, setRArtist] = useState('')

  const openRename = () => {
    setRTitle(track.title)
    setRArtist(track.artist)
    setRenameOpen(true)
  }
  const saveRename = () => {
    lib.renameTrack(track, { title: rTitle, artist: rArtist })
    setRenameOpen(false)
  }

  const onPlay = () => {
    if (isCurrent) player.toggle()
    else player.playTrack(track, context)
  }

  return (
    <>
    <div
      className={cn(
        'group flex items-center gap-3 px-3 py-2 rounded-xl transition cursor-pointer select-none',
        isCurrent ? 'bg-overlay/8' : 'hover:bg-overlay/5'
      )}
      onDoubleClick={onPlay}
    >
      <div className="relative shrink-0" onClick={onPlay}>
        <Art src={track.artUrl} />
        <div
          className={cn(
            'absolute inset-0 rounded-lg grid place-items-center bg-black/50 transition',
            isCurrent ? 'opacity-100' : 'opacity-0 md:group-hover:opacity-100'
          )}
        >
          {isCurrent && playing ? (
            <span className="eq-bars flex items-end gap-0.5 h-4"><span /><span /><span /></span>
          ) : (
            <Play size={16} fill="currentColor" />
          )}
        </div>
      </div>

      <div className="flex-1 min-w-0" onClick={onPlay}>
        <p className={cn('text-sm font-medium line-clamp-1', isCurrent && 'text-accent-hi')}>
          {track.title}
          {track.blobId && track.source !== 'local' && (
            <HardDriveDownload size={11} className="inline ml-1.5 -mt-0.5 text-accent-hi/80" />
          )}
        </p>
        <p className="text-xs text-muted line-clamp-1">
          {track.artist}
          {showAlbum && track.album ? ` · ${track.album}` : ''}
        </p>
      </div>

      {track.genre && <span className="hidden lg:block text-[11px] text-muted px-2 py-0.5 rounded-full bg-overlay/5">{track.genre}</span>}

      <button
        onClick={(e) => {
          e.stopPropagation()
          lib.toggleLike(track)
        }}
        className={cn(
          'p-2 rounded-full transition active:scale-90',
          liked ? 'text-accent-hi' : 'text-muted opacity-100 md:opacity-0 md:group-hover:opacity-100 hover:text-ink'
        )}
      >
        <Heart size={16} fill={liked ? 'currentColor' : 'none'} className={liked ? 'heart-pop' : ''} />
      </button>

      <span className="text-xs text-muted tabular-nums w-10 text-right">{formatTime(track.duration)}</span>

      <Menu
        button={
          <button className="p-2 rounded-full text-muted opacity-100 md:opacity-0 md:group-hover:opacity-100 hover:text-ink transition" onClick={(e) => e.stopPropagation()}>
            {downloading ? <Loader2 size={16} className="animate-spin opacity-100" /> : <MoreHorizontal size={16} />}
          </button>
        }
      >
        <MenuItem icon={ListPlus} onClick={() => player.addToQueue(track, { next: true })}>Play next</MenuItem>
        <MenuItem icon={ListEnd} onClick={() => player.addToQueue(track)}>Add to queue</MenuItem>
        <div className="my-1 border-t border-line" />
        {playlists.length === 0 && (
          <MenuItem icon={Plus} onClick={async () => {
            const pl = await lib.createPlaylist({ name: 'My Playlist' })
            lib.addToPlaylist(pl.id, track)
          }}>
            New playlist with this track
          </MenuItem>
        )}
        {playlists.slice(0, 6).map((pl) => (
          <MenuItem
            key={pl.id}
            icon={pl.trackIds.includes(track.id) ? Check : Plus}
            onClick={() => lib.addToPlaylist(pl.id, track)}
          >
            Add to “{pl.name}”
          </MenuItem>
        ))}
        <div className="my-1 border-t border-line" />
        <MenuItem icon={Pencil} onClick={openRename}>Rename</MenuItem>
        {track.source !== 'local' && !track.blobId && (
          <MenuItem icon={Download} onClick={() => lib.downloadForOffline(track)}>Download for offline</MenuItem>
        )}
        {track.source !== 'local' && track.blobId && (
          <MenuItem icon={Trash2} onClick={() => lib.removeDownload(track)}>Remove download</MenuItem>
        )}
        {onRemove && <MenuItem icon={Trash2} danger onClick={() => onRemove(track, index)}>Remove from here</MenuItem>}
        {track.source === 'local' && (
          <MenuItem icon={Trash2} danger onClick={() => lib.removeTrack(track.id)}>Delete from library</MenuItem>
        )}
      </Menu>
    </div>

    <Modal open={renameOpen} onClose={() => setRenameOpen(false)} title="Rename track">
      <label className="text-xs text-muted">Title</label>
      <input
        value={rTitle}
        onChange={(e) => setRTitle(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && saveRename()}
        autoFocus
        className="w-full rounded-xl bg-overlay/5 border border-line px-3.5 py-2.5 text-sm outline-none focus:border-accent-hi/60 mt-1 mb-3"
      />
      <label className="text-xs text-muted">Artist</label>
      <input
        value={rArtist}
        onChange={(e) => setRArtist(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && saveRename()}
        className="w-full rounded-xl bg-overlay/5 border border-line px-3.5 py-2.5 text-sm outline-none focus:border-accent-hi/60 mt-1"
      />
      <button
        onClick={saveRename}
        disabled={!rTitle.trim()}
        className="mt-4 w-full flex items-center justify-center gap-2 rounded-xl bg-accent hover:bg-accent-hi disabled:opacity-40 text-white font-medium py-2.5 transition"
      >
        <Check size={15} /> Save
      </button>
    </Modal>
    </>
  )
}

export function TrackList({ tracks, context, onRemove, showAlbum }) {
  const ctx = context || tracks
  return (
    <div className="flex flex-col gap-0.5">
      {tracks.map((t, i) => (
        <TrackRow key={t.id + i} track={t} context={ctx} index={i} onRemove={onRemove} showAlbum={showAlbum} />
      ))}
    </div>
  )
}
