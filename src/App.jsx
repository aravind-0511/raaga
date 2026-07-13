import { useEffect } from 'react'
import { Routes, Route } from 'react-router-dom'
import { useSettings } from './store/settingsStore'
import { useLibrary } from './store/libraryStore'
import { useSession } from './store/sessionStore'
import Sidebar from './components/Sidebar'
import MobileTabBar from './components/MobileTabBar'
import PlayerBar from './components/PlayerBar'
import QueueDrawer from './components/QueueDrawer'
import NowPlaying from './components/NowPlaying'
import GroupSessionPanel from './components/GroupSessionPanel'
import Home from './pages/Home'
import Search from './pages/Search'
import Browse from './pages/Browse'
import Library from './pages/Library'
import PlaylistDetail from './pages/PlaylistDetail'
import Insights from './pages/Insights'
import Focus from './pages/Focus'
import Settings from './pages/Settings'

export default function App() {
  const ready = useSettings((s) => s.ready)

  useEffect(() => {
    useSettings.getState().init().then(() => {
      useLibrary.getState().init()
      useSession.getState().init()
    })
  }, [])

  if (!ready) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="eq-bars flex items-end gap-1 h-8">
          <span /><span /><span />
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex flex-1 min-h-0">
        <Sidebar />
        <main className="flex-1 min-w-0 overflow-y-auto px-4 md:px-8 pt-6 pb-8 md:pb-10">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/search" element={<Search />} />
            <Route path="/browse" element={<Browse />} />
            <Route path="/library" element={<Library />} />
            <Route path="/playlist/:id" element={<PlaylistDetail />} />
            <Route path="/insights" element={<Insights />} />
            <Route path="/focus" element={<Focus />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </main>
        <QueueDrawer />
        <GroupSessionPanel />
      </div>
      <PlayerBar />
      <MobileTabBar />
      <NowPlaying />
    </div>
  )
}
