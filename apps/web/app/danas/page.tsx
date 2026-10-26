import type { Metadata } from "next";
import { SiteHeader } from "@/components/public/site-header";
import { SiteFooter } from "@/components/public/site-footer";
import { ResultsGrid } from "@/components/public/results-grid";
import { breadcrumbsToJsonLd, eventsToItemListJsonLd, safeJsonLdString } from "@/lib/event-jsonld";
import { fetchEvents, WEB_URL } from "@/lib/public-api";

export const metadata: Metadata = {
  title: "Događanja danas",
  description: "Sva događanja koja se održavaju danas na jednom mjestu: koncerti, festivali, predstave, radionice, sajmovi i besplatna događanja uz termine i lokacije.",
  alternates: { canonical: `${WEB_URL}/danas` },
};

// Cached for 5 minutes instead of rendered per request (PERF-01). The listing
// is date-derived, so after midnight it can show the previous day for at most
// one revalidation interval; the date itself is computed in Europe/Zagreb.
export const revalidate = 300;

export default async function TodayPage() {
  const events = await fetchEvents({ when: "danas" });
  const breadcrumbJsonLd = breadcrumbsToJsonLd(
    [
      { name: "Početna", path: "/" },
      { name: "Danas", path: "/danas" },
    ],
    WEB_URL,
  );
  return (
    <>
      <SiteHeader />
      {events.length > 0 && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLdString(eventsToItemListJsonLd(events, WEB_URL)) }} />
      )}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLdString(breadcrumbJsonLd) }} />
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
