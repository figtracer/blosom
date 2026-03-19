import * as Tone from 'tone'

let synth = null

function getSynth() {
  if (!synth) {
    synth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'triangle8' },
      envelope: {
        attack: 0.05,
        decay: 0.3,
        sustain: 0.4,
        release: 0.8,
      },
      volume: -8,
    }).toDestination()

    const reverb = new Tone.Reverb({ decay: 2.5, wet: 0.3 }).toDestination()
    synth.connect(reverb)
  }
  return synth
}

export async function playMelody(notes, bpm) {
  await Tone.start()

  const s = getSynth()
  const now = Tone.now()
  const perfNow = performance.now()

  notes.forEach((note) => {
    s.triggerAttackRelease(
      note.pitch,
      note.duration,
      now + note.startTime,
      note.velocity
    )
  })

  // Return the performance.now() timestamp synced to when audio starts
  return perfNow
}

export function stopMelody() {
  if (synth) {
    synth.releaseAll()
  }
}
