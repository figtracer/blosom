# blossom

**blo**b + **som** (sound in portuguese) — hear the blobs

live at [blossom.figtracer.com](https://blossom.figtracer.com)

click on an ethereum blob, pay a couple cents w/ [tempo](https://tempo.xyz), get a unique melody generated from the blob's hash bytes. see and hear what others have bought on the grid.

## how it works

1. [reth exex](https://github.com/figtracer/reth-blob-exex) indexes every blob transaction from ethereum mainnet
2. hono api generates deterministic melodies from blob hash bytes (pentatonic scales, variable bpm)
3. melody generation is payment-gated via tempo's [mpp 402 flow](https://docs.tempo.xyz) — $0.03 per melody
4. react frontend renders a block grid w/ colored blob squares, tone.js plays the melodies
5. a little stickman dances to the notes

## buy a melody

via CLI (works w/ any tempo wallet):
```bash
tempo request -X POST --json '{"blob_hash":"0x..."}' 'https://api.figtracer.com/api/melody'
```

or sign up on the website and generate directly from the browser.

existing melodies are free to replay — you only pay once per blob.

## stack

- **indexer**: reth execution extension ([blob-exex](https://github.com/figtracer/reth-blob-exex))
- **server**: bun + hono + sqlite + mppx
- **frontend**: react + vite + framer-motion + tone.js + wagmi
- **payments**: tempo mpp (micropayment protocol)

## run locally

```bash
# server (standalone w/ mock data)
cd server && bun install && bun run index.ts

# server (w/ real exex data)
EXEX_DB_PATH=/path/to/blob_stats.db RECIPIENT_ADDRESS=0x... bun run index.ts

# frontend
cd web && npm install && npm run dev
```

## built by

[@fig](https://x.com/figtracer) using [tempo](https://tempo.xyz) and [reth](https://github.com/paradigmxyz/reth)
