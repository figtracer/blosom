import { BlobSquare } from './BlobSquare'

function relativeTime(timestamp) {
  if (!timestamp) return ''
  const now = Date.now()
  const then = typeof timestamp === 'number'
    ? (timestamp < 1e12 ? timestamp * 1000 : timestamp)
    : new Date(timestamp).getTime()
  const diffSec = Math.floor((now - then) / 1000)

  if (diffSec < 5) return 'just now'
  if (diffSec < 60) return `${diffSec}s ago`
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `${diffMin} min ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  return `${Math.floor(diffHr / 24)}d ago`
}

export function BlockCard({ block, onBlobClick, isNew }) {
  const blobs = block.blobs || []
  const melodyCount = blobs.filter(b => b.has_melody).length

  return (
    <div className={`block-card ${isNew ? 'block-card-new' : ''}`}>
      <div className="block-header">
        <div className="block-header-left">
          <span className="block-number">#{block.block_number.toLocaleString()}</span>
          {block.block_timestamp && (
            <span className="block-timestamp">{relativeTime(block.block_timestamp)}</span>
          )}
        </div>
        <div className="block-header-right">
          {melodyCount > 0 && (
            <span className="block-melody-badge">
              <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor">
                <path d="M14 1v9.5a2.5 2.5 0 1 1-2-2.45V3.72L6 5.05v7.45a2.5 2.5 0 1 1-2-2.45V2.5a.5.5 0 0 1 .36-.48l8-2.33A.5.5 0 0 1 14 1z"/>
              </svg>
              {melodyCount}
            </span>
          )}
          <span className="blob-count">{blobs.length} blob{blobs.length !== 1 ? 's' : ''}</span>
        </div>
      </div>
      <div className="blob-grid">
        {blobs.map((blob) => (
          <BlobSquare
            key={blob.blob_hash}
            blob={blob}
            blockNumber={block.block_number}
            hasMelody={blob.has_melody}
            onClick={() => onBlobClick(blob, block)}
          />
        ))}
      </div>
    </div>
  )
}
