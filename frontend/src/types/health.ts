export type HealthResponse = {
  status: string
  service: string
}

export type ConnectionState = 'checking' | 'connected' | 'offline'
