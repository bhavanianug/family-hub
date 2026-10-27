import { useState } from 'react'

import { useHealth } from '../features/health/useHealth'
import { AppLayout, type AppPage } from '../layouts/AppLayout'
import { CalendarPage } from './CalendarPage'
import { CollegePage } from './CollegePage'
import { DashboardPage } from './DashboardPage'
import { DiscoverPage } from './DiscoverPage'
import { GroupPage } from './GroupPage'
import { OpportunitiesPage } from './OpportunitiesPage'

export function AuthenticatedApp() {
  const { connection } = useHealth()
  const [page, setPage] = useState<AppPage>('opportunities')

  return (
    <AppLayout connection={connection} page={page} onNavigate={setPage}>
      {page === 'dashboard' && <DashboardPage onNavigate={setPage} />}
      {page === 'calendar' && <CalendarPage />}
      {page === 'opportunities' && (
        <OpportunitiesPage onFindMore={() => setPage('discover')} />
      )}
      {page === 'discover' && (
        <DiscoverPage onOpenOpportunities={() => setPage('opportunities')} />
      )}
      {page === 'college' && <CollegePage />}
      {page === 'group' && <GroupPage />}
    </AppLayout>
  )
}
