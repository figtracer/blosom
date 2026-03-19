export interface Note {
  pitch: string
  duration: number
  velocity: number
  startTime: number
}

export interface Melody {
  notes: Note[]
  bpm: number
  scale: string
  durationSecs: number
}

const SCALES: Record<string, number[]> = {
  'C major pentatonic':  [0, 2, 4, 7, 9],
  'A minor pentatonic':  [0, 3, 5, 7, 10],
  'D major pentatonic':  [2, 4, 6, 9, 11],
  'E minor pentatonic':  [4, 7, 9, 11, 14],
}
const SCALE_NAMES = Object.keys(SCALES)

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

const DURATIONS = [0.25, 0.25, 0.5, 0.5, 0.5, 1.0, 1.0, 2.0]

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex
  const bytes = new Uint8Array(clean.length / 2)
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(clean.substr(i * 2, 2), 16)
  }
  return bytes
}

export function generateMelody(blobHash: string): Melody {
  const bytes = hexToBytes(blobHash)

  const scaleIdx = bytes[28] % SCALE_NAMES.length
  const scaleName = SCALE_NAMES[scaleIdx]
  const scale = SCALES[scaleName]

  const bpm = 90 + (bytes[29] % 80)
  const beatDuration = 60 / bpm

  const notes: Note[] = []
  let currentTime = 0

  for (let i = 0; i < 16; i++) {
    const b = bytes[i]

    const scaleNote = scale[b % scale.length]
    const semitone = scaleNote % 12
    const octave = 3 + Math.floor(b / 85)
    const octaveClamped = Math.min(Math.max(octave, 3), 5)
    const pitch = `${NOTE_NAMES[semitone]}${octaveClamped}`

    const durIdx = bytes[16 + (i % 16)] % DURATIONS.length
    const durationBeats = DURATIONS[durIdx]
    const durationSecs = durationBeats * beatDuration

    const velocity = 0.3 + (b / 255) * 0.6

    notes.push({
      pitch,
      duration: durationSecs,
      velocity,
      startTime: currentTime,
    })

    currentTime += durationSecs
  }

  return {
    notes,
    bpm,
    scale: scaleName,
    durationSecs: currentTime,
  }
}
