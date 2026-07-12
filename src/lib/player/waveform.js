export const PEAK_COUNT = 240
const MAX_DECODE_BYTES = 120 * 1024 * 1024

// Decode a media blob's audio and reduce it to PEAK_COUNT normalized peaks.
// Works for any container decodeAudioData understands; returns null otherwise.
export async function computePeaks(blob) {
  if (!blob || blob.size > MAX_DECODE_BYTES) return null
  let ctx
  try {
    const buf = await blob.arrayBuffer()
    ctx = new AudioContext({ sampleRate: 22050 })
    const audio = await ctx.decodeAudioData(buf)
    const data = audio.getChannelData(0)
    const bucket = Math.max(1, Math.floor(data.length / PEAK_COUNT))
    const peaks = new Array(PEAK_COUNT).fill(0)
    for (let i = 0; i < PEAK_COUNT; i++) {
      let max = 0
      const start = i * bucket
      const end = Math.min(start + bucket, data.length)
      for (let j = start; j < end; j += 8) {
        const v = Math.abs(data[j])
        if (v > max) max = v
      }
      peaks[i] = max
    }
    const top = Math.max(...peaks, 0.01)
    return peaks.map((p) => +(p / top).toFixed(3))
  } catch {
    return null
  } finally {
    ctx?.close().catch(() => {})
  }
}
