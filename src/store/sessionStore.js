import { create } from 'zustand'
import { send, onMessage, deviceId, deviceName, deviceColor } from '../lib/sync/broadcast'
import { usePlayer } from './playerStore'
import { useLibrary } from './libraryStore'
import { uid } from '../lib/utils'

const HEARTBEAT_MS = 3000
const PEER_TIMEOUT_MS = 8000

export const useSession = create((set, get) => ({
  deviceId,
  deviceName,
  deviceColor,
  peers: {}, // id -> { name, color, lastSeen, playingTitle }
  group: null, // { id, hostId, hostName, chat: [], members: {} }
  collabPresence: {}, // playlistId -> { deviceId: { name, color, lastSeen } }

  init: () => {
    if (get()._initialized) return
    set({ _initialized: true })
    onMessage((msg) => get()._handle(msg))
    send('hello')
    setInterval(() => {
      const player = usePlayer.getState()
      send('heartbeat', { playingTitle: player.playing ? player.current?.title : null })
      // prune stale peers
      set((s) => ({
        peers: Object.fromEntries(
          Object.entries(s.peers).filter(([, p]) => Date.now() - p.lastSeen < PEER_TIMEOUT_MS)
        ),
      }))
      const g = get().group
      if (g && g.hostId === deviceId) get()._broadcastGroupState()
    }, HEARTBEAT_MS)
  },

  _handle: (msg) => {
    const s = get()
    switch (msg.type) {
      case 'hello':
        send('heartbeat', { playingTitle: usePlayer.getState().current?.title })
      // fallthrough
      case 'heartbeat':
        set({
          peers: {
            ...s.peers,
            [msg.from]: { name: msg.fromName, color: msg.fromColor, lastSeen: Date.now(), playingTitle: msg.playingTitle },
          },
        })
        break
      case 'handoff':
        if (msg.to !== deviceId) break
        usePlayer.getState().restoreState(msg.state)
        break
      case 'group-announce':
        if (s.group?.id === msg.groupId) break
        set({ availableGroup: { id: msg.groupId, hostId: msg.from, hostName: msg.fromName } })
        break
      case 'group-state': {
        const g = s.group
        if (!g || g.id !== msg.groupId || g.hostId === deviceId) break
        const player = usePlayer.getState()
        const st = msg.state
        const sameTrack = player.current?.id === st.queue[st.index]?.id
        if (!sameTrack) player.restoreState(st)
        else if (Math.abs(player.position - st.position) > 2) player.seek(st.position)
        if (sameTrack && st.playing !== player.playing) player.toggle()
        break
      }
      case 'group-join': {
        if (!s.group || s.group.id !== msg.groupId) break
        set({
          group: {
            ...s.group,
            members: { ...s.group.members, [msg.from]: { name: msg.fromName, color: msg.fromColor } },
          },
        })
        if (s.group.hostId === deviceId) get()._broadcastGroupState()
        break
      }
      case 'group-chat': {
        if (!s.group || s.group.id !== msg.groupId) break
        set({ group: { ...s.group, chat: [...s.group.chat, { from: msg.fromName, color: msg.fromColor, text: msg.text, ts: msg.ts }] } })
        break
      }
      case 'group-end':
        if (s.group?.id === msg.groupId) set({ group: null })
        if (s.availableGroup?.id === msg.groupId) set({ availableGroup: null })
        break
      case 'playlist-update':
        useLibrary.getState().applyRemotePlaylist(msg.playlist)
        break
      case 'collab-presence': {
        const cur = s.collabPresence[msg.playlistId] || {}
        set({
          collabPresence: {
            ...s.collabPresence,
            [msg.playlistId]: { ...cur, [msg.from]: { name: msg.fromName, color: msg.fromColor, lastSeen: Date.now() } },
          },
        })
        break
      }
      default:
        break
    }
  },

  // ---- Connect-style handoff ----
  handoffTo: (peerId) => {
    const state = usePlayer.getState().snapshotState()
    send('handoff', { to: peerId, state })
    if (usePlayer.getState().playing) usePlayer.getState().toggle()
  },

  // ---- group listening session ----
  startGroup: () => {
    const groupId = uid('grp_')
    set({ group: { id: groupId, hostId: deviceId, hostName: deviceName, chat: [], members: {} } })
    send('group-announce', { groupId })
    get()._broadcastGroupState()
  },

  joinGroup: () => {
    const g = get().availableGroup
    if (!g) return
    set({ group: { id: g.id, hostId: g.hostId, hostName: g.hostName, chat: [], members: {} }, availableGroup: null })
    send('group-join', { groupId: g.id })
  },

  leaveGroup: () => {
    const g = get().group
    if (!g) return
    if (g.hostId === deviceId) send('group-end', { groupId: g.id })
    set({ group: null })
  },

  sendChat: (text) => {
    const g = get().group
    if (!g || !text.trim()) return
    send('group-chat', { groupId: g.id, text: text.trim() })
    set({ group: { ...g, chat: [...g.chat, { from: 'You', color: deviceColor, text: text.trim(), ts: Date.now() }] } })
  },

  _broadcastGroupState: () => {
    const g = get().group
    if (!g || g.hostId !== deviceId) return
    send('group-announce', { groupId: g.id })
    send('group-state', { groupId: g.id, state: usePlayer.getState().snapshotState() })
  },

  // ---- collaborative playlists ----
  notifyPlaylistChange: (playlist) => {
    send('playlist-update', { playlist })
  },
  announceCollabPresence: (playlistId) => {
    send('collab-presence', { playlistId })
  },
}))

if (import.meta.env.DEV) {
  window.__raagaStores = { ...(window.__raagaStores || {}), useSession }
}

// host: push state on local playback changes (throttled by heartbeat otherwise)
let lastPush = 0
usePlayer.subscribe((state, prev) => {
  const s = useSession.getState()
  if (!s.group || s.group.hostId !== deviceId) return
  if (state.current?.id !== prev.current?.id || state.playing !== prev.playing) {
    const now = Date.now()
    if (now - lastPush > 300) {
      lastPush = now
      s._broadcastGroupState()
    }
  }
})

// module-level singletons: never hot-swap, always full-reload
if (import.meta.hot) import.meta.hot.decline()
