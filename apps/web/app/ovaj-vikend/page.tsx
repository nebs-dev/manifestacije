import { SiteHeader } from "@/components/public/site-header";
import { SiteFooter } from "@/components/public/site-footer";
import { ResultsGrid } from "@/components/public/results-grid";
import { fetchEvents } from "@/lib/public-api";

export default async function WeekendPage() {
  const events = await fetchEvents({ when: "ovaj-vikend" });
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-10 md:py-14">
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-accent-foreground">Vikend</p>
        <h1 className="mt-2 font-heading text-3xl font-semibold md:text-4xl">Ovaj vikend</h1>
        <p className="mb-8 mt-2 text-muted-foreground">{events.length} dogadanja</p>
        <ResultsGrid events={events} />
      </main>
      <SiteFooter />
    </>
  );
}
