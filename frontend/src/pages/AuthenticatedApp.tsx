import { useState } from 'react'

import { useHealth } from '../features/health/useHealth'
import { AppLayout, type AppPage } from '../layouts/AppLayout'
import { ApplicationPage } from './ApplicationPage'
import { CalendarPage } from './CalendarPage'
import { CollegePage } from './CollegePage'
import { DashboardPage } from './DashboardPage'
import { DiscoverPage } from './DiscoverPage'
import { GroupPage } from './GroupPage'
import { OpportunitiesPage } from './OpportunitiesPage'

export function AuthenticatedApp() {
  const { connection } = useHealth()
  const [page, setPage] = useState<AppPage>('opportunities')
  const [applicationOpportunityId, setApplicationOpportunityId] = useState<
    string | null
  >(null)

  function navigate(next: AppPage) {
    if (next !== 'application') {
      setApplicationOpportunityId(null)
    }
    setPage(next)
  }

  function openApplication(opportunityId: string) {
    setApplicationOpportunityId(opportunityId)
    setPage('application')
  }

  return (
    <AppLayout connection={connection} page={page} onNavigate={navigate}>
      {page === 'dashboard' && <DashboardPage onNavigate={navigate} />}
      {page === 'calendar' && <CalendarPage />}
      {page === 'opportunities' && (
        <OpportunitiesPage
          onFindMore={() => navigate('discover')}
          onOpenApplication={openApplication}
        />
      )}
      {page === 'application' && applicationOpportunityId && (
        <ApplicationPage
          opportunityId={applicationOpportunityId}
          onBack={() => navigate('opportunities')}
        />
      )}
      {page === 'discover' && (
        <DiscoverPage onOpenOpportunities={() => navigate('opportunities')} />
      )}
      {page === 'college' && <CollegePage />}
      {page === 'group' && <GroupPage />}
    </AppLayout>
  )
}
