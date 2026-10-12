import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import App from './App'

function createQuery(result: unknown) {
  const query: Record<string, unknown> = {}
  query.select = vi.fn(() => query)
  query.eq = vi.fn(() => query)
  query.in = vi.fn(() => query)
  query.order = vi.fn(() => query)
  query.maybeSingle = vi.fn().mockResolvedValue(result)
  query.then = undefined
  // For list queries that await the builder directly
  Object.assign(query, {
    then: (
      resolve: (value: { data: unknown; error: null; count?: number }) => void,
    ) => {
      resolve({ data: [], error: null, count: 1 })
    },
  })
  return query
}

vi.mock('./lib/supabase', () => ({
  isSupabaseConfigured: true,
  getSupabase: () => ({
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: {
          session: {
            access_token: 'test-token',
            user: { id: 'user-1', email: 'teen@example.com' },
          },
        },
      }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
    },
    from: vi.fn((table: string) => {
      if (table === 'group_members') {
        const query = createQuery({
          data: {
            role: 'owner',
            group_id: 'group-1',
            groups: {
              id: 'group-1',
              name: 'Test Group',
              invite_code: 'ABCD1234',
            },
          },
          error: null,
        })
        query.eq = vi.fn((column: string) => {
          if (column === 'user_id') return query
          return Promise.resolve({ count: 1, error: null })
        })
        return query
      }
      if (table === 'people') {
        return createQuery({
          data: {
            id: 'person-1',
            group_id: 'group-1',
            user_id: 'user-1',
            display_name: 'Teen',
            person_type: 'teen',
          },
          error: null,
        })
      }
      if (table === 'opportunities') {
        return createQuery({ data: [], error: null })
      }
      if (table === 'opportunity_tracking') {
        return createQuery({ data: [], error: null })
      }
      return createQuery({ data: null, error: null })
    }),
    rpc: vi.fn(),
  }),
}))

afterEach(() => {
  vi.restoreAllMocks()
})

describe('Family Hub home page', () => {
  it('renders the Family Hub title when signed in', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ status: 'ok', service: 'family-hub-api' }),
      }),
    )

    render(<App />)

    expect(
      await screen.findByRole('heading', { name: /family\s*hub/i }),
    ).toBeInTheDocument()
    expect(
      await screen.findByRole('heading', { name: 'Opportunities' }),
    ).toBeInTheDocument()
  })

  it('shows backend connected when health check succeeds', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ status: 'ok', service: 'family-hub-api' }),
      }),
    )

    render(<App />)

    await waitFor(() => {
      expect(screen.getByTestId('connection-status')).toHaveTextContent(
        'Online',
      )
    })
  })

  it('shows backend offline when health check fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')))

    render(<App />)

    await waitFor(() => {
      expect(screen.getByTestId('connection-status')).toHaveTextContent(
        'Offline',
      )
    })
  })
})
