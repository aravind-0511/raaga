import { dbPromise } from './db'

const BACKUP_MARKER = 'riff-backup'
const BACKUP_VERSION = 1

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

async function dataUrlToBlob(dataUrl) {
  const res = await fetch(dataUrl)
  return res.blob()
}

// Bundles the whole local library — tracks, audio/art/cover blobs,
// playlists, likes, listening history, waveforms, settings — into one
// portable JSON file. Needed because separate storage origins (the GitHub
// Pages PWA vs. the installed native app) are fully sandboxed from each
// other by the browser — there is no way for one to read the other's
// IndexedDB directly, so moving a library between them means exporting to
// a file and importing it on the other side.
export async function exportLibraryBackup(onProgress) {
  const db = await dbPromise
  const [tracks, playlists, likes, playEvents, settingsRows] = await Promise.all([
    db.getAll('tracks'),
    db.getAll('playlists'),
    db.getAll('likes'),
    db.getAll('playEvents'),
    db.getAll('settings'),
  ])

  const blobIds = new Set()
  for (const t of tracks) {
    if (t.blobId) blobIds.add(t.blobId)
    if (t.artBlobId) blobIds.add(t.artBlobId)
  }
  for (const p of playlists) {
    if (p.coverBlobId) blobIds.add(p.coverBlobId)
  }

  const waveforms = []
  for (const t of tracks) {
    const w = await db.get('waveforms', t.id)
    if (w) waveforms.push(w)
  }

  const blobIdList = [...blobIds]
  const blobs = []
  for (let i = 0; i < blobIdList.length; i++) {
    const id = blobIdList[i]
    const rec = await db.get('blobs', id)
    if (rec) blobs.push({ id, dataUrl: await blobToDataUrl(rec.blob) })
    onProgress?.(i + 1, blobIdList.length)
  }

  const payload = {
    app: BACKUP_MARKER,
    version: BACKUP_VERSION,
    exportedAt: Date.now(),
    tracks,
    blobs,
    playlists,
    likes,
    playEvents,
    waveforms,
    settings: settingsRows,
  }

  const json = JSON.stringify(payload)
  const file = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(file)
  const a = document.createElement('a')
  a.href = url
  a.download = `riff-backup-${new Date().toISOString().slice(0, 10)}.json`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10000)

  return {
    tracks: tracks.length,
    blobs: blobs.length,
    playlists: playlists.length,
    likes: likes.length,
  }
}

// Imports a file produced by exportLibraryBackup. Upserts everything by id,
// so it's safe to re-run — importing on top of the existing demo catalog
// (same fixed ids on both sides) just merges cleanly instead of duplicating.
export async function importLibraryBackup(file, onProgress) {
  const text = await file.text()
  let payload
  try {
    payload = JSON.parse(text)
  } catch {
    throw new Error('Not a valid backup file')
  }
  if (payload.app !== BACKUP_MARKER) throw new Error('Not a Riff backup file')

  const db = await dbPromise

  const blobList = payload.blobs || []
  for (let i = 0; i < blobList.length; i++) {
    const { id, dataUrl } = blobList[i]
    const blob = await dataUrlToBlob(dataUrl)
    await db.put('blobs', { id, blob })
    onProgress?.(i + 1, blobList.length)
  }

  const putAll = async (storeName, rows) => {
    if (!rows?.length) return
    const tx = db.transaction(storeName, 'readwrite')
    for (const row of rows) await tx.store.put(row)
    await tx.done
  }
  await putAll('tracks', payload.tracks)
  await putAll('playlists', payload.playlists)
  await putAll('likes', payload.likes)
  await putAll('waveforms', payload.waveforms)
  await putAll('settings', payload.settings)

  // Listening history: always add as new rows (autoIncrement id) instead of
  // reusing the source id, so importing never collides with or overwrites
  // history already built up locally.
  if (payload.playEvents?.length) {
    const tx = db.transaction('playEvents', 'readwrite')
    for (const event of payload.playEvents) {
      const { id, ...rest } = event
      await tx.store.add(rest)
    }
    await tx.done
  }

  return {
    tracks: (payload.tracks || []).length,
    blobs: blobList.length,
    playlists: (payload.playlists || []).length,
    likes: (payload.likes || []).length,
  }
}
