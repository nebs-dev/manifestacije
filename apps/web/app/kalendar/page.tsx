import type { Metadata } from "next"
import { CalendarExplorer } from "@/components/public/calendar-explorer"
import { SiteFooter } from "@/components/public/site-footer"
import { SiteHeader } from "@/components/public/site-header"
import { fetchEvents, type PublicFilters } from "@/lib/public-api"

export const metadata: Metadata = {
  title: "Kalendar dogadanja",
  description: "Pregledaj dogadanja diljem Slavonije i Baranje po danima, tjednima i mjesecima.",
}

function str(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v
}

export default async function CalendarPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const filters: PublicFilters = {
    q: str(searchParams.q),
    category: str(searchParams.kategorija),
    region: str(searchParams.regija),
    city: str(searchParams.grad),
    free: str(searchParams.besplatno) === "1",
    kids: str(searchParams.djeca) === "1",
    outdoor: str(searchParams.vani) === "1",
  }

  const results = await fetchEvents(filters)

  const now = new Date()
  let year = now.getFullYear()
  let month = now.getMonth()
  if (results.length) {
    const earliest = results.reduce((a, b) => (a.date <= b.date ? a : b))
    const d = new Date(`${earliest.date}T00:00:00`)
    year = d.getFullYear()
    month = d.getMonth()
  }

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-7xl overflow-hidden px-4 py-10 md:py-14">
        <header className="mb-8 max-w-2xl">
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-accent-foreground">Pregled</p>
          <h1 className="mt-2 text-balance font-heading text-3xl font-semibold md:text-5xl">Kalendar dogadanja</h1>
          <p className="mt-3 text-pretty leading-relaxed text-muted-foreground">
            Otkrij sto se dogada diljem Hrvatske - po danima, tjednima i mjesecima. Listaj agendu, skoci na vikend ili pronadi besplatna dogadanja za cijelu obitelj.
          </p>
        </header>

        <CalendarExplorer events={results} initialYear={year} initialMonth={month} />
      </main>
      <SiteFooter />
    </>
  )
}
