// Bundled fallback catalog: short original synth loops rendered locally with
// OfflineAudioContext on first run and stored as WAV blobs in IndexedDB.
// Keeps Search/Browse/playback fully working with no network and no
// copyrighted material.

import { putBlob, putTrack, getTrack, putWaveform } from '../repo'
import { computePeaks } from '../player/waveform'

const SAMPLE_RATE = 22050

const SCALES = {
  kalyani: [0, 2, 4, 6, 7, 9, 11], // lydian-ish raga
  minor: [0, 2, 3, 5, 7, 8, 10],
  major: [0, 2, 4, 5, 7, 9, 11],
  pentatonic: [0, 3, 5, 7, 10],
}

const DEMOS = [
  { id: 'demo:veena-dawn', title: 'Veena at Dawn', artist: 'Riff Demo Ensemble', album: 'Built-in Sessions', genre: 'Carnatic Fusion', scale: 'kalyani', bpm: 72, root: 220, bright: 0.4, seconds: 24 },
  { id: 'demo:filter-monsoon', title: 'Filter Coffee Monsoon', artist: 'Riff Demo Ensemble', album: 'Built-in Sessions', genre: 'Lo-fi', scale: 'pentatonic', bpm: 84, root: 196, bright: 0.25, seconds: 24 },
  { id: 'demo:kuthu-circuit', title: 'Kuthu Circuit', artist: 'Riff Demo Ensemble', album: 'Built-in Sessions', genre: 'Dance', scale: 'minor', bpm: 132, root: 147, bright: 0.7, seconds: 20 },
  { id: 'demo:marina-nightdrive', title: 'Marina Night Drive', artist: 'Riff Demo Ensemble', album: 'Built-in Sessions', genre: 'Synthwave', scale: 'minor', bpm: 104, root: 165, bright: 0.55, seconds: 24 },
  { id: 'demo:study-sruthi', title: 'Study Sruthi', artist: 'Riff Demo Ensemble', album: 'Built-in Sessions', genre: 'Ambient', scale: 'major', bpm: 60, root: 262, bright: 0.2, seconds: 28 },
]

function mulberry(seed) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

async function renderLoop(def) {
  const length = SAMPLE_RATE * def.seconds
  const ctx = new OfflineAudioContext(1, length, SAMPLE_RATE)
  const rand = mulberry(def.id.length * 7919 + def.bpm)
  const scale = SCALES[def.scale]
  const beat = 60 / def.bpm
  const master = ctx.createGain()
  master.gain.value = 0.5
  const comp = ctx.createDynamicsCompressor()
  master.connect(comp)
  comp.connect(ctx.destination)

  const note = (freq, t, dur, gainVal, type) => {
    const osc = ctx.createOscillator()
    osc.type = type
    osc.frequency.value = freq
    const g = ctx.createGain()
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(gainVal, t + 0.02)
    g.gain.exponentialRampToValueAtTime(0.001, t + dur)
    osc.connect(g)
    g.connect(master)
    osc.start(t)
    osc.stop(t + dur + 0.05)
  }

  // melody
  for (let t = 0.1; t < def.seconds - 1; ) {
    const deg = scale[Math.floor(rand() * scale.length)]
    const oct = rand() > 0.75 ? 2 : 1
    const freq = def.root * oct * Math.pow(2, deg / 12)
    const dur = beat * (rand() > 0.6 ? 2 : 1)
    note(freq, t, dur * 0.95, 0.22, def.bright > 0.5 ? 'sawtooth' : 'triangle')
    t += dur
  }
  // drone / bass on root
  for (let t = 0; t < def.seconds - 1; t += beat * 4) {
    note(def.root / 2, t, beat * 4, 0.18, 'sine')
  }
  // percussion tick
  if (def.bright >= 0.4) {
    for (let t = 0; t < def.seconds - 0.5; t += beat) {
      const noise = ctx.createBufferSource()
      const nb = ctx.createBuffer(1, SAMPLE_RATE * 0.05, SAMPLE_RATE)
      const ch = nb.getChannelData(0)
      for (let i = 0; i < ch.length; i++) ch[i] = (rand() * 2 - 1) * Math.exp(-i / (ch.length / 6))
      noise.buffer = nb
      const g = ctx.createGain()
      g.gain.value = def.bright * 0.25
      noise.connect(g)
      g.connect(master)
      noise.start(t)
    }
  }
  const rendered = await ctx.startRendering()
  return audioBufferToWav(rendered)
}

function audioBufferToWav(buffer) {
  const data = buffer.getChannelData(0)
  const out = new DataView(new ArrayBuffer(44 + data.length * 2))
  const writeStr = (o, s) => [...s].forEach((c, i) => out.setUint8(o + i, c.charCodeAt(0)))
  writeStr(0, 'RIFF')
  out.setUint32(4, 36 + data.length * 2, true)
  writeStr(8, 'WAVE')
  writeStr(12, 'fmt ')
  out.setUint32(16, 16, true)
  out.setUint16(20, 1, true)
  out.setUint16(22, 1, true)
  out.setUint32(24, buffer.sampleRate, true)
  out.setUint32(28, buffer.sampleRate * 2, true)
  out.setUint16(32, 2, true)
  out.setUint16(34, 16, true)
  writeStr(36, 'data')
  out.setUint32(40, data.length * 2, true)
  for (let i = 0; i < data.length; i++) {
    const s = Math.max(-1, Math.min(1, data[i]))
    out.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true)
  }
  return new Blob([out.buffer], { type: 'audio/wav' })
}

// Idempotent: renders + stores any demo tracks missing from the library.
export async function ensureDemoCatalog() {
  const created = []
  for (const def of DEMOS) {
    if (await getTrack(def.id)) continue
    try {
      const blob = await renderLoop(def)
      const blobId = 'blob:' + def.id
      await putBlob(blobId, blob)
      const track = {
        id: def.id,
        source: 'demo',
        title: def.title,
        artist: def.artist,
        album: def.album,
        genre: def.genre,
        year: new Date().getFullYear(),
        duration: def.seconds,
        blobId,
        artUrl: null,
        addedAt: Date.now(),
      }
      await putTrack(track)
      created.push(track)
      computePeaks(blob).then((peaks) => peaks && putWaveform(def.id, peaks))
    } catch {
      // rendering unsupported — skip silently
    }
  }
  return created
}

export function searchDemo(tracks, query) {
  const q = query.toLowerCase()
  return tracks.filter(
    (t) => t.source === 'demo' && (t.title.toLowerCase().includes(q) || t.genre.toLowerCase().includes(q) || t.artist.toLowerCase().includes(q))
  )
}
