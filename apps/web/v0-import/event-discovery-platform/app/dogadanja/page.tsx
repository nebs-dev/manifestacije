import type { Metadata } from "next"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { FiltersPanel } from "@/components/filters-panel"
import { ResultsGrid } from "@/components/results-grid"
import { filterEvents, type EventFilters } from "@/lib/data"

export const metadata: Metadata = {
  title: "Sva događanja",
  description: "Pretraži i filtriraj događanja diljem Hrvatske.",
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>

function str(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v
}

export default async function EventsPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams

  const filters: EventFilters = {
    q: str(sp.q),
    category: str(sp.kategorija),
    region: str(sp.regija),
    city: str(sp.grad),
    free: str(sp.besplatno) === "1",
    kids: str(sp.djeca) === "1",
    outdoor: str(sp.vani) === "1",
    when: str(sp.kada) as EventFilters["when"],
  }

  const results = filterEvents(filters)

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-10 md:py-14">
        <header className="mb-8">
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-accent-foreground">Pregled</p>
          <h1 className="mt-2 font-heading text-3xl font-semibold md:text-4xl">Sva događanja</h1>
          <p className="mt-2 text-muted-foreground">
            {results.length} {results.length === 1 ? "događanje" : "događanja"} odgovara tvojim filtrima.
          </p>
        </header>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-[260px_1fr]">
          <FiltersPanel />
          <div>
            <ResultsGrid events={results} />
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  )
}
