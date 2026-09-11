import { ActiveFilters } from "@/components/public/active-filters";
import { discoveryParams } from "@/lib/discovery-filters";
import type { Metadata } from "next";
import { SiteHeader } from "@/components/public/site-header";
import { SiteFooter } from "@/components/public/site-footer";
import { FiltersPanel } from "@/components/public/filters-panel";
import { ResultsGrid } from "@/components/public/results-grid";
import { fetchEvents, fetchCategoryInventory, WEB_URL, type PublicFilters } from "@/lib/public-api";
import { eventsToItemListJsonLd, safeJsonLdString } from "@/lib/event-jsonld";

// Canonical always points at the bare /eventi URL — filter query params (kategorija,
// regija, grad, kada, besplatno...) produce the same underlying content as dedicated
// taxonomy pages or the unfiltered list, so we avoid indexing them as separate URLs.
export const metadata: Metadata = {
  title: "Sva događanja",
  description: "Pretraži i filtriraj događanja diljem Slavonije i Baranje.",
  alternates: { canonical: `${WEB_URL}/eventi` },
};

function str(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}

export default async function EventsPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const normalized = discoveryParams(searchParams);
  const filters: PublicFilters = {
    q: str(searchParams.q),
    category: normalized.get("kategorija") || undefined,
    region: str(searchParams.regija),
    city: normalized.get("grad") || undefined,
    free: str(searchParams.besplatno) === "1",
    when: str(searchParams.kada) as PublicFilters["when"]
  };
  const [results, categories] = await Promise.all([
    fetchEvents(filters),
    fetchCategoryInventory(),
  ]);
  const returnParams = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    const first = str(value);
    if (first) returnParams.set(key, first);
  }
  const returnTo = `/eventi${returnParams.toString() ? `?${returnParams.toString()}` : ""}`;

  return (
    <>
      <SiteHeader />
      {results.length > 0 && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLdString(eventsToItemListJsonLd(results, WEB_URL)) }} />
      )}
      <main className="mx-auto max-w-6xl px-4 py-10 md:py-14">
        <header className="mb-8">
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-accent-foreground">Pregled</p>
          <h1 className="mt-2 font-heading text-3xl font-semibold md:text-4xl">Sva događanja</h1>
          <p className="mt-2 text-muted-foreground">{results.length} događanja odgovara tvojim filtrima.</p>
        </header>
        <div className="grid grid-cols-1 gap-8 md:grid-cols-[260px_minmax(0,1fr)] md:items-start">
          <FiltersPanel categories={categories} categoryCounts={categories.every(c => c.upcomingCount !== undefined) ? Object.fromEntries(categories.map(c => [c.slug, c.upcomingCount!])) : undefined} />
          <div className="min-w-0">
            <ActiveFilters categories={categories} />
            <ResultsGrid events={results} returnTo={returnTo} />
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
