import type { ConnectionState } from '../types/health'

const labels: Record<ConnectionState, string> = {
  checking: 'Checking…',
  connected: 'Online',
  offline: 'Offline',
}

const tones: Record<ConnectionState, string> = {
  checking: 'bg-panel text-ink-soft ring-1 ring-line',
  connected: 'bg-mist text-sage ring-1 ring-sage/30',
  offline: 'bg-coral/10 text-coral ring-1 ring-coral/30',
}

const dots: Record<ConnectionState, string> = {
  checking: 'bg-sun animate-status-pulse',
  connected: 'bg-sage',
  offline: 'bg-coral',
}

type ConnectionStatusProps = {
  connection: ConnectionState
}

export function ConnectionStatus({ connection }: ConnectionStatusProps) {
  return (
    <div
      className={`inline-flex items-center gap-2 rounded-lg px-2.5 py-1 text-xs font-bold tracking-wide uppercase ${tones[connection]}`}
      data-testid="connection-status"
      role="status"
      aria-live="polite"
    >
      <span
        className={`size-1.5 rounded-sm ${dots[connection]}`}
        aria-hidden="true"
      />
      {labels[connection]}
    </div>
  )
}
