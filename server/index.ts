import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { Mppx, tempo } from 'mppx/server'
import { Handler, Kv } from 'tempo.ts/server'
import { generateMelody } from './melody'
import { getDb, getExExDb, isExExMode } from './db'
import { seedMockData } from './mock-data'

const app = new Hono()
app.use('*', cors())

const mppx = Mppx.create({
  methods: [
    tempo({
      currency: '0x20c000000000000000000000b9537d11c60e8b50', // USDC
      recipient: process.env.RECIPIENT_ADDRESS!,
    }),
  ],
})

// --- WEBAUTHN KEY MANAGER (tempo.ts) ---
const keyManager = Handler.keyManager({
  kv: Kv.memory(),
  path: '/keys',
  rp: 'localhost',
})

// Route all /keys/* requests to the tempo.ts key manager handler
app.all('/keys/*', (c) => keyManager.fetch(c.req.raw))

// Seed mock data if DB is empty (only in standalone mode)
const db = getDb()
if (!isExExMode()) {
  const blockCount = (db.prepare('SELECT COUNT(*) as count FROM blocks').get() as any).count
  if (blockCount === 0) {
    seedMockData()
  }
} else {
  console.log(`ExEx mode: reading blocks/blobs from ${process.env.EXEX_DB_PATH}`)
}

// --- FREE ENDPOINTS ---

app.get('/api/blocks', (c) => {
  if (isExExMode()) {
    return handleBlocksExEx(c)
  }
  return handleBlocksLocal(c)
})

function handleBlocksLocal(c: any) {
  const db = getDb()
  const blocks = db.prepare(`
    SELECT b.*, json_group_array(json_object(
      'blob_hash', bl.blob_hash,
      'tx_hash', bl.tx_hash,
      'blob_index', bl.blob_index,
      'sender', bl.sender,
      'has_melody', CASE WHEN m.blob_hash IS NOT NULL THEN 1 ELSE 0 END
    )) as blobs
    FROM blocks b
    LEFT JOIN blobs bl ON b.block_number = bl.block_number
    LEFT JOIN melodies m ON bl.blob_hash = m.blob_hash
    GROUP BY b.block_number
    ORDER BY b.block_number DESC
    LIMIT 50
  `).all()

  const parsed = blocks.map((b: any) => ({
    ...b,
    blobs: JSON.parse(b.blobs)
      .filter((bl: any) => bl.blob_hash !== null)
      .map((bl: any) => ({ ...bl, has_melody: !!bl.has_melody })),
  }))

  return c.json(parsed)
}

function handleBlocksExEx(c: any) {
  const exex = getExExDb()
  const localDb = getDb()

  // Fetch blocks from blob-exex
  const blocks = exex.prepare(`
    SELECT b.block_number, b.block_timestamp, b.total_blobs as blob_count,
           b.gas_price as blob_gas_price, b.excess_blob_gas
    FROM blocks b
    ORDER BY b.block_number DESC
    LIMIT 50
  `).all() as any[]

  // Fetch blobs for each block from blob-exex
  const blobStmt = exex.prepare(`
    SELECT bh.blob_hash, bh.blob_index, bt.tx_hash, bt.sender, bt.block_number
    FROM blob_hashes bh
    JOIN blob_transactions bt ON bh.tx_hash = bt.tx_hash
    WHERE bt.block_number = ?
    ORDER BY bh.blob_index
  `)

  // Check melody existence from local DB
  const melodyStmt = localDb.prepare(`SELECT 1 FROM melodies WHERE blob_hash = ?`)

  const parsed = blocks.map((block: any) => {
    const blobs = (blobStmt.all(block.block_number) as any[]).map((bl) => ({
      blob_hash: bl.blob_hash,
      tx_hash: bl.tx_hash,
      blob_index: bl.blob_index,
      sender: bl.sender,
      has_melody: !!melodyStmt.get(bl.blob_hash),
    }))

    return { ...block, blobs }
  })

  return c.json(parsed)
}

app.get('/api/melodies', (c) => {
  const db = getDb()
  const melodies = db.prepare(`
    SELECT * FROM melodies ORDER BY created_at DESC LIMIT 100
  `).all()

  return c.json(melodies.map((m: any) => ({
    ...m,
    notes: JSON.parse(m.notes_json),
  })))
})

app.get('/api/melody/:blobHash', (c) => {
  const db = getDb()
  const melody = db.prepare(`SELECT * FROM melodies WHERE blob_hash = ?`)
    .get(c.req.param('blobHash'))

  if (!melody) return c.json({ exists: false }, 404)
  return c.json({ exists: true, ...(melody as any), notes: JSON.parse((melody as any).notes_json) })
})

// --- MPP-GATED ENDPOINT ---

app.post('/api/melody', async (c) => {
  const response = await mppx.charge({ amount: '0.03' })(c.req.raw)
  if (response.status === 402) return response.challenge

  const body = await c.req.json()
  const { blob_hash } = body

  if (!blob_hash || typeof blob_hash !== 'string') {
    return response.withReceipt(
      Response.json({ error: 'blob_hash required' }, { status: 400 })
    )
  }

  const db = getDb()

  const existing = db.prepare(`SELECT * FROM melodies WHERE blob_hash = ?`).get(blob_hash)
  if (existing) {
    return response.withReceipt(
      Response.json({
        already_exists: true,
        ...(existing as any),
        notes: JSON.parse((existing as any).notes_json),
      })
    )
  }

  const melody = generateMelody(blob_hash)
  const payerAddress = response.receipt?.source || 'unknown'

  db.prepare(`
    INSERT INTO melodies (blob_hash, notes_json, bpm, scale, payer_address)
    VALUES (?, ?, ?, ?, ?)
  `).run(blob_hash, JSON.stringify(melody.notes), melody.bpm, melody.scale, payerAddress)

  return response.withReceipt(
    Response.json({
      blob_hash,
      ...melody,
      payer_address: payerAddress,
    })
  )
})

// --- SSE: Real-time block updates ---
app.get('/api/blocks/stream', (c) => {
  return c.newResponse(
    new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder()
        let lastBlock = 0
        const interval = setInterval(() => {
          try {
            const source = isExExMode() ? getExExDb() : getDb()
            const newBlocks = source.prepare(
              'SELECT * FROM blocks WHERE block_number > ? ORDER BY block_number ASC LIMIT 10'
            ).all(lastBlock) as any[]

            if (newBlocks.length > 0) {
              lastBlock = newBlocks[newBlocks.length - 1].block_number
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify(newBlocks)}\n\n`)
              )
            }
          } catch {
            clearInterval(interval)
          }
        }, 12000)
      },
      cancel() {}
    }),
    { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' } }
  )
})

export default {
  port: parseInt(process.env.PORT || '3001'),
  fetch: app.fetch,
}
