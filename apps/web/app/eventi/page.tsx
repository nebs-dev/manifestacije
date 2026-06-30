import type { Metadata } from "next";
import { SiteHeader } from "@/components/public/site-header";
import { SiteFooter } from "@/components/public/site-footer";
import { FiltersPanel } from "@/components/public/filters-panel";
import { ResultsGrid } from "@/components/public/results-grid";
import { fetchEvents, type PublicFilters } from "@/lib/public-api";

export const metadata: Metadata = {
  title: "Sva događanja",
  description: "Pretraži i filtriraj događanja diljem Hrvatske."
};

function str(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}

export default async function EventsPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const filters: PublicFilters = {
    q: str(searchParams.q),
    category: str(searchParams.kategorija),
    region: str(searchParams.regija),
    city: str(searchParams.grad),
    free: str(searchParams.besplatno) === "1",
    kids: str(searchParams.djeca) === "1",
    outdoor: str(searchParams.vani) === "1",
    when: str(searchParams.kada) as PublicFilters["when"]
  };
  const results = await fetchEvents(filters);

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-10 md:py-14">
        <header className="mb-8">
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-accent-foreground">Pregled</p>
          <h1 className="mt-2 font-heading text-3xl font-semibold md:text-4xl">Sva događanja</h1>
          <p className="mt-2 text-muted-foreground">{results.length} događanja odgovara tvojim filtrima.</p>
        </header>
        <div className="grid grid-cols-1 gap-8 md:grid-cols-[260px_1fr]">
          <FiltersPanel />
          <ResultsGrid events={results} />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
