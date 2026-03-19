import { useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { BlockCard } from './BlockCard'

export function BlockGrid({ blocks, onBlobClick }) {
  const prevBlocksRef = useRef(new Set())
  const newBlockNumbers = useRef(new Set())

  useEffect(() => {
    const currentIds = new Set(blocks.map(b => b.block_number))
    const prevIds = prevBlocksRef.current

    // Mark blocks that are new (not in previous render)
    if (prevIds.size > 0) {
      newBlockNumbers.current = new Set(
        [...currentIds].filter(id => !prevIds.has(id))
      )
    }
    prevBlocksRef.current = currentIds
  }, [blocks])

  return (
    <div className="block-grid">
      <AnimatePresence>
        {blocks.map((block) => {
          const isNew = newBlockNumbers.current.has(block.block_number)
          return (
            <motion.div
              key={block.block_number}
              className={isNew ? 'block-enter-flash' : ''}
              initial={{ opacity: 0, x: -20, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.45, ease: [0.25, 0.46, 0.45, 0.94] }}
              layout
            >
              <BlockCard block={block} onBlobClick={onBlobClick} isNew={isNew} />
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
