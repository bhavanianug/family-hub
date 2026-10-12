import { useState } from 'react'

import { useGroup } from '../features/group/useGroup'

export function GroupInvitePanel() {
  const { group, loading, error, joinWithInvite, rotateInviteCode } = useGroup()
  const [inviteInput, setInviteInput] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (loading) {
    return (
      <section className="surface-panel animate-fade-up rounded-2xl p-6">
        <p className="text-ink-soft">Loading group…</p>
      </section>
    )
  }

  if (error) {
    return (
      <section className="surface-panel animate-fade-up rounded-2xl p-6">
        <p className="text-coral">{error}</p>
      </section>
    )
  }

  if (!group) {
    return null
  }

  const canRotate = group.role === 'owner' || group.role === 'parent'

  return (
    <section
      id="group"
      className="surface-panel animate-fade-up rounded-2xl p-6 sm:p-8"
      style={{ animationDelay: '100ms' }}
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold tracking-[0.22em] text-sage-deep uppercase">
            Your group
          </p>
          <h2 className="mt-2 font-display text-3xl font-extrabold tracking-tight text-ink">
            {group.name}
          </h2>
          <p className="mt-2 max-w-xl text-base leading-relaxed text-ink-soft">
            {group.member_count} member{group.member_count === 1 ? '' : 's'} ·
            share the code so everyone can add to the calendar.
          </p>
        </div>
        <code className="rounded-2xl bg-panel px-5 py-3 font-display text-2xl font-extrabold tracking-[0.24em] text-sage ring-1 ring-line">
          {group.invite_code}
        </code>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded-lg bg-sage/15 px-3.5 py-2 text-sm font-bold text-sage-deep transition hover:bg-sage/25"
          onClick={async () => {
            await navigator.clipboard.writeText(group.invite_code)
            setMessage('Invite code copied')
          }}
        >
          Copy code
        </button>
        {canRotate && (
          <button
            type="button"
            className="rounded-lg px-3.5 py-2 text-sm font-semibold text-ink-soft transition hover:bg-ink/5 hover:text-ink"
            disabled={busy}
            onClick={async () => {
              setBusy(true)
              const result = await rotateInviteCode()
              setBusy(false)
              setMessage(
                result.error
                  ? result.error
                  : 'Invite code rotated — share the new code',
              )
            }}
          >
            Rotate code
          </button>
        )}
      </div>

      {group.member_count === 1 && (
        <form
          className="mt-6 max-w-md space-y-3 border-t border-line pt-6"
          onSubmit={async (event) => {
            event.preventDefault()
            setBusy(true)
            setMessage(null)
            const result = await joinWithInvite(inviteInput)
            setBusy(false)
            setMessage(
              result.error
                ? result.error
                : 'Joined group — you can add calendar events together',
            )
          }}
        >
          <p className="text-sm text-ink-soft">
            Already have a code? Join that group instead:
          </p>
          <div className="flex gap-2">
            <input
              className="min-w-0 flex-1 rounded-lg border border-line bg-panel px-3 py-2.5 uppercase tracking-wider text-ink outline-none focus:border-sage focus:ring-2 focus:ring-sage/25"
              placeholder="INVITE"
              value={inviteInput}
              onChange={(event) => setInviteInput(event.target.value)}
            />
            <button
              type="submit"
              disabled={busy || !inviteInput.trim()}
              className="btn-primary rounded-lg px-4 py-2 text-sm font-bold disabled:opacity-60"
            >
              Join
            </button>
          </div>
        </form>
      )}

      {message && (
        <p className="mt-3 text-sm font-semibold text-sage-deep" role="status">
          {message}
        </p>
      )}
    </section>
  )
}
