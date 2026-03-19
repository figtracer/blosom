import { motion } from 'framer-motion'

export function BlobSquare({ blob, hasMelody, onClick }) {
  const hash = blob.blob_hash.slice(2)
  const r = parseInt(hash.slice(0, 2), 16)
  const g = parseInt(hash.slice(2, 4), 16)
  const b = parseInt(hash.slice(4, 6), 16)
  const hue = 220 + (r % 60)
  const sat = 50 + (g % 30)
  const lum = 55 + (b % 15)
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
      whileHover={{ scale: 1.2 }}
      whileTap={{ scale: 0.9 }}
      onClick={onClick}
      title={blob.blob_hash.slice(0, 18) + '...'}
    >
      {hasMelody && (
        <span className="melody-icon">
          <svg width="12" height="12" viewBox="0 0 16 16" fill="white">
            <path d="M14 1v9.5a2.5 2.5 0 1 1-2-2.45V3.72L6 5.05v7.45a2.5 2.5 0 1 1-2-2.45V2.5a.5.5 0 0 1 .36-.48l8-2.33A.5.5 0 0 1 14 1z" opacity="0.95"/>
          </svg>
        </span>
      )}
    </motion.button>
  )
}
