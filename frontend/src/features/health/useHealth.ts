import { useEffect, useState } from 'react'

import { fetchHealth } from '../../lib/api'
import type { ConnectionState } from '../../types/health'

export function useHealth() {
  const [connection, setConnection] = useState<ConnectionState>('checking')

  useEffect(() => {
    let cancelled = false

    async function check() {
      try {
        const health = await fetchHealth()
        if (!cancelled) {
          setConnection(health.status === 'ok' ? 'connected' : 'offline')
        }
      } catch {
        if (!cancelled) {
          setConnection('offline')
        }
      }
    }

    void check()

    return () => {
      cancelled = true
    }
  }, [])

  return { connection }
}
