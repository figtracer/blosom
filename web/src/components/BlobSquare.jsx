import { motion } from 'framer-motion'

export function BlobSquare({ blob, hasMelody, onClick, palette }) {
  const hash = blob.blob_hash.slice(2)
  const r = parseInt(hash.slice(0, 2), 16)
  const g = parseInt(hash.slice(2, 4), 16)
  const b = parseInt(hash.slice(4, 6), 16)

  // use block palette hue range, vary within it per blob
  const hueOffset = (r + g) % 30 - 15
  const hue = palette.hue + hueOffset
  const sat = hasMelody ? 15 : palette.sat + (g % 15) - 7
  const lum = hasMelody ? 75 : palette.lum + (b % 12) - 6
  const color = `hsl(${hue}, ${sat}%, ${lum}%)`
  const glowColor = `hsla(${hue}, ${sat}%, ${lum}%, 0.4)`

  return (
    <motion.button
      className={`blob-square ${hasMelody ? 'has-melody' : ''}`}
      style={{
        backgroundColor: color,
        '--blob-glow': glowColor,
        '--blob-color': color,
      }}
      whileHover={{ scale: 1.12 }}
      whileTap={{ scale: 0.9 }}
      onClick={onClick}
      title={blob.blob_hash.slice(0, 18) + '...'}
    >
      {hasMelody && (
        <span className="melody-icon">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="rgba(0,0,0,0.5)">
            <path d="M14 1v9.5a2.5 2.5 0 1 1-2-2.45V3.72L6 5.05v7.45a2.5 2.5 0 1 1-2-2.45V2.5a.5.5 0 0 1 .36-.48l8-2.33A.5.5 0 0 1 14 1z"/>
          </svg>
        </span>
      )}
    </motion.button>
  )
}
