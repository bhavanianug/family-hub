import type { ConnectionState } from '../types/health'

const labels: Record<ConnectionState, string> = {
  checking: 'Checking backend…',
  connected: 'Backend connected',
  offline: 'Backend offline',
}

const tones: Record<ConnectionState, string> = {
  checking: 'bg-white/10 text-white/85 ring-1 ring-white/25',
  connected: 'bg-sage/20 text-white ring-1 ring-sage/50',
  offline: 'bg-coral/20 text-white ring-1 ring-coral/50',
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
      className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-semibold backdrop-blur-sm transition-colors duration-300 ${tones[connection]}`}
      data-testid="connection-status"
      role="status"
      aria-live="polite"
    >
      <span
        className={`size-2.5 rounded-sm ${dots[connection]}`}
        aria-hidden="true"
      />
      {labels[connection]}
    </div>
  )
}
