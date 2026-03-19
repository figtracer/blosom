import { getDb } from './db'

const SENDERS = [
  { address: '0x5050f69a9786f081509234f1a7f4684b5e5b76c9', name: 'Base' },
  { address: '0x6887246668a3b87f54deb3b94ba47a6f63f32985', name: 'OP Mainnet' },
  { address: '0xa4b10ac61e79ea1e150df70b8dda53391928fd14', name: 'Arbitrum' },
  { address: '0xa1e4380a3b1f749673e270229993ee55f35663b4', name: 'Scroll' },
  { address: '0x2c169dfe5fbba12957bdd0ba47d9cedbfe260ca7', name: 'Starknet' },
  { address: '0x625726c858dbf78c0125436c943bf4b4be9d9033', name: 'zkSync' },
  { address: '0xc1b634853cb333d3ad8663715b08f41a3aec47cc', name: 'Arbitrum Nova' },
]

function randomHash(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return '0x' + Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
}

export function seedMockData(startBlock = 21_800_000, count = 30) {
  const db = getDb()
  const now = Math.floor(Date.now() / 1000)

  const insertBlock = db.prepare(
    `INSERT OR IGNORE INTO blocks (block_number, block_timestamp, blob_count, blob_gas_price, excess_blob_gas)
     VALUES (?, ?, ?, ?, ?)`
  )
  const insertBlob = db.prepare(
    `INSERT INTO blobs (block_number, tx_hash, blob_hash, blob_index, sender)
     VALUES (?, ?, ?, ?, ?)`
  )

  const tx = db.transaction(() => {
    for (let i = 0; i < count; i++) {
      const blockNum = startBlock + i
      const timestamp = now - (count - i) * 12
      const blobCount = 1 + Math.floor(Math.random() * 6)
      const gasPrice = (1 + Math.random() * 50).toFixed(0)

      insertBlock.run(blockNum, timestamp, blobCount, gasPrice, '0')

      let blobIdx = 0
      let remaining = blobCount
      while (remaining > 0) {
        const txBlobCount = Math.min(remaining, 1 + Math.floor(Math.random() * 3))
        const txHash = randomHash()
        const sender = SENDERS[Math.floor(Math.random() * SENDERS.length)]

        for (let j = 0; j < txBlobCount; j++) {
          insertBlob.run(blockNum, txHash, randomHash(), blobIdx++, sender.address)
        }
        remaining -= txBlobCount
      }
    }
  })

  tx()
  console.log(`Seeded ${count} blocks with mock blob data`)
}
