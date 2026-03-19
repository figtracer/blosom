# Blob Sonification — "Hear the Blobs" — Full Build Prompt

> **Copy this entire file into your AI agent.** It contains everything needed to build the project across 3 hackathon rounds (2 hours each). No external context required.

## What We're Building

A real-time Ethereum blob visualizer where each block appears as an animated square, containing smaller squares for each blob. Users connect a Tempo wallet and **pay via MPP (Machine Payments Protocol) to generate a unique melody** from a blob's hash bytes. Generated melodies are persisted and playable by anyone — but the payer's address is permanently credited.

**Why this is cool**: Every blob that's ever been posted to Ethereum has a unique 32-byte hash. Those bytes, mapped to a pentatonic scale, produce a deterministic melody that *sounds good* and is unique to that blob. You're literally hearing the blockchain.

## Architecture

```
[Reth Node + blob-exex]          (optional, provides real block/blob data)
        ↓ writes
    [SQLite DB]
        ↓ reads
[Hono API Server]                 (serves block data + MPP-gated melody generation)
   ├── GET  /api/blocks           (free — recent blocks with blob data)
   ├── GET  /api/melodies         (free — all generated melodies)
   ├── POST /api/melody           (MPP-gated — generate melody from blob hash)
   └── WS   /ws/blocks            (free — real-time block push)
        ↓ consumed by
[React Frontend]                  (Vite + Tone.js + Framer Motion)
   ├── Ultra-minimal: white bg, no header/nav, just the grid
   ├── Block grid with blob squares (animated)
   ├── Melody playback (Tone.js)
   ├── Wallet pill (top-right corner, fixed)
   └── Modal for blob details + melody generation
```

## Links & Resources

- **Hackathon**: https://hackathon.tempo.xyz/
- **MPP Protocol**: https://mpp.dev
- **mppx SDK (TypeScript)**: https://github.com/wevm/mppx — `npm i mppx`
- **mpp-rs (Rust SDK)**: https://github.com/tempoxyz/mpp-rs
- **MPP spec (IETF)**: https://paymentauth.org
- **Tempo docs**: https://docs.tempo.xyz
- **Tempo CLI install**: `curl -fsSL https://tempo.xyz/install | bash`
- **Tempo faucet (testnet)**: https://docs.tempo.xyz/quickstart/faucet
- **Tempo wallet guide**: https://docs.tempo.xyz/cli/wallet
- **Tempo machine payments guide**: https://docs.tempo.xyz/guides/machine-payments
- **Tempo connection details**: https://docs.tempo.xyz/quickstart/connection-details
- **blob-exex repo**: https://github.com/figtracer/reth-blob-exex
- **blob-exex local path**: `../../other/blob-exex`
- **Tone.js**: https://tonejs.github.io/

---

## MPP Crash Course (Read This First)

MPP (Machine Payments Protocol) enables pay-per-request APIs using HTTP 402. Co-authored by **Tempo and Stripe**.

### The 402 Flow
1. Client calls a paid endpoint
2. Server returns **HTTP 402** with `WWW-Authenticate: Payment ...` header (the "challenge")
3. Client's mppx SDK automatically processes payment (TIP-20 stablecoin transfer on Tempo chain, ~500ms)
4. Client retries the request with `Authorization: Payment <credential>` header
5. Server verifies payment, returns data with `Payment-Receipt` header

### Key: mppx Makes This Transparent
On the **server**, you wrap endpoints with `mppx.charge()`. On the **client**, you call `Mppx.create()` once and then normal `fetch()` calls auto-handle 402 responses. The payment flow is invisible to your application code.

### Server Setup (Hono)
```typescript
import { Mppx, tempo } from 'mppx/server'

const mppx = Mppx.create({
  methods: [
    tempo({
      currency: '0x20c0000000000000000000000000000000000000', // pathUSD
      recipient: '0xYOUR_ADDRESS_HERE', // where payments go
    }),
  ],
})

// In a Hono route:
app.post('/api/melody', async (c) => {
  const response = await mppx.charge({ amount: '0.03' })(c.req.raw)
  if (response.status === 402) return response.challenge
  // Payment verified — do the work
  const result = generateMelody(...)
  return response.withReceipt(Response.json(result))
})
```

### Client Setup (Browser — Wagmi + Passkeys + mppx)

Tempo's native wallet uses **passkeys (WebAuthn)** — users sign up/in with biometrics (fingerprint, Face ID, Touch ID). No browser extension needed. You can also support MetaMask/OKX for users who already have EVM wallets. **No private keys anywhere.**

```typescript
// lib/wagmi.ts — Wagmi config with Tempo passkeys + optional MetaMask
import { createConfig, http } from 'wagmi'
import { tempoModerato } from 'viem/chains'        // testnet; use `tempo` for mainnet
import { webAuthn, KeyManager } from 'wagmi/tempo'  // Tempo passkey connector
import { metaMask } from 'wagmi/connectors'          // optional: for EVM wallet users

export const config = createConfig({
  chains: [tempoModerato],
  connectors: [
    webAuthn({
      keyManager: KeyManager.localStorage(), // use KeyManager.http() in production
    }),
    metaMask(),  // optional fallback for existing EVM wallet users
  ],
  multiInjectedProviderDiscovery: true,
  transports: {
    [tempoModerato.id]: http(),
  },
})
```

```typescript
// lib/mppx-client.ts — Initialize mppx with wagmi connector (no private key!)
import { Mppx, tempo } from 'mppx/client'
import { getConnectorClient } from 'wagmi/actions'
import { config } from './wagmi'

export function initMppx() {
  Mppx.create({
    methods: [tempo({
      getClient: (parameters) => getConnectorClient(config, parameters),
    })],
  })
}
// After calling initMppx(), all fetch() calls auto-handle 402 using the connected wallet
```

```typescript
// Now ALL fetch() calls auto-handle 402 — wallet signs the payment
const res = await fetch('https://your-api.com/api/melody', {
  method: 'POST',
  body: JSON.stringify({ blob_hash: '0x...' }),
})
// ^ If the server returns 402, mppx gets the wallet to sign a payment and retries
```

### CLI Testing
```bash
# Create a testnet wallet (funded automatically)
npx mppx account create

# Make a paid request from terminal
npx mppx http://localhost:3000/api/melody -X POST -d '{"blob_hash":"0xabc..."}'
```

---

## Design Direction

**Ultra-minimal. White background. No header. No nav. Just the grid and a wallet button.**

Inspired by [tempo.xyz](https://tempo.xyz) and the [Reth Snapshots](https://reth.ethereum.org/snapshots) page — clean, spacious, light, confident. The content IS the interface.

### Layout
- No header, no footer, no sidebar
- Wallet connect: small pill in the top-right corner, fixed position
- Block grid: centered, filling the viewport
- Modal: centered overlay with backdrop blur
- Generous whitespace everywhere

### Color Scheme

```css
:root {
  /* Backgrounds */
  --bg-primary: #ffffff;
  --bg-secondary: #fafafa;
  --bg-card: #ffffff;
  --bg-hover: #f5f5f5;
  --bg-modal-backdrop: rgba(0, 0, 0, 0.4);

  /* Borders */
  --border-primary: #e5e5e5;
  --border-secondary: #d4d4d4;
  --border-accent: #3b82f6;

  /* Text */
  --text-primary: #0a0a0a;
  --text-secondary: #525252;
  --text-tertiary: #a3a3a3;
  --text-muted: #d4d4d4;

  /* Accents — blue to purple, same energy as blob-exex but on white */
  --accent-blue: #3b82f6;
  --accent-indigo: #4f46e5;
  --accent-purple: #6366f1;
  --accent-purple-hover: #8b5cf6;
  --accent-cyan: #22d3ee;

  /* Fonts — clean sans-serif like Reth Snapshots */
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
  --font-mono: 'JetBrains Mono', 'SF Mono', 'Fira Code', monospace;

  /* Spacing */
  --radius: 12px;
  --radius-sm: 8px;
}
```

### Typography
- Block numbers: `font-mono`, 13px, `--text-secondary`
- Blob count badges: 11px, `--text-tertiary`
- Modal headings: 18px, 600 weight
- Everything else: 14px, normal weight
- No bold unless it's a heading

---

## Phase 1: MPP Melody API (Round 1 — 2 hours)

**Goal**: A standalone Hono + Bun server that accepts blob hashes, generates deterministic melodies, charges via MPP, and persists results.

### 1.1 Project Setup

```bash
mkdir blob-sonify && cd blob-sonify
mkdir -p server web

# Server
cd server
bun init -y
bun add hono mppx viem better-sqlite3
bun add -d @types/better-sqlite3
```

**File structure:**
```
server/
├── index.ts          # Hono app + routes
├── melody.ts         # Blob hash → melody algorithm
├── db.ts             # SQLite schema + queries
├── mock-data.ts      # Seed block/blob data (for before node syncs)
└── types.ts          # Shared types
```

### 1.2 Database Schema (`server/db.ts`)

```sql
-- Blocks with blob data (populated by ExEx or mock data)
CREATE TABLE IF NOT EXISTS blocks (
  block_number INTEGER PRIMARY KEY,
  block_timestamp INTEGER NOT NULL,
  blob_count INTEGER NOT NULL,
  blob_gas_price TEXT,
  excess_blob_gas TEXT
);

-- Individual blobs
CREATE TABLE IF NOT EXISTS blobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  block_number INTEGER NOT NULL,
  tx_hash TEXT NOT NULL,
  blob_hash TEXT NOT NULL,
  blob_index INTEGER NOT NULL,
  sender TEXT NOT NULL,
  FOREIGN KEY (block_number) REFERENCES blocks(block_number)
);

-- Generated melodies (the paid product)
CREATE TABLE IF NOT EXISTS melodies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  blob_hash TEXT NOT NULL UNIQUE,
  notes_json TEXT NOT NULL,       -- JSON array of note objects
  bpm INTEGER NOT NULL,
  scale TEXT NOT NULL,
  payer_address TEXT NOT NULL,    -- who paid for this melody
  tx_hash TEXT,                   -- MPP payment tx hash
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_blobs_block ON blobs(block_number);
CREATE INDEX IF NOT EXISTS idx_blobs_hash ON blobs(blob_hash);
CREATE INDEX IF NOT EXISTS idx_melodies_blob ON melodies(blob_hash);
```

### 1.3 Melody Generation Algorithm (`server/melody.ts`)

This is the core creative algorithm. It maps 32 bytes of a blob hash to a 16-note melody on a pentatonic scale (which always sounds pleasant regardless of input).

```typescript
export interface Note {
  pitch: string      // e.g. "C4", "G5"
  duration: number   // in seconds
  velocity: number   // 0.0 - 1.0
  startTime: number  // offset in seconds from melody start
}

export interface Melody {
  notes: Note[]
  bpm: number
  scale: string
  durationSecs: number
}

// Pentatonic scales — always consonant, impossible to sound bad
const SCALES: Record<string, number[]> = {
  'C major pentatonic':  [0, 2, 4, 7, 9],    // C D E G A
  'A minor pentatonic':  [0, 3, 5, 7, 10],   // A C D E G
  'D major pentatonic':  [2, 4, 6, 9, 11],   // D E F# A B
  'E minor pentatonic':  [4, 7, 9, 11, 14],  // E G A B D
}
const SCALE_NAMES = Object.keys(SCALES)

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

// Duration options in beats (at given BPM)
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

  // Derive musical parameters from hash bytes
  const scaleIdx = bytes[28] % SCALE_NAMES.length
  const scaleName = SCALE_NAMES[scaleIdx]
  const scale = SCALES[scaleName]

  const bpm = 90 + (bytes[29] % 80) // 90-169 BPM
  const beatDuration = 60 / bpm

  // Generate 16 notes from first 16 bytes
  const notes: Note[] = []
  let currentTime = 0

  for (let i = 0; i < 16; i++) {
    const b = bytes[i]

    // Pick note from scale
    const scaleNote = scale[b % scale.length]
    const semitone = scaleNote % 12
    const octave = 3 + Math.floor(b / 85) // maps 0-255 → octave 3-5
    const octaveClamped = Math.min(Math.max(octave, 3), 5)
    const pitch = `${NOTE_NAMES[semitone]}${octaveClamped}`

    // Duration from complementary byte
    const durIdx = bytes[16 + (i % 16)] % DURATIONS.length
    const durationBeats = DURATIONS[durIdx]
    const durationSecs = durationBeats * beatDuration

    // Velocity (dynamics) from the byte value
    const velocity = 0.3 + (b / 255) * 0.6 // 0.3 - 0.9

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
```

**Properties:**
- Deterministic: same blob hash always produces the same melody
- Pleasant: pentatonic scale guarantees consonance
- Varied: different hashes produce audibly different melodies (different scales, tempos, rhythms)
- Short: 16 notes, ~5-15 seconds depending on BPM/durations

### 1.4 API Server (`server/index.ts`)

```typescript
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { Mppx, tempo } from 'mppx/server'
import { generateMelody } from './melody'
import { getDb } from './db'

const app = new Hono()
app.use('*', cors())

const mppx = Mppx.create({
  methods: [
    tempo({
      currency: '0x20c0000000000000000000000000000000000000', // pathUSD
      recipient: process.env.RECIPIENT_ADDRESS!,
    }),
  ],
})

// --- FREE ENDPOINTS ---

// Recent blocks with blob data
app.get('/api/blocks', (c) => {
  const db = getDb()
  const blocks = db.prepare(`
    SELECT b.*, json_group_array(json_object(
      'blob_hash', bl.blob_hash,
      'tx_hash', bl.tx_hash,
      'blob_index', bl.blob_index,
      'sender', bl.sender
    )) as blobs
    FROM blocks b
    LEFT JOIN blobs bl ON b.block_number = bl.block_number
    GROUP BY b.block_number
    ORDER BY b.block_number DESC
    LIMIT 50
  `).all()

  // Parse the blobs JSON string back to array
  const parsed = blocks.map((b: any) => ({
    ...b,
    blobs: JSON.parse(b.blobs).filter((bl: any) => bl.blob_hash !== null),
  }))

  return c.json(parsed)
})

// All generated melodies (gallery)
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

// Single melody by blob hash
app.get('/api/melody/:blobHash', (c) => {
  const db = getDb()
  const melody = db.prepare(`SELECT * FROM melodies WHERE blob_hash = ?`)
    .get(c.req.param('blobHash'))

  if (!melody) return c.json({ exists: false }, 404)
  return c.json({ exists: true, ...(melody as any), notes: JSON.parse((melody as any).notes_json) })
})

// --- MPP-GATED ENDPOINT ---

// Generate melody from blob hash — costs $0.03
app.post('/api/melody', async (c) => {
  const response = await mppx.charge({ amount: '0.03' })(c.req.raw)
  if (response.status === 402) return response.challenge

  // Payment verified — generate the melody
  const body = await c.req.json()
  const { blob_hash } = body

  if (!blob_hash || typeof blob_hash !== 'string') {
    return response.withReceipt(
      Response.json({ error: 'blob_hash required' }, { status: 400 })
    )
  }

  const db = getDb()

  // Check if melody already exists
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

  // Generate melody
  const melody = generateMelody(blob_hash)

  // Extract payer address from the MPP credential/receipt
  // The payer info is available in the response context
  const payerAddress = response.receipt?.source || 'unknown'

  // Persist
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

export default {
  port: parseInt(process.env.PORT || '3001'),
  fetch: app.fetch,
}
```

### 1.5 Mock Data (`server/mock-data.ts`)

Since the node won't be synced immediately, seed the DB with realistic recent block data so the frontend has something to display.

```typescript
import { getDb } from './db'

// Real blob sender addresses (L2 rollups)
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
      const timestamp = now - (count - i) * 12  // ~12s per block
      const blobCount = 1 + Math.floor(Math.random() * 6) // 1-6 blobs
      const gasPrice = (1 + Math.random() * 50).toFixed(0) // gwei

      insertBlock.run(blockNum, timestamp, blobCount, gasPrice, '0')

      let blobIdx = 0
      // Group blobs into 1-3 transactions
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
```

### 1.6 Testing Round 1

```bash
# Start the server
cd server && bun run index.ts

# Test free endpoints
curl http://localhost:3001/api/blocks | jq
curl http://localhost:3001/api/melodies | jq

# Test paid endpoint with mppx CLI
npx mppx account create  # creates testnet wallet
npx mppx http://localhost:3001/api/melody -X POST \
  -H 'Content-Type: application/json' \
  -d '{"blob_hash":"0x01a0d4e1f2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9"}'
```

**Round 1 deliverable**: A working MPP-gated API that generates and persists melodies from blob hashes. Anyone can test it from the CLI.

---

## Phase 2: Blob Visualizer Frontend (Round 2 — 2 hours)

**Goal**: React app that displays blocks as animated squares, plays melodies via Tone.js, and handles Tempo wallet connection + MPP payments.

### 2.1 Project Setup

```bash
cd ../web
npm create vite@latest . -- --template react
npm install tone framer-motion viem mppx wagmi @tanstack/react-query
```

**File structure:**
```
web/src/
├── App.jsx              # Main layout + data fetching
├── main.jsx             # Entry point + wagmi WagmiProvider + QueryClientProvider
├── index.css            # Global styles (blob-exex color scheme)
├── lib/
│   ├── wagmi.ts            # Wagmi config (Tempo chain + connectors)
│   └── mppx-client.ts     # mppx init with wagmi getConnectorClient
├── components/
│   ├── WalletConnect.jsx   # Wagmi connect button (no private keys!)
│   ├── BlockGrid.jsx       # Grid of block cards
│   ├── BlockCard.jsx       # Single block with blob squares inside
│   ├── BlobSquare.jsx      # Individual blob square (clickable)
│   ├── MelodyPlayer.jsx    # Tone.js playback + visualization
│   ├── MelodyModal.jsx     # Modal: blob details + generate/play melody
│   └── Gallery.jsx         # All generated melodies
├── hooks/
│   ├── useBlocks.js        # Fetch + poll blocks from API
│   └── useMelody.js        # Fetch/generate melody (handles MPP)
└── lib/
    ├── audio.js            # Tone.js synth setup + playback
    └── constants.js        # API URL, chain identification
```

### 2.2 App Entry Point (`main.jsx`)

Wrap the app with wagmi + React Query providers:

```jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { WagmiProvider } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { config } from './lib/wagmi'
import App from './App'
import './index.css'

const queryClient = new QueryClient()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </WagmiProvider>
  </React.StrictMode>
)
```

### 2.3 Wallet Connection (`WalletConnect.jsx`)

Supports two connection methods:
- **Passkeys (Tempo native)** — user taps "Sign Up" (creates account with biometrics) or "Sign In" (existing account). Best UX, no extension needed.
- **MetaMask/OKX** — for users who already have an EVM wallet with Tempo funds.

Once connected, initializes mppx so all `fetch()` calls auto-handle MPP 402 payments.

```jsx
import { useEffect } from 'react'
import { useAccount, useConnect, useConnectors, useDisconnect } from 'wagmi'
import { initMppx } from '../lib/mppx-client'

export function WalletConnect() {
  const { address, isConnected } = useAccount()
  const connect = useConnect()
  const connectors = useConnectors()
  const { disconnect } = useDisconnect()

  // Initialize mppx once wallet is connected
  useEffect(() => {
    if (isConnected) {
      initMppx()
    }
  }, [isConnected])

  // Loading state (passkey prompt is showing)
  if (connect.isPending) {
    return <div className="wallet-connect"><span className="wallet-pending">Check biometric prompt...</span></div>
  }

  if (isConnected) {
    return (
      <div className="wallet-connected">
        <span className="wallet-dot" />
        <span className="wallet-address">
          {address?.slice(0, 6)}...{address?.slice(-4)}
        </span>
        <button className="disconnect-btn" onClick={() => disconnect()}>
          Sign out
        </button>
      </div>
    )
  }

  // Show connection options: passkey sign up/in + any EVM wallets
  const webAuthnConnector = connectors.find(c => c.id === 'webAuthn' || c.name === 'WebAuthn')
  const evmConnectors = connectors.filter(c => c.id !== 'webAuthn' && c.name !== 'WebAuthn')

  return (
    <div className="wallet-connect">
      {/* Primary: Tempo passkey auth */}
      {webAuthnConnector && (
        <>
          <button
            className="connect-btn connect-btn-primary"
            onClick={() => connect.connect({
              connector: webAuthnConnector,
              capabilities: { type: 'sign-up' },
            })}
          >
            Sign Up (Passkey)
          </button>
          <button
            className="connect-btn"
            onClick={() => connect.connect({ connector: webAuthnConnector })}
          >
            Sign In
          </button>
        </>
      )}

      {/* Secondary: EVM wallets (MetaMask, OKX, etc.) */}
      {evmConnectors.map((connector) => (
        <button
          key={connector.id}
          className="connect-btn connect-btn-secondary"
          onClick={() => connect.connect({ connector })}
        >
          {connector.name}
        </button>
      ))}

      {connect.error && (
        <p className="wallet-error">{connect.error.message}</p>
      )}
    </div>
  )
}
```

### 2.4 Block Grid (`BlockGrid.jsx`)

Blocks appear with a staggered fade-in animation. Each block card contains blob squares.

```jsx
import { motion, AnimatePresence } from 'framer-motion'
import { BlockCard } from './BlockCard'

export function BlockGrid({ blocks, onBlobClick }) {
  return (
    <div className="block-grid">
      <AnimatePresence>
        {blocks.map((block, i) => (
          <motion.div
            key={block.block_number}
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ delay: i * 0.05, duration: 0.4, ease: 'easeOut' }}
          >
            <BlockCard block={block} onBlobClick={onBlobClick} />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
```

### 2.5 Block Card with Blob Squares (`BlockCard.jsx`)

Each block is a card. Inside, blob squares are arranged in a small grid. Color derived from blob gas price.

```jsx
import { BlobSquare } from './BlobSquare'

export function BlockCard({ block, onBlobClick }) {
  return (
    <div className="block-card">
      <div className="block-header">
        <span className="block-number">#{block.block_number.toLocaleString()}</span>
        <span className="blob-count">{block.blobs.length} blobs</span>
      </div>
      <div className="blob-grid">
        {block.blobs.map((blob) => (
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
```

### 2.6 Blob Square (`BlobSquare.jsx`)

Individual blob squares. Glow if melody exists. Pulse animation on hover.

```jsx
import { motion } from 'framer-motion'

export function BlobSquare({ blob, hasMelody, onClick }) {
  // Derive color from first 3 bytes of blob hash
  // Soft pastel-to-medium tones that look great on white
  const hash = blob.blob_hash.slice(2)
  const r = parseInt(hash.slice(0, 2), 16)
  const g = parseInt(hash.slice(2, 4), 16)
  const b = parseInt(hash.slice(4, 6), 16)
  const hue = 220 + (r % 60) // 220-280 (blue → purple range)
  const sat = 50 + (g % 30)  // 50-80%
  const lum = 55 + (b % 15)  // 55-70% — lighter for white bg
  const color = `hsl(${hue}, ${sat}%, ${lum}%)`

  return (
    <motion.button
      className={`blob-square ${hasMelody ? 'has-melody' : ''}`}
      style={{ backgroundColor: color }}
      whileHover={{ scale: 1.15 }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      title={blob.blob_hash.slice(0, 18) + '...'}
    >
      {hasMelody && <span className="melody-icon">♪</span>}
    </motion.button>
  )
}
```

### 2.7 Tone.js Audio Engine (`lib/audio.js`)

```javascript
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

    // Add subtle reverb
    const reverb = new Tone.Reverb({ decay: 2.5, wet: 0.3 }).toDestination()
    synth.connect(reverb)
  }
  return synth
}

export async function playMelody(notes, bpm) {
  await Tone.start() // Required: user gesture must have triggered this call chain

  const s = getSynth()
  const now = Tone.now()

  notes.forEach((note) => {
    s.triggerAttackRelease(
      note.pitch,
      note.duration,
      now + note.startTime,
      note.velocity
    )
  })
}

export function stopMelody() {
  if (synth) {
    synth.releaseAll()
  }
}
```

### 2.8 Melody Modal (`MelodyModal.jsx`)

Appears when a blob square is clicked. Shows blob info, generate button (paid), or play button (if melody exists).

```jsx
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { playMelody, stopMelody } from '../lib/audio'

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001'

export function MelodyModal({ blob, block, onClose }) {
  const [melody, setMelody] = useState(null)
  const [loading, setLoading] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [error, setError] = useState(null)

  // Check if melody already exists
  useState(() => {
    fetch(`${API}/api/melody/${blob.blob_hash}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.exists) setMelody(data) })
  }, [blob.blob_hash])

  const generate = async () => {
    setLoading(true)
    setError(null)
    try {
      // This fetch auto-handles MPP 402 payment via mppx client
      const res = await fetch(`${API}/api/melody`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blob_hash: blob.blob_hash }),
      })
      if (!res.ok) throw new Error(`Failed: ${res.status}`)
      const data = await res.json()
      setMelody(data)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const play = async () => {
    if (playing) { stopMelody(); setPlaying(false); return }
    setPlaying(true)
    await playMelody(melody.notes, melody.bpm)
    // Auto-stop after melody duration
    setTimeout(() => setPlaying(false), melody.durationSecs * 1000 + 500)
  }

  return (
    <AnimatePresence>
      <motion.div
        className="modal-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="modal-content"
          initial={{ opacity: 0, y: 30, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 30, scale: 0.95 }}
          onClick={e => e.stopPropagation()}
        >
          <h2>Blob Details</h2>
          <div className="blob-info">
            <p><span className="label">Hash:</span> <code>{blob.blob_hash}</code></p>
            <p><span className="label">Block:</span> #{block.block_number.toLocaleString()}</p>
            <p><span className="label">Tx:</span> <code>{blob.tx_hash}</code></p>
            <p><span className="label">Sender:</span> <code>{blob.sender}</code></p>
          </div>

          {melody ? (
            <div className="melody-section">
              <div className="melody-meta">
                <span>{melody.bpm} BPM</span>
                <span>{melody.scale}</span>
                <span>Paid by {melody.payer_address?.slice(0, 8)}...</span>
              </div>
              <button
                className={`play-btn ${playing ? 'playing' : ''}`}
                onClick={play}
              >
                {playing ? '⏹ Stop' : '▶ Play Melody'}
              </button>

              {/* Note visualization */}
              <div className="note-bar">
                {melody.notes.map((note, i) => (
                  <motion.div
                    key={i}
                    className="note-pip"
                    style={{
                      height: `${note.velocity * 100}%`,
                      animationDelay: playing ? `${note.startTime}s` : '0s',
                    }}
                    animate={playing ? {
                      backgroundColor: ['var(--accent-purple)', 'var(--accent-cyan)', 'var(--accent-purple)'],
                    } : {}}
                    transition={{ duration: note.duration, delay: note.startTime }}
                  />
                ))}
              </div>
            </div>
          ) : (
            <div className="generate-section">
              <p className="generate-cost">Cost: $0.03 via Tempo wallet</p>
              <button
                className="generate-btn"
                onClick={generate}
                disabled={loading}
              >
                {loading ? 'Generating...' : '🎵 Generate Melody ($0.03)'}
              </button>
              {error && <p className="error">{error}</p>}
            </div>
          )}

          <button className="close-btn" onClick={onClose}>×</button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
```

### 2.9 Key CSS (`index.css`)

Ultra-minimal. White background. Lots of whitespace. Subtle animations. No clutter.

```css
/* Reset */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

body {
  background: var(--bg-primary);
  color: var(--text-primary);
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
  font-size: 14px;
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
}

/* ---- App Layout: just the grid, nothing else ---- */
.app {
  min-height: 100vh;
  padding: 48px 32px;
  max-width: 1200px;
  margin: 0 auto;
}

/* ---- Wallet: fixed pill, top-right corner ---- */
.wallet-connect, .wallet-connected {
  position: fixed;
  top: 20px;
  right: 24px;
  z-index: 50;
  display: flex;
  gap: 6px;
  align-items: center;
}
.connect-btn {
  background: var(--bg-primary);
  color: var(--text-primary);
  border: 1px solid var(--border-primary);
  padding: 8px 16px;
  border-radius: 999px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  transition: all 0.2s ease;
}
.connect-btn:hover { border-color: var(--text-secondary); }
.connect-btn-primary {
  background: var(--text-primary);
  color: var(--bg-primary);
  border-color: transparent;
}
.connect-btn-primary:hover { opacity: 0.85; }
.connect-btn-secondary { font-size: 12px; padding: 6px 12px; }
.wallet-connected {
  background: var(--bg-primary);
  border: 1px solid var(--border-primary);
  border-radius: 999px;
  padding: 6px 14px;
}
.wallet-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #22c55e;
}
.wallet-address {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--text-secondary);
}
.disconnect-btn {
  background: none;
  border: none;
  color: var(--text-tertiary);
  cursor: pointer;
  font-size: 12px;
  padding: 0 2px;
}
.disconnect-btn:hover { color: var(--text-primary); }
.wallet-pending { color: var(--text-tertiary); font-size: 12px; }
.wallet-error { color: #dc2626; font-size: 11px; }

/* ---- Block Grid ---- */
.block-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 20px;
}

/* ---- Block Card ---- */
.block-card {
  background: var(--bg-card);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius);
  padding: 16px;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}
.block-card:hover {
  border-color: var(--border-secondary);
  box-shadow: 0 1px 3px rgba(0,0,0,0.04);
}
.block-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 12px;
}
.block-number {
  font-family: var(--font-mono);
  font-size: 13px;
  color: var(--text-secondary);
}
.blob-count {
  font-size: 11px;
  color: var(--text-tertiary);
}

/* ---- Blob Grid inside Block Card ---- */
.blob-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(32px, 1fr));
  gap: 5px;
}

/* ---- Blob Square ---- */
.blob-square {
  aspect-ratio: 1;
  border-radius: var(--radius-sm);
  border: none;
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.2s ease;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}
.blob-square:hover {
  transform: scale(1.1);
}
.blob-square.has-melody {
  box-shadow: 0 0 0 2px var(--accent-purple);
}
.melody-icon {
  font-size: 11px;
  color: white;
  opacity: 0.9;
}

/* ---- Modal ---- */
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: var(--bg-modal-backdrop);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}
.modal-content {
  background: var(--bg-primary);
  border: 1px solid var(--border-primary);
  border-radius: 16px;
  padding: 32px;
  max-width: 480px;
  width: 90%;
  position: relative;
  box-shadow: 0 8px 30px rgba(0,0,0,0.08);
}
.modal-content h2 {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 16px;
}
.blob-info { margin-bottom: 20px; }
.blob-info p {
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 4px;
}
.blob-info code {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-primary);
  background: var(--bg-secondary);
  padding: 2px 5px;
  border-radius: 4px;
}
.label { color: var(--text-tertiary); }

/* ---- Note Visualization Bar ---- */
.note-bar {
  display: flex;
  align-items: flex-end;
  gap: 2px;
  height: 48px;
  margin-top: 16px;
  padding: 6px;
  background: var(--bg-secondary);
  border-radius: var(--radius-sm);
}
.note-pip {
  flex: 1;
  min-height: 3px;
  background: var(--accent-purple);
  border-radius: 2px;
  opacity: 0.6;
  transition: opacity 0.2s, background-color 0.3s;
}
.note-pip.active {
  opacity: 1;
  background: var(--accent-blue);
}

/* ---- Buttons ---- */
.generate-btn, .play-btn {
  width: 100%;
  padding: 12px;
  border-radius: var(--radius);
  border: none;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}
.generate-btn {
  background: var(--text-primary);
  color: var(--bg-primary);
}
.generate-btn:hover {
  opacity: 0.85;
}
.generate-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.play-btn {
  background: var(--bg-secondary);
  color: var(--text-primary);
  border: 1px solid var(--border-primary);
}
.play-btn:hover { border-color: var(--border-secondary); }
.play-btn.playing {
  background: var(--text-primary);
  color: var(--bg-primary);
  border-color: transparent;
}

.melody-meta {
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: var(--text-tertiary);
  font-family: var(--font-mono);
  margin-bottom: 12px;
}
.generate-cost {
  font-size: 12px;
  color: var(--text-tertiary);
  margin-bottom: 8px;
}
.close-btn {
  position: absolute;
  top: 16px;
  right: 16px;
  background: none;
  border: none;
  color: var(--text-tertiary);
  font-size: 20px;
  cursor: pointer;
  line-height: 1;
}
.close-btn:hover { color: var(--text-primary); }

/* ---- Animations ---- */
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
```

### 2.10 Testing Round 2

1. Start the server: `cd server && bun run index.ts`
2. Start the frontend: `cd web && npm run dev`
3. Click "Sign Up (Passkey)" → biometric prompt (fingerprint/Face ID) → account created
4. Fund your account: use `tempo wallet fund` CLI or the faucet at https://docs.tempo.xyz/quickstart/faucet
5. Click a blob square → modal opens with blob details
6. Click "Generate Melody ($0.03)" → passkey signs the MPP payment → melody plays
7. Close modal, see the blob square now glows (has melody)
8. Reload page → melodies persist, anyone can play them
9. Alternative: users with existing MetaMask + Tempo testnet can use "MetaMask" button instead

**Round 2 deliverable**: Full interactive frontend where users can see blocks, click blobs, pay to generate melodies, and hear them play.

---

## Phase 3: Polish & Compose (Round 3 — 2 hours)

### 3.1 Wire Up Real ExEx Data

If the Reth node has started syncing and blob-exex is producing blocks:

```bash
# Terminal 1: Run reth with blob-exex
cd ../../other/blob-exex
BLOB_DB_PATH=/tmp/blob_stats.db cargo run --bin blob-exex -- --chain mainnet

# Terminal 2: Copy data to our server's DB (or point server at same SQLite)
# Option A: Change server to read from blob-exex's SQLite directly
# Option B: Periodic sync script
```

Simplest: Point the Hono server at the blob-exex SQLite DB. The schema is slightly different (blob-exex uses `blob_transactions` + `blob_hashes` tables vs our `blobs` table), so write an adapter or modify your queries.

**blob-exex schema → our schema mapping:**
| blob-exex table | blob-exex columns | our equivalent |
|---|---|---|
| `blocks` | block_number, block_timestamp, tx_count, total_blobs, gas_used, gas_price, excess_blob_gas | Same (compatible) |
| `blob_transactions` | tx_hash, block_number, sender, blob_count, gas_price, created_at | `blobs.tx_hash`, `blobs.sender` |
| `blob_hashes` | id, tx_hash, blob_hash, blob_index | `blobs.blob_hash`, `blobs.blob_index` |

Adapter query (reads blob-exex format):
```sql
SELECT bh.blob_hash, bh.blob_index, bt.tx_hash, bt.sender, bt.block_number
FROM blob_hashes bh
JOIN blob_transactions bt ON bh.tx_hash = bt.tx_hash
WHERE bt.block_number = ?
ORDER BY bh.blob_index
```

### 3.2 Real-Time Block Updates (WebSocket)

Add a WebSocket endpoint to push new blocks as they arrive:

```typescript
// server/index.ts — add WebSocket upgrade
app.get('/ws/blocks', async (c) => {
  // Bun native WebSocket upgrade
  const upgraded = c.env?.upgrade?.(c.req.raw)
  if (!upgraded) return c.text('WebSocket upgrade failed', 400)
})

// Or simpler: SSE (Server-Sent Events)
app.get('/api/blocks/stream', (c) => {
  return c.newResponse(
    new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder()
        // Poll DB every 12 seconds (Ethereum block time)
        let lastBlock = 0
        const interval = setInterval(async () => {
          const db = getDb()
          const newBlocks = db.prepare(
            'SELECT * FROM blocks WHERE block_number > ? ORDER BY block_number ASC LIMIT 10'
          ).all(lastBlock)

          if (newBlocks.length > 0) {
            lastBlock = newBlocks[newBlocks.length - 1].block_number
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify(newBlocks)}\n\n`)
            )
          }
        }, 12000)
      }
    }),
    { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' } }
  )
})
```

Frontend SSE consumer:
```javascript
useEffect(() => {
  const source = new EventSource(`${API}/api/blocks/stream`)
  source.onmessage = (e) => {
    const newBlocks = JSON.parse(e.data)
    setBlocks(prev => [...newBlocks, ...prev].slice(0, 100))
  }
  return () => source.close()
}, [])
```

### 3.3 Animation Polish

- **New block entrance**: Blocks slide in from the left with a blue flash on the border
- **Melody generation**: When generating, show a pulsing ring animation around the blob square
- **Playback visualization**: Note pips in the modal light up sequentially as the melody plays, synced to `startTime`
- **Gallery view**: Horizontal scrolling ribbon of all melodies at the bottom of the page, each showing the blob hash color + "▶" button

### 3.4 Compose With Other Teams' APIs

In round 3, other teams will have built MPP-gated APIs. You can compose:

- **Image generation API**: When generating a melody, also pay for a visual artwork from someone else's API. Display the artwork behind the note visualization. Both payments happen via the same mppx client (one fetch each).
- **AI API**: Use an MPP-gated LLM to generate a creative "name" for the melody based on the note sequence.
- **Social API**: Post the melody + blob hash to a shared feed.

The key insight: mppx patches global fetch, so calling ANY MPP-gated API is just a normal `fetch()` — payments happen automatically.

---

## Quick Start Checklist

```
Round 1 (supply side):
[ ] bun init server project
[ ] Install: hono, mppx, viem, better-sqlite3
[ ] Implement melody generation algorithm
[ ] Set up SQLite schema (blocks, blobs, melodies)
[ ] Seed mock block/blob data
[ ] Implement MPP-gated POST /api/melody endpoint
[ ] Implement free GET /api/blocks, GET /api/melodies endpoints
[ ] Test with: npx mppx account create + npx mppx http://localhost:3001/...
[ ] Set RECIPIENT_ADDRESS env var to your Tempo wallet address

Round 2 (consumer):
[ ] Vite + React project
[ ] Install: tone, framer-motion, viem, mppx, wagmi, @tanstack/react-query
[ ] Set up wagmi config: webAuthn() from wagmi/tempo + optional metaMask()
[ ] Set up mppx client with wagmi getConnectorClient (NO private keys)
[ ] Wrap app in WagmiProvider + QueryClientProvider
[ ] Implement WalletConnect: passkey Sign Up/Sign In + EVM wallet fallback
[ ] Block grid with animated block cards
[ ] Blob squares with hash-derived colors
[ ] Melody modal (blob details + generate/play)
[ ] Tone.js audio engine (PolySynth + reverb)
[ ] Note visualization bar
[ ] Wire up to API (blocks, melodies, generation)

Round 3 (compose):
[ ] SSE/WebSocket for real-time block updates
[ ] Wire up blob-exex data (if node syncing)
[ ] Animation polish (entrance, playback sync, glow)
[ ] Gallery view of all melodies
[ ] Compose with other teams' MPP APIs
[ ] Demo prep
```

---

## Environment Variables

```bash
# Server
RECIPIENT_ADDRESS=0x...     # Your Tempo wallet address (receives payments)
PORT=3001                   # API port
DB_PATH=./blob_sonify.db   # SQLite database path

# Frontend
VITE_API_URL=http://localhost:3001  # API server URL

# blob-exex (optional)
BLOB_DB_PATH=/tmp/blob_stats.db    # blob-exex SQLite path
```

## Useful Commands

```bash
# Tempo wallet
curl -fsSL https://tempo.xyz/install | bash   # Install Tempo CLI
tempo wallet create                            # Create wallet
tempo wallet balance                           # Check balance

# mppx
npx mppx account create                       # Create testnet wallet (auto-funded)
npx mppx http://localhost:3001/api/melody ...  # Test paid endpoint

# Development
cd server && bun run index.ts                  # Start API
cd web && npm run dev                          # Start frontend
```
