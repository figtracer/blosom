import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { motion } from 'framer-motion'
import { useAccount } from 'wagmi'
import { playMelody, stopMelody } from '../lib/audio'

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001'

function pitchToMidi(pitch) {
  const noteMap = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }
  const match = pitch.match(/^([A-G]#?)(\d)$/)
  if (!match) return 60
  const base = noteMap[match[1][0]] || 0
  const sharp = match[1].length > 1 ? 1 : 0
  return (parseInt(match[2]) + 1) * 12 + base + sharp
}

function makePitchMapper(notes) {
  if (!notes || notes.length === 0) return () => 0.5
  const midis = notes.map(n => pitchToMidi(n.pitch))
  const min = Math.min(...midis)
  const max = Math.max(...midis)
  const range = max - min || 1
  return (pitch) => {
    const midi = pitchToMidi(pitch)
    return (midi - min) / range
  }
}

const PALETTES = [
  { hue: 0, sat: 65, lum: 62 },
  { hue: 30, sat: 70, lum: 60 },
  { hue: 50, sat: 65, lum: 58 },
  { hue: 140, sat: 45, lum: 55 },
  { hue: 180, sat: 45, lum: 55 },
  { hue: 220, sat: 55, lum: 60 },
  { hue: 260, sat: 55, lum: 62 },
  { hue: 290, sat: 50, lum: 60 },
  { hue: 330, sat: 55, lum: 60 },
  { hue: 15, sat: 60, lum: 55 },
]

function getBlobColor(blobHash, blockNumber) {
  const palette = PALETTES[(blockNumber || 0) % PALETTES.length]
  const hash = blobHash.slice(2)
  const r = parseInt(hash.slice(0, 2), 16)
  const g = parseInt(hash.slice(2, 4), 16)
  const hueOffset = (r + g) % 30 - 15
  const hue = palette.hue + hueOffset
  const sat = palette.sat + (g % 15) - 7
  const lum = palette.lum + (parseInt(hash.slice(4, 6), 16) % 12) - 6
  return { hue, sat, lum, css: `hsl(${hue}, ${sat}%, ${lum}%)` }
}

// Joint positions computed via angles + trig — no SVG transform-origin needed
const DEG = Math.PI / 180
function joint(x, y, angle, len) {
  return [x + Math.sin(angle * DEG) * len, y + Math.cos(angle * DEG) * len]
}

// Poses: { shoulderL, elbowL, shoulderR, elbowR, hipL, kneeL, hipR, kneeR, jump }
const POSES = [
  { sL: 30, eL: 40, sR: -150, eR: -40, hL: 10, kL: 5, hR: -10, kR: 5, j: 12 },  // reach up
  { sL: -40, eL: -50, sR: 40, eR: 50, hL: -20, kL: 30, hR: 20, kR: 30, j: 10 },  // groove
  { sL: 20, eL: 30, sR: -160, eR: -20, hL: 5, kL: 0, hR: -5, kR: 0, j: 16 },     // point up
  { sL: -60, eL: -30, sR: 60, eR: 30, hL: -30, kR: 0, kL: 0, hR: 30, j: 8 },     // wide
  { sL: 40, eL: 50, sR: -40, eR: -50, hL: -50, kL: 60, hR: 10, kR: 5, j: 14 },   // kick
  { sL: -20, eL: -60, sR: -140, eR: -30, hL: 15, kL: 20, hR: -15, kR: 20, j: 10 },// wave
]

function DancingFigure({ progress, playing, activeNote, noteIndex, pitchNorm }) {
  const [pose, setPose] = useState(null)

  useEffect(() => {
    if (!activeNote || noteIndex < 0) {
      setPose(null)
      return
    }
    const p = POSES[noteIndex % POSES.length]
    const v = 0.5 + activeNote.velocity * 0.5
    // pitchNorm: 0=low, 1=high — high notes = more upward energy, low = grounded
    const pn = pitchNorm ?? 0.5
    const upScale = 0.6 + pn * 0.6       // high notes amplify arms up
    const groundScale = 0.6 + (1 - pn) * 0.6  // low notes amplify legs

    setPose({
      sL: p.sL * v * upScale, eL: p.eL * v * upScale,
      sR: p.sR * v * upScale, eR: p.eR * v * upScale,
      hL: p.hL * v * groundScale, kL: p.kL * v * groundScale,
      hR: p.hR * v * groundScale, kR: p.kR * v * groundScale,
      j: p.j * v * (0.5 + pn * 0.8),  // high notes = bigger jump
    })
  }, [activeNote, noteIndex, pitchNorm])

  if (!playing) return null

  const p = pose || { sL: 0, eL: 0, sR: 0, eR: 0, hL: 5, kL: 0, hR: -5, kR: 0, j: 0 }

  // Body geometry
  const hipY = 0
  const shoulderY = -16
  const headY = shoulderY - 7

  // Arms: shoulder → elbow → hand
  const [elbowLx, elbowLy] = joint(0, shoulderY, p.sL, 9)
  const [handLx, handLy] = joint(elbowLx, elbowLy, p.sL + p.eL, 8)
  const [elbowRx, elbowRy] = joint(0, shoulderY, p.sR, 9)
  const [handRx, handRy] = joint(elbowRx, elbowRy, p.sR + p.eR, 8)

  // Legs: hip → knee → foot
  const [kneeLx, kneeLy] = joint(-2, hipY, p.hL, 10)
  const [footLx, footLy] = joint(kneeLx, kneeLy, p.hL + p.kL, 9)
  const [kneeRx, kneeRy] = joint(2, hipY, p.hR, 10)
  const [footRx, footRy] = joint(kneeRx, kneeRy, p.hR + p.kR, 9)

  const sw = 1.8
  const spring = { type: 'spring', stiffness: 300, damping: 16, mass: 0.5 }

  return (
    <motion.div
      className="dancer-container"
      style={{ left: `${progress * 100}%` }}
    >
      <motion.svg
        width="44" height="56" viewBox="-22 -30 44 56" overflow="visible"
        className="dancer-svg"
        animate={{ y: -p.j }}
        transition={spring}
      >
        {/* Head */}
        <motion.circle
          r={4} fill="none" stroke="#222" strokeWidth={sw}
          animate={{ cx: 0, cy: headY }}
          transition={spring}
        />
        {/* Torso */}
        <motion.line
          stroke="#222" strokeWidth={sw} strokeLinecap="round"
          animate={{ x1: 0, y1: shoulderY, x2: 0, y2: hipY }}
          transition={spring}
        />
        {/* Left arm: shoulder→elbow */}
        <motion.line
          stroke="#222" strokeWidth={sw} strokeLinecap="round"
          animate={{ x1: 0, y1: shoulderY, x2: elbowLx, y2: elbowLy }}
          transition={spring}
        />
        {/* Left forearm: elbow→hand */}
        <motion.line
          stroke="#222" strokeWidth={sw} strokeLinecap="round"
          animate={{ x1: elbowLx, y1: elbowLy, x2: handLx, y2: handLy }}
          transition={{ ...spring, delay: 0.02 }}
        />
        {/* Right arm */}
        <motion.line
          stroke="#222" strokeWidth={sw} strokeLinecap="round"
          animate={{ x1: 0, y1: shoulderY, x2: elbowRx, y2: elbowRy }}
          transition={spring}
        />
        <motion.line
          stroke="#222" strokeWidth={sw} strokeLinecap="round"
          animate={{ x1: elbowRx, y1: elbowRy, x2: handRx, y2: handRy }}
          transition={{ ...spring, delay: 0.02 }}
        />
        {/* Left leg: hip→knee */}
        <motion.line
          stroke="#222" strokeWidth={sw} strokeLinecap="round"
          animate={{ x1: -2, y1: hipY, x2: kneeLx, y2: kneeLy }}
          transition={spring}
        />
        {/* Left shin: knee→foot */}
        <motion.line
          stroke="#222" strokeWidth={sw} strokeLinecap="round"
          animate={{ x1: kneeLx, y1: kneeLy, x2: footLx, y2: footLy }}
          transition={{ ...spring, delay: 0.02 }}
        />
        {/* Right leg */}
        <motion.line
          stroke="#222" strokeWidth={sw} strokeLinecap="round"
          animate={{ x1: 2, y1: hipY, x2: kneeRx, y2: kneeRy }}
          transition={spring}
        />
        <motion.line
          stroke="#222" strokeWidth={sw} strokeLinecap="round"
          animate={{ x1: kneeRx, y1: kneeRy, x2: footRx, y2: footRy }}
          transition={{ ...spring, delay: 0.02 }}
        />
      </motion.svg>
    </motion.div>
  )
}

function ensureDuration(m) {
  if (!m || !m.notes || m.notes.length === 0) return m
  if (m.durationSecs) return m
  const last = m.notes.reduce((max, n) => Math.max(max, n.startTime + n.duration), 0)
  return { ...m, durationSecs: last }
}

export function MelodyModal({ blob, block, onClose }) {
  const [melody, setMelody] = useState(null)
  const [loading, setLoading] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [activeNoteIndex, setActiveNoteIndex] = useState(-1)
  const [playbackProgress, setPlaybackProgress] = useState(0)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState(null)
  const playStartRef = useRef(null)
  const rafRef = useRef(null)
  const { isConnected } = useAccount()

  const blobColor = getBlobColor(blob.blob_hash, block.block_number)
  const mapPitch = useMemo(() => makePitchMapper(melody?.notes), [melody])

  useEffect(() => {
    fetch(`${API}/api/melody/${blob.blob_hash}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.exists) setMelody(ensureDuration(data)) })
      .catch(() => {})
  }, [blob.blob_hash])

  const stopPlayback = useCallback(() => {
    stopMelody()
    setPlaying(false)
    setActiveNoteIndex(-1)
    setPlaybackProgress(0)
    playStartRef.current = null
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
  }, [])

  const trackPlayback = useCallback(() => {
    if (!playStartRef.current || !melody) return
    // Offset compensates for Web Audio API scheduling latency (~100ms lookAhead)
    const elapsed = Math.max(0, (performance.now() - playStartRef.current) / 1000 - 0.12)

    if (elapsed > melody.durationSecs + 0.5) {
      stopPlayback()
      return
    }

    setPlaybackProgress(Math.min(elapsed / melody.durationSecs, 1))

    let currentIdx = -1
    for (let i = 0; i < melody.notes.length; i++) {
      const n = melody.notes[i]
      if (elapsed >= n.startTime && elapsed < n.startTime + n.duration) {
        currentIdx = i
      }
    }
    setActiveNoteIndex(currentIdx)
    rafRef.current = requestAnimationFrame(trackPlayback)
  }, [melody, stopPlayback])

  useEffect(() => () => {
    stopMelody()
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
  }, [])

  // Poll for melody when none exists (purchased via CLI)
  useEffect(() => {
    if (melody) return
    const interval = setInterval(() => {
      fetch(`${API}/api/melody/${blob.blob_hash}`)
        .then(r => r.ok ? r.json() : null)
        .then(data => { if (data?.exists) setMelody(ensureDuration(data)) })
        .catch(() => {})
    }, 3000)
    return () => clearInterval(interval)
  }, [blob.blob_hash, melody])

  const generate = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API}/api/melody`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blob_hash: blob.blob_hash }),
      })
      if (!res.ok) throw new Error(`Failed: ${res.status}`)
      setMelody(ensureDuration(await res.json()))
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const play = async () => {
    if (playing) { stopPlayback(); return }
    setPlaying(true)
    const audioStart = await playMelody(melody.notes, melody.bpm)
    playStartRef.current = audioStart
    rafRef.current = requestAnimationFrame(trackPlayback)
  }

  return (
    <motion.div
      className="modal-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      onClick={onClose}
    >
      <motion.div
        className="modal-content"
        initial={{ opacity: 0, y: 40, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 40, scale: 0.96 }}
        transition={{ type: 'spring', damping: 28, stiffness: 340 }}
        onClick={e => e.stopPropagation()}
      >
          <div className="modal-body">
            <div className="blob-info-grid">
              <div className="info-cell">
                <span className="info-label">Blob</span>
                <a className="info-value mono info-link" href={`https://blobscan.com/blob/${blob.blob_hash}`} target="_blank" rel="noopener">{blob.blob_hash.slice(0, 10)}...{blob.blob_hash.slice(-8)}</a>
              </div>
              <div className="info-cell">
                <span className="info-label">Block</span>
                <span className="info-value">{block.block_number ? `#${block.block_number.toLocaleString()}` : '—'}</span>
              </div>
              <div className="info-cell">
                <span className="info-label">Sender</span>
                <span className="info-value mono">{blob.sender?.slice(0, 10)}...{blob.sender?.slice(-4)}</span>
              </div>
            </div>

            {melody ? (
              <div className="melody-section">
                <div className="melody-meta">
                  <span className="meta-pill">{melody.bpm} BPM</span>
                  <span className="meta-pill">{melody.scale}</span>
                  <span className="meta-pill">{melody.notes.length} notes</span>
                </div>

                {/* Visualizer */}
                <div
                  className={`visualizer ${playing ? 'is-playing' : ''}`}
                  style={{ '--blob-accent': blobColor.css }}
                >
                  {/* Playhead line */}
                  {playing && (
                    <div
                      className="playhead"
                      style={{ left: `${playbackProgress * 100}%` }}
                    />
                  )}

                  {/* Dancing stickman */}
                  <DancingFigure
                    progress={playbackProgress}
                    playing={playing}
                    activeNote={activeNoteIndex >= 0 ? melody.notes[activeNoteIndex] : null}
                    noteIndex={activeNoteIndex}
                    pitchNorm={activeNoteIndex >= 0 && mapPitch ? mapPitch(melody.notes[activeNoteIndex].pitch) : 0.5}
                  />

                  {/* Note columns */}
                  {melody.notes.map((note, i) => {
                    const y = mapPitch ? mapPitch(note.pitch) : 0.5
                    const totalDur = melody.durationSecs || 1
                    const left = (note.startTime / totalDur) * 100
                    const w = Math.max((note.duration / totalDur) * 100, 2)
                    const isActive = i === activeNoteIndex
                    const isPast = playing && playbackProgress > (note.startTime + note.duration) / totalDur

                    return (
                      <motion.div
                        key={i}
                        className={`viz-note ${isActive ? 'active' : ''} ${isPast ? 'past' : ''}`}
                        style={{
                          left: `${left}%`,
                          width: `${w}%`,
                          bottom: `${y * 70 + 10}%`,
                          height: `${Math.max(note.velocity * 16 + 6, 8)}px`,
                          backgroundColor: blobColor.css,
                          opacity: isActive ? 1 : isPast ? 0.3 : 0.7,
                        }}
                        animate={isActive ? {
                          scale: [1, 1.3, 1],
                          opacity: [1, 1, 1],
                        } : {}}
                        transition={{ duration: 0.2 }}
                      />
                    )
                  })}
                </div>

                <div className="play-row">
                  <button
                    className={`play-btn ${playing ? 'playing' : ''}`}
                    onClick={play}
                    style={playing ? { backgroundColor: blobColor.css, borderColor: blobColor.css } : {}}
                  >
                    {playing ? (
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><rect x="3" y="2" width="4" height="12" rx="1"/><rect x="9" y="2" width="4" height="12" rx="1"/></svg>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M4 2v12l10-6z"/></svg>
                    )}
                  </button>
                  <div className="play-info">
                    <span className="play-label">{playing ? 'Playing...' : 'Play melody'}</span>
                    <span className="play-duration">{(melody.durationSecs || 0).toFixed(1)}s</span>
                  </div>
                </div>

                <div className="melody-footer">
                  <span className="tempo-badge">Paid via Tempo · $0.03</span>
                  {melody.tx_hash && (
                    <a
                      className="tx-link"
                      href={`https://explorer.tempo.xyz/tx/${melody.tx_hash}`}
                      target="_blank"
                      rel="noopener"
                    >
                      tx {melody.tx_hash.slice(0, 8)}...{melody.tx_hash.slice(-4)}
                    </a>
                  )}
                </div>
              </div>
            ) : (
              <div className="generate-section">
                <div className="generate-visual">
                  <div className="generate-bars">
                    {Array.from({ length: 12 }).map((_, i) => (
                      <motion.div
                        key={i}
                        className="generate-bar"
                        style={{ backgroundColor: blobColor.css }}
                        animate={{ height: loading ? [8, 24 + Math.random() * 20, 8] : [8, 14, 8] }}
                        transition={{ duration: loading ? 0.8 : 2, repeat: Infinity, delay: i * (loading ? 0.07 : 0.12), ease: 'easeInOut' }}
                      />
                    ))}
                  </div>
                  <p className="generate-prompt">{loading ? 'generating melody...' : 'no melody yet'}</p>
                </div>

                {isConnected ? (
                  <button
                    className="generate-btn"
                    onClick={generate}
                    disabled={loading}
                  >
                    {loading ? 'Generating...' : 'Generate Melody'}
                  </button>
                ) : (
                  <p className="generate-hint">sign in to generate, or use CLI:</p>
                )}

                <div
                  className="cli-command"
                  onClick={() => {
                    navigator.clipboard.writeText(`tempo request -X POST --json '{"blob_hash":"${blob.blob_hash}"}' '${API}/api/melody'`)
                    setCopied(true)
                    setTimeout(() => setCopied(false), 2000)
                  }}
                >
                  <code>tempo request -X POST --json '{`{"blob_hash":"${blob.blob_hash.slice(0, 12)}..."}`}' /api/melody</code>
                  <span className="cli-copy">{copied ? 'copied!' : 'copy'}</span>
                </div>
                {error && <p className="error">{error}</p>}
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
  )
}
