import { useMemo, useState } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import { Heart, ListMusic, Mic2, Disc3, UploadCloud, Plus, Play, Shuffle, Search as SearchIcon, Users, HardDriveDownload } from 'lucide-react'
import { useLibrary, likedTracks } from '../store/libraryStore'
import { usePlayer } from '../store/playerStore'
import { TrackList } from '../components/TrackRow'
import UploadDropzone from '../components/UploadDropzone'
import { Art, EmptyState } from '../components/ui'
import { cn, formatDuration } from '../lib/utils'

const matchesTrack = (t, q) => `${t.title} ${t.artist} ${t.album || ''}`.toLowerCase().includes(q)

const TABS = [
  { id: 'playlists', label: 'Playlists', icon: ListMusic },
  { id: 'liked', label: 'Liked', icon: Heart },
  { id: 'artists', label: 'Artists', icon: Mic2 },
  { id: 'albums', label: 'Albums', icon: Disc3 },
  { id: 'uploads', label: 'Uploads', icon: UploadCloud },
]

export default function Library() {
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') || 'playlists'
  const lib = useLibrary()
  const player = usePlayer.getState()
  const shuffleOn = usePlayer((s) => s.shuffle)
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()

  const totalSeconds = useMemo(() => lib.tracks.reduce((a, t) => a + (t.duration || 0), 0), [lib.tracks])
  const liked = useMemo(() => likedTracks(lib), [lib.likes, lib.tracks])
  const uploads = useMemo(() => lib.tracks.filter((t) => t.source === 'local'), [lib.tracks])
  const downloaded = useMemo(() => lib.tracks.filter((t) => t.source !== 'local' && t.blobId), [lib.tracks])

  const artists = useMemo(() => {
    const map = new Map()
    for (const t of lib.tracks) {
      for (const name of (t.artist || 'Unknown Artist').split(',').map((s) => s.trim())) {
        if (!map.has(name)) map.set(name, { name, tracks: [], artUrl: t.artUrl })
        map.get(name).tracks.push(t)
        if (!map.get(name).artUrl && t.artUrl) map.get(name).artUrl = t.artUrl
      }
    }
    return [...map.values()].sort((a, b) => b.tracks.length - a.tracks.length)
  }, [lib.tracks])

  const albums = useMemo(() => {
    const map = new Map()
    for (const t of lib.tracks) {
      const key = t.album || '—'
      if (key === '—') continue
      if (!map.has(key)) map.set(key, { name: key, artist: t.artist, tracks: [], artUrl: t.artUrl })
      map.get(key).tracks.push(t)
      if (!map.get(key).artUrl && t.artUrl) map.get(key).artUrl = t.artUrl
    }
    return [...map.values()].sort((a, b) => b.tracks.length - a.tracks.length)
  }, [lib.tracks])

  const filteredPlaylists = q ? lib.playlists.filter((pl) => pl.name.toLowerCase().includes(q)) : lib.playlists
  const filteredLiked = q ? liked.filter((t) => matchesTrack(t, q)) : liked
  const filteredArtists = q ? artists.filter((a) => a.name.toLowerCase().includes(q)) : artists
  const filteredAlbums = q ? albums.filter((a) => a.name.toLowerCase().includes(q)) : albums
  const filteredUploads = q ? uploads.filter((t) => matchesTrack(t, q)) : uploads
  const filteredDownloaded = q ? downloaded.filter((t) => matchesTrack(t, q)) : downloaded

  return (
    <div className="fade-up max-w-5xl mx-auto">
      <div className="flex items-center justify-between gap-3 mb-1">
        <h1 className="font-logo font-semibold text-3xl md:text-4xl tracking-tight">Your Library</h1>
        <button
          onClick={() => player.shufflePlayList(lib.tracks)}
          disabled={!lib.tracks.length}
          title="Shuffle play your whole library"
          className={cn(
            'p-2.5 rounded-full transition active:scale-90 disabled:opacity-30 disabled:pointer-events-none',
            shuffleOn ? 'bg-accent/25 text-accent-hi' : 'bg-overlay/6 text-muted hover:text-ink hover:bg-overlay/12'
          )}
        >
          <Shuffle size={17} />
        </button>
      </div>
      <p className="text-sm text-muted mb-5">
        {lib.tracks.length} song{lib.tracks.length === 1 ? '' : 's'} · {formatDuration(totalSeconds)}
      </p>

      <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setParams({ tab: id })}
            className={cn(
              'flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition',
              tab === id ? 'bg-ink text-bg' : 'bg-overlay/6 text-muted hover:text-ink'
            )}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      <div className="relative mb-6">
        <SearchIcon size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search this section"
          className="w-full rounded-full bg-overlay/6 border border-line pl-10 pr-4 py-2 text-sm outline-none focus:border-accent-hi/60 transition"
        />
      </div>

      {tab === 'playlists' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {!q && (
            <button
              onClick={async () => {
                const pl = await lib.createPlaylist({ name: 'New Playlist' })
                navigate(`/playlist/${pl.id}`)
              }}
              className="glass lift rounded-2xl p-4 flex flex-col items-center justify-center gap-2 min-h-44 border-2 border-dashed border-overlay/15 hover:border-overlay/30 text-muted hover:text-ink transition"
            >
              <Plus size={22} />
              <span className="text-sm font-medium">New playlist</span>
            </button>
          )}
          {filteredPlaylists.map((pl) => (
            <Link key={pl.id} to={`/playlist/${pl.id}`} className="glass lift rounded-2xl p-4 hover:bg-overlay/8 transition group">
              <Art src={pl.coverUrl} size="w-full aspect-square h-auto" rounded="rounded-xl" iconSize={28} className="mb-3" />
              <p className="font-medium text-sm line-clamp-1 flex items-center gap-1.5">
                {pl.name}
                {pl.collaborative && <Users size={12} className="text-accent-hi shrink-0" />}
              </p>
              <p className="text-[11px] text-muted mt-0.5">
                {pl.trackIds.length} tracks
                {(() => {
                  const secs = pl.trackIds.reduce((a, tid) => {
                    const t = lib.tracks.find((x) => x.id === tid)
                    return a + (t?.duration || 0)
                  }, 0)
                  return secs > 0 ? ` · ${formatDuration(secs)}` : ''
                })()}
              </p>
            </Link>
          ))}
        </div>
      )}
      {tab === 'playlists' && q && filteredPlaylists.length === 0 && (
        <EmptyState icon={ListMusic} title="No matches" hint={`No playlists match “${query}”.`} />
      )}

      {tab === 'liked' &&
        (filteredLiked.length ? (
          <>
            {!q && (
              <button
                onClick={() => player.playTrack(liked[0], liked)}
                className="flex items-center gap-1.5 text-sm bg-accent hover:bg-accent-hi text-white rounded-full px-4 py-1.5 font-medium transition mb-4"
              >
                <Play size={13} fill="currentColor" /> Play all
              </button>
            )}
            <TrackList tracks={filteredLiked} />
          </>
        ) : q ? (
          <EmptyState icon={Heart} title="No matches" hint={`No liked songs match “${query}”.`} />
        ) : (
          <EmptyState icon={Heart} title="No liked songs yet" hint="Tap the heart on any track and it lands here." />
        ))}

      {tab === 'artists' &&
        (filteredArtists.length ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4">
            {filteredArtists.map((a) => (
              <button
                key={a.name}
                onClick={() => player.playTrack(a.tracks[0], a.tracks)}
                className="flex flex-col items-center gap-2 group"
              >
                <Art src={a.artUrl} size="w-24 h-24" rounded="rounded-full" iconSize={26} className="group-hover:scale-105 transition shadow-lg" />
                <span className="text-xs font-medium line-clamp-1 w-full text-center">{a.name}</span>
                <span className="text-[10px] text-muted -mt-1.5">{a.tracks.length} tracks</span>
              </button>
            ))}
          </div>
        ) : q ? (
          <EmptyState icon={Mic2} title="No matches" hint={`No artists match “${query}”.`} />
        ) : (
          <EmptyState icon={Mic2} title="No artists yet" hint="Upload music or play from the catalog to build this view." />
        ))}

      {tab === 'albums' &&
        (filteredAlbums.length ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {filteredAlbums.map((a) => (
              <button key={a.name} onClick={() => player.playTrack(a.tracks[0], a.tracks)} className="glass lift rounded-xl p-3 text-left hover:bg-overlay/8 transition">
                <Art src={a.artUrl} size="w-full aspect-square h-auto" rounded="rounded-lg" iconSize={24} className="mb-2" />
                <p className="text-xs font-medium line-clamp-1">{a.name}</p>
                <p className="text-[10px] text-muted line-clamp-1">{a.tracks.length} tracks</p>
              </button>
            ))}
          </div>
        ) : q ? (
          <EmptyState icon={Disc3} title="No matches" hint={`No albums match “${query}”.`} />
        ) : (
          <EmptyState icon={Disc3} title="No albums yet" hint="Albums appear as your library grows." />
        ))}

      {tab === 'uploads' && (
        <>
          {!q && <UploadDropzone compact={uploads.length > 0} />}
          {filteredUploads.length > 0 && (
            <div className="mt-5">
              <TrackList tracks={filteredUploads} />
            </div>
          )}
          {filteredDownloaded.length > 0 && (
            <>
              <p className="flex items-center gap-2 text-sm font-semibold mt-8 mb-3">
                <HardDriveDownload size={15} className="text-muted" /> Offline downloads
              </p>
              <TrackList tracks={filteredDownloaded} />
            </>
          )}
          {q && filteredUploads.length === 0 && filteredDownloaded.length === 0 && (
            <EmptyState icon={UploadCloud} title="No matches" hint={`Nothing in Uploads matches “${query}”.`} />
          )}
        </>
      )}
    </div>
  )
}
