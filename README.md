# blosom

**blo**b + **som** (sound in portuguese) — hear the blobs

click on an ethereum blob, pay a couple cents w/ [tempo](https://tempo.xyz), get a unique melody generated from the blob's hash bytes. see and hear what others have bought on the grid.

## how it works

1. [reth exex](https://github.com/figtracer/reth-blob-exex) indexes blob data from ethereum blocks
2. hono api generates deterministic melodies from blob hash bytes (pentatonic scales, variable bpm)
3. melody generation is payment-gated via tempo's [mpp 402 flow](https://docs.tempo.xyz)
4. react frontend renders a block grid w/ colored blob squares, tone.js plays the melodies
5. a little stickman dances to the notes

## stack

- **indexer**: reth execution extension (exex)
- **server**: bun + hono + sqlite + mppx
- **frontend**: react + vite + framer-motion + tone.js + wagmi
- **payments**: tempo mpp (micropayment protocol)

## run

```bash
# server
cd server && bun install && bun run index.ts

# frontend
cd web && npm install && npm run dev
```

## built by

[@fig](https://x.com/figtracer) using [tempo](https://tempo.xyz) and [reth](https://github.com/paradigmxyz/reth)
