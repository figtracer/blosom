import { createConfig, http } from 'wagmi'
import { tempo } from 'viem/chains'
import { webAuthn, KeyManager } from 'wagmi/tempo'

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001'
const rpId = typeof window !== 'undefined' ? window.location.hostname : 'localhost'

export const config = createConfig({
  chains: [tempo],
  connectors: [
    webAuthn({
      keyManager: KeyManager.http(`${API}/keys`),
      rpId,
    }),
  ],
  multiInjectedProviderDiscovery: true,
  transports: {
    [tempo.id]: http(),
  },
})
