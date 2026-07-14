import { useEffect, useMemo, useRef, useState } from 'react'
import { Search as SearchIcon, Loader2, WifiOff } from 'lucide-react'
import { useLibrary } from '../store/libraryStore'
import { usePlayer } from '../store/playerStore'
import { searchSongs, searchAlbums, searchArtists, getAlbumSongs, getArtistSongs } from '../lib/catalog/saavn'
import { TrackList } from '../components/TrackRow'
import { Art, SectionTitle, EmptyState } from '../components/ui'

export default function Search() {
  const [query, setQuery] = useState('')
  const [remote, setRemote] = useState({ songs: [], albums: [], artists: [] })
  const [busy, setBusy] = useState(false)
  const [offline, setOffline] = useState(false)
  const tracks = useLibrary((s) => s.tracks)
  const player = usePlayer.getState()
  const timer = useRef(null)
  const seq = useRef(0)

  const localMatches = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return tracks
      .filter((t) => `${t.title} ${t.artist} ${t.album} ${t.genre}`.toLowerCase().includes(q))
      .slice(0, 10)
  }, [query, tracks])

  useEffect(() => {
    clearTimeout(timer.current)
    const q = query.trim()
    if (q.length < 2) {
      setRemote({ songs: [], albums: [], artists: [] })
      setBusy(false)
      return
    }
    setBusy(true)
    const mySeq = ++seq.current
    timer.current = setTimeout(async () => {
      try {
        const [songs, albums, artists] = await Promise.all([
          searchSongs(q, { limit: 15 }),
          searchAlbums(q, { limit: 6 }),
          searchArtists(q, { limit: 6 }),
        ])
        if (mySeq !== seq.current) return
        setRemote({ songs, albums, artists })
        setOffline(false)
      } catch {
        if (mySeq !== seq.current) return
        setRemote({ songs: [], albums: [], artists: [] })
        setOffline(true)
      } finally {
        if (mySeq === seq.current) setBusy(false)
      }
    }, 350)
    return () => clearTimeout(timer.current)
  }, [query])

  const playCollection = async (loader) => {
    try {
      const songs = await loader()
      if (songs.length) player.playTrack(songs[0], songs)
    } catch { /* catalog unreachable */ }
  }

  return (
    <div className="fade-up max-w-4xl mx-auto">
      <div className="sticky top-0 z-10 -mx-2 px-2 pb-3 pt-1 bg-bg/70 backdrop-blur-xl">
        <div className="relative">
          <SearchIcon size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Songs, artists, albums — try “Ilaiyaraaja” or “Vaathi Coming”"
            className="w-full rounded-full bg-overlay/6 border border-line pl-11 pr-10 py-3 text-sm outline-none focus:border-accent-hi/60 transition"
          />
          {busy && <Loader2 size={16} className="animate-spin absolute right-4 top-1/2 -translate-y-1/2 text-muted" />}
        </div>
      </div>

      {!query.trim() && (
        <EmptyState icon={SearchIcon} title="Search everything" hint="Your library and the full Saavn catalog — Tamil, Hindi, and more — in one search." />
      )}

      {offline && query.trim() && (
        <div className="glass rounded-xl p-3 mb-4 flex items-center gap-2.5 text-sm text-muted">
          <WifiOff size={15} className="text-amber-400 shrink-0" />
          Catalog unreachable — showing your library only. Check the catalog URL in Settings.
        </div>
      )}

      {localMatches.length > 0 && (
        <>
          <SectionTitle>In your library</SectionTitle>
          <TrackList tracks={localMatches} />
        </>
      )}

      {remote.songs.length > 0 && (
        <>
          <SectionTitle>Songs</SectionTitle>
          <TrackList tracks={remote.songs} />
        </>
      )}

      {remote.artists.length > 0 && (
        <>
          <SectionTitle>Artists</SectionTitle>
          <div className="flex gap-4 overflow-x-auto pb-2">
            {remote.artists.map((a) => (
              <button
                key={a.id}
                onClick={() => playCollection(() => getArtistSongs(a.id))}
                className="flex flex-col items-center gap-2 shrink-0 w-28 group"
              >
                <Art src={a.artUrl} size="w-24 h-24" rounded="rounded-full" iconSize={28} className="group-hover:scale-105 transition shadow-lg" />
                <span className="text-xs font-medium line-clamp-1 w-full text-center">{a.name}</span>
              </button>
            ))}
          </div>
        </>
      )}

      {remote.albums.length > 0 && (
        <>
          <SectionTitle>Albums</SectionTitle>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {remote.albums.map((a) => (
              <button
                key={a.id}
                onClick={() => playCollection(() => getAlbumSongs(a.id))}
                className="glass rounded-xl p-3 text-left hover:bg-overlay/8 transition"
              >
                <Art src={a.artUrl} size="w-full aspect-square h-auto" rounded="rounded-lg" iconSize={24} className="mb-2" />
                <p className="text-xs font-medium line-clamp-1">{a.name}</p>
                <p className="text-[10px] text-muted line-clamp-1">{a.year || a.artist}</p>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
