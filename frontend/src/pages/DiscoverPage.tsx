import { DiscoverPocPanel } from '../components/DiscoverPocPanel'
import { useOpportunities } from '../features/opportunities/useOpportunities'

type DiscoverPageProps = {
  onOpenOpportunities?: () => void
}

export function DiscoverPage({ onOpenOpportunities }: DiscoverPageProps) {
  const { add } = useOpportunities()

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] font-bold tracking-[0.22em] text-sage uppercase">
          Into your tracker
        </p>
        <h2 className="mt-1.5 font-display text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
          Discover
        </h2>
        <p className="mt-2 max-w-xl text-sm text-ink-soft sm:text-base">
          Search for program pages, then Add to Opportunities — that pulls
          details from the page (same as Pull details) and saves them to your
          tracker.
        </p>
        <ol className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-sm font-semibold text-ink-soft">
          <li>
            <span className="text-sage-deep">1.</span> Search
          </li>
          <li>
            <span className="text-sage-deep">2.</span> Pull details &amp; save
          </li>
          <li>
            <span className="text-sage-deep">3.</span> Track in Opportunities
          </li>
        </ol>
        {onOpenOpportunities && (
          <button
            type="button"
            onClick={onOpenOpportunities}
            className="mt-3 text-sm font-bold text-sage hover:text-ink"
          >
            Open Opportunities →
          </button>
        )}
      </div>
      <DiscoverPocPanel
        onAddLink={add}
        onOpenOpportunities={onOpenOpportunities}
      />
    </div>
  )
}
