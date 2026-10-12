import { useState, type FormEvent } from 'react'

import { useAuth } from '../features/auth/AuthProvider'

const fieldClass =
  'mt-1 w-full rounded-lg border border-line bg-white px-3 py-2.5 text-ink outline-none transition focus:border-sage focus:ring-2 focus:ring-sage/25'

export function AuthPage() {
  const { configured, signIn, signUp } = useAuth()
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (!configured) {
    return (
      <div className="app-sky">
        <div className="app-shell mx-auto flex min-h-screen max-w-lg flex-col justify-center px-5 py-10">
          <h1 className="brand-mark font-display text-5xl font-extrabold">Family Hub</h1>
          <div className="accent-bar mt-4" />
          <p className="mt-5 text-ink-soft leading-relaxed">
            Add your Supabase project keys to{' '}
            <code className="text-sage-deep">frontend/.env</code>:
          </p>
          <pre className="surface-panel mt-4 overflow-x-auto rounded-2xl p-4 text-sm text-ink-soft">
            {`VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key`}
          </pre>
        </div>
      </div>
    )
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setInfo(null)
    setSubmitting(true)

    const result =
      mode === 'sign-in'
        ? await signIn(email, password)
        : await signUp(
            email,
            password,
            displayName || email.split('@')[0] || 'Family member',
            inviteCode,
          )

    setSubmitting(false)

    if (result.error) {
      setError(result.error)
      return
    }

    if (mode === 'sign-up') {
      setInfo(
        inviteCode.trim()
          ? 'Account created and joined the group. If email confirmation is enabled, check your inbox before signing in.'
          : 'Account created with a new group. Share your invite code so others can join the calendar. If email confirmation is enabled, check your inbox.',
      )
    }
  }

  return (
    <div className="app-sky">
      <div className="app-shell mx-auto grid min-h-screen w-full max-w-5xl items-center gap-10 px-5 py-10 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16 lg:px-8">
        <div className="animate-fade-up">
          <p className="text-[11px] font-bold tracking-[0.28em] text-sage-deep uppercase">
            Chicago · teens + family
          </p>
          <h1 className="brand-mark mt-3 font-display text-[3.4rem] leading-[0.92] font-extrabold sm:text-6xl">
            Family Hub
          </h1>
          <div className="accent-bar mt-5" />
          <p className="mt-5 max-w-md text-lg leading-relaxed text-ink-soft">
            Deadlines, summer programs, and your week — without the spreadsheet mess.
          </p>
        </div>

        <div className="animate-fade-up" style={{ animationDelay: '120ms' }}>
          <form
            onSubmit={onSubmit}
            className="surface-panel animate-pop-in space-y-4 rounded-2xl p-6 sm:p-8"
          >
            <div>
              <h2 className="font-display text-2xl font-extrabold text-ink">
                {mode === 'sign-in' ? 'Welcome back' : 'Create your account'}
              </h2>
              <p className="mt-1 text-sm text-ink-soft">
                {mode === 'sign-in'
                  ? 'Sign in to your shared calendar and tracker.'
                  : 'Start a group, or join one with an invite code.'}
              </p>
            </div>

            {mode === 'sign-up' && (
              <>
                <label className="block">
                  <span className="text-sm font-semibold text-ink-soft">Display name</span>
                  <input
                    className={fieldClass}
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                    autoComplete="name"
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-ink-soft">
                    Group invite code{' '}
                    <span className="font-normal opacity-70">(optional)</span>
                  </span>
                  <input
                    className={`${fieldClass} uppercase tracking-wider`}
                    value={inviteCode}
                    onChange={(event) => setInviteCode(event.target.value)}
                    placeholder="Leave blank to start a new group"
                    autoComplete="off"
                  />
                </label>
              </>
            )}

            <label className="block">
              <span className="text-sm font-semibold text-ink-soft">Email</span>
              <input
                type="email"
                required
                className={fieldClass}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
              />
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-ink-soft">Password</span>
              <input
                type="password"
                required
                minLength={6}
                className={fieldClass}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
              />
            </label>

            {error && (
              <p className="text-sm font-semibold text-coral" role="alert">
                {error}
              </p>
            )}
            {info && (
              <p className="text-sm font-semibold text-sage-deep" role="status">
                {info}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="btn-primary w-full rounded-xl px-4 py-3 text-sm font-bold disabled:opacity-60"
            >
              {submitting
                ? 'Please wait…'
                : mode === 'sign-in'
                  ? 'Sign in'
                  : 'Create account'}
            </button>

            <button
              type="button"
              className="w-full text-sm font-semibold text-sage-deep transition hover:text-ink"
              onClick={() => {
                setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in')
                setError(null)
                setInfo(null)
              }}
            >
              {mode === 'sign-in'
                ? 'Need an account? Sign up'
                : 'Already have an account? Sign in'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
