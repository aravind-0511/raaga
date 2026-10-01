import { dbPromise } from './db'

const BACKUP_MARKER = 'riff-backup'
const BACKUP_VERSION = 2 // v2: raw binary blob packing (see below), not base64-in-JSON

// v1 converted every blob to a base64 string and held the whole backup as
// one giant JSON string in memory at once — on a phone-sized library that
// spiked memory hard enough to get the tab killed. v2 instead writes a small
// JSON header (track/playlist/etc. metadata only — no audio data in it) and
// appends every blob's raw bytes directly as separate Blob parts:
//
//   [4 bytes: header length N] [N bytes: UTF-8 JSON header] [blob 1] [blob 2] ...
//
// This is both smaller (no base64's ~33% size inflation) and far lighter on
// memory — the browser's Blob API concatenates parts by reference rather
// than copying everything into one JS string, and on import, File.slice()
// carves each blob back out lazily without reading it into memory first.
// Audio data is never touched/re-encoded either way — bit-identical in both
// formats, this is purely about how it's packaged for transfer.

function u32le(n) {
  const buf = new ArrayBuffer(4)
  new DataView(buf).setUint32(0, n, true)
  return buf
}

function readU32le(buf) {
  return new DataView(buf).getUint32(0, true)
}

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

  // Fetch each blob reference (cheap — not reading bytes into JS memory) and
  // record its id/type/size in the header; the actual Blob objects become
  // parts of the final file, appended in this same order.
  const blobIdList = [...blobIds]
  const blobParts = []
  const blobIndex = []
  for (let i = 0; i < blobIdList.length; i++) {
    const id = blobIdList[i]
    const rec = await db.get('blobs', id)
    if (rec) {
      blobParts.push(rec.blob)
      blobIndex.push({ id, type: rec.blob.type, size: rec.blob.size })
    }
    onProgress?.(i + 1, blobIdList.length)
  }

  const header = {
    app: BACKUP_MARKER,
    version: BACKUP_VERSION,
    exportedAt: Date.now(),
    tracks,
    playlists,
    likes,
    playEvents,
    waveforms,
    settings: settingsRows,
    blobIndex,
  }
  const headerBytes = new TextEncoder().encode(JSON.stringify(header))

  const file = new Blob([u32le(headerBytes.byteLength), headerBytes, ...blobParts], {
    type: 'application/octet-stream',
  })
  const url = URL.createObjectURL(file)
  const a = document.createElement('a')
  a.href = url
  a.download = `riff-backup-${new Date().toISOString().slice(0, 10)}.riffbackup`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10000)

  return {
    tracks: tracks.length,
    blobs: blobIndex.length,
    playlists: playlists.length,
    likes: likes.length,
  }
}

export async function importLibraryBackup(file, onProgress) {
  const headerLenBuf = await file.slice(0, 4).arrayBuffer()
  const headerLen = readU32le(headerLenBuf)
  const headerBuf = await file.slice(4, 4 + headerLen).arrayBuffer()
  let header
  try {
    header = JSON.parse(new TextDecoder().decode(headerBuf))
  } catch {
    throw new Error('Not a valid backup file')
  }
  if (header.app !== BACKUP_MARKER) throw new Error('Not a Riff backup file')

  const db = await dbPromise

  // Blobs follow the header back-to-back, in blobIndex order — slice()
  // is lazy (no data read until actually used), so this never holds more
  // than one blob's bytes in memory at a time.
  const blobIndex = header.blobIndex || []
  let offset = 4 + headerLen
  for (let i = 0; i < blobIndex.length; i++) {
    const { id, type, size } = blobIndex[i]
    const slice = file.slice(offset, offset + size, type)
    await db.put('blobs', { id, blob: slice })
    offset += size
    onProgress?.(i + 1, blobIndex.length)
  }

  const putAll = async (storeName, rows) => {
    if (!rows?.length) return
    const tx = db.transaction(storeName, 'readwrite')
    for (const row of rows) await tx.store.put(row)
    await tx.done
  }
  await putAll('tracks', header.tracks)
  await putAll('playlists', header.playlists)
  await putAll('likes', header.likes)
  await putAll('waveforms', header.waveforms)
  await putAll('settings', header.settings)

  // Listening history: always add as new rows (autoIncrement id) instead of
  // reusing the source id, so importing never collides with or overwrites
  // history already built up locally.
  if (header.playEvents?.length) {
    const tx = db.transaction('playEvents', 'readwrite')
    for (const event of header.playEvents) {
      const { id, ...rest } = event
      await tx.store.add(rest)
    }
    await tx.done
  }

  return {
    tracks: (header.tracks || []).length,
    blobs: blobIndex.length,
    playlists: (header.playlists || []).length,
    likes: (header.likes || []).length,
  }
}
