import type { Metadata } from "next";
import { SiteHeader } from "@/components/public/site-header";
import { SiteFooter } from "@/components/public/site-footer";
import { ResultsGrid } from "@/components/public/results-grid";
import { fetchEvents } from "@/lib/public-api";

export const metadata: Metadata = {
  title: "Događanja danas",
  description: "Pregled svih događanja koja se održavaju danas.",
};

export default async function TodayPage() {
  const events = await fetchEvents({ when: "danas" });
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-10 md:py-14">
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-accent-foreground">Danas</p>
        <h1 className="mt-2 font-heading text-3xl font-semibold md:text-4xl">Događanja danas</h1>
        <p className="mb-8 mt-2 text-muted-foreground">{events.length} događanja</p>
        <ResultsGrid events={events} />
      </main>
      <SiteFooter />
    </>
  );
}
