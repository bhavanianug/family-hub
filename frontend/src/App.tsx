import { AuthProvider, useAuth } from './features/auth/AuthProvider'
import { AuthenticatedApp } from './pages/AuthenticatedApp'
import { AuthPage } from './pages/AuthPage'

function AppGate() {
  const { configured, loading, user } = useAuth()

  if (!configured) {
    return <AuthPage />
  }

  if (loading) {
    return (
      <div className="app-sky flex min-h-screen items-center justify-center text-ink-soft">
        Loading…
      </div>
    )
  }

  if (!user) {
    return <AuthPage />
  }

  return <AuthenticatedApp />
}

function App() {
  return (
    <AuthProvider>
      <AppGate />
    </AuthProvider>
  )
}

export default App
