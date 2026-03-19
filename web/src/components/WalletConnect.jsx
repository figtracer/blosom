import { useEffect } from 'react'
import { useAccount, useConnect, useConnectors, useDisconnect } from 'wagmi'
import { initMppx } from '../lib/mppx-client'

export function WalletConnect() {
  const { address, isConnected } = useAccount()
  const connect = useConnect()
  const connectors = useConnectors()
  const { disconnect } = useDisconnect()

  useEffect(() => {
    if (isConnected) {
      initMppx()
    }
  }, [isConnected])

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

  const [connector] = connectors

  return (
    <div className="wallet-connect">
      {connector && (
        <>
          <button
            className="connect-btn connect-btn-primary"
            onClick={() => connect.connect({
              connector,
              capabilities: { type: 'sign-up' },
            })}
          >
            Sign Up
          </button>
          <button
            className="connect-btn"
            onClick={() => connect.connect({ connector })}
          >
            Sign In
          </button>
        </>
      )}

      {connect.error && (
        <div className="wallet-error-toast">
          Connection failed
        </div>
      )}
    </div>
  )
}
