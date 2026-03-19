import { useState, useEffect, useCallback } from 'react'
import { AnimatePresence } from 'framer-motion'
import { WalletConnect } from './components/WalletConnect'
import { BlockGrid } from './components/BlockGrid'
import { MelodyModal } from './components/MelodyModal'
import { stopMelody } from './lib/audio'

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001'

function App() {
  const [blocks, setBlocks] = useState([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(false)
  const [selectedBlob, setSelectedBlob] = useState(null)
  const [selectedBlock, setSelectedBlock] = useState(null)

  const fetchBlocks = useCallback((p) => {
    setLoading(true)
    fetch(`${API}/api/blocks?page=${p}`)
      .then(r => r.json())
      .then(data => {
        // Support both old format (array) and new format (paginated object)
        if (Array.isArray(data)) {
          setBlocks(data)
        } else {
          setBlocks(data.blocks)
          setTotalPages(data.totalPages)
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { fetchBlocks(page) }, [page, fetchBlocks])

  // SSE for live updates (only on page 1)
  useEffect(() => {
    if (page !== 1) return
    const source = new EventSource(`${API}/api/blocks/stream`)
    source.onmessage = (e) => {
      const newBlocks = JSON.parse(e.data)
      setBlocks(prev => {
        const existingNums = new Set(prev.map(b => b.block_number))
        const fresh = newBlocks.filter(b => !existingNums.has(b.block_number))
        if (fresh.length === 0) return prev
        return [...fresh, ...prev].slice(0, 25)
      })
    }
    return () => source.close()
  }, [page])

  const handleBlobClick = (blob, block) => {
    setSelectedBlob(blob)
    setSelectedBlock(block)
  }

  return (
    <div className="app">
      <div className="app-topbar">
        <header className="app-header">
          <h1 className="app-title">blossom</h1>
          <p className="app-subtitle">hear the blobs</p>
        </header>
        <WalletConnect />
      </div>

      <BlockGrid blocks={blocks} onBlobClick={handleBlobClick} loading={loading} />

      {totalPages > 1 && (
        <div className="pagination">
          <button
            className="page-btn"
            disabled={page <= 1}
            onClick={() => setPage(p => p - 1)}
          >
            ← Newer
          </button>
          <span className="page-info">{page} / {totalPages}</span>
          <button
            className="page-btn"
            disabled={page >= totalPages}
            onClick={() => setPage(p => p + 1)}
          >
            Older →
          </button>
        </div>
      )}

      <AnimatePresence>
        {selectedBlob && (
          <MelodyModal
            key={selectedBlob.blob_hash}
            blob={selectedBlob}
            block={selectedBlock}
            onClose={() => { stopMelody(); setSelectedBlob(null); setSelectedBlock(null) }}
          />
        )}
      </AnimatePresence>

      <footer className="site-footer">
        built by <a href="https://x.com/figtracer" target="_blank" rel="noopener">@fig</a> using <a href="https://tempo.xyz" target="_blank" rel="noopener">@Tempo</a> and <a href="https://github.com/paradigmxyz/reth" target="_blank" rel="noopener">Reth</a> (<a href="https://github.com/figtracer/reth-blob-exex" target="_blank" rel="noopener">blob-exex</a>)
      </footer>
    </div>
  )
}

export default App
