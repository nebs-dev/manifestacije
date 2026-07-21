import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { SiteHeader } from "@/components/public/site-header";
import { SiteFooter } from "@/components/public/site-footer";
import { ResultsGrid } from "@/components/public/results-grid";
import { fetchCategories, fetchEvents, WEB_URL } from "@/lib/public-api";
import { eventsToItemListJsonLd, safeJsonLdString } from "@/lib/event-jsonld";
import { categoryName } from "@/lib/seo-taxonomy";

export async function generateMetadata({ params }: { params: { categorySlug: string } }): Promise<Metadata> {
  const [events, categories] = await Promise.all([
    fetchEvents({ category: params.categorySlug }),
    fetchCategories(),
  ]);
  const name = categoryName(params.categorySlug, categories, events);
  const title = `${name} — događanja`;
  const description = `Pregled aktualnih događanja, manifestacija i evenata u kategoriji ${name}.`;
  return {
    title,
    description,
    openGraph: { type: "website", title, description, url: `${WEB_URL}/kategorije/${params.categorySlug}` },
    twitter: { card: "summary", title, description },
    alternates: { canonical: `${WEB_URL}/kategorije/${params.categorySlug}` },
    ...(events.length === 0 ? { robots: { index: false, follow: true } } : {}),
  };
}

export default async function CategoryPage({ params }: { params: { categorySlug: string } }) {
  const [events, categories] = await Promise.all([
    fetchEvents({ category: params.categorySlug }),
    fetchCategories(),
  ]);
  const name = categoryName(params.categorySlug, categories, events);
  return (
    <>
      <SiteHeader />
      {events.length > 0 && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLdString(eventsToItemListJsonLd(events, WEB_URL)) }} />
      )}
      <main className="mx-auto max-w-6xl px-4 py-10 md:py-14">
        <Link href="/eventi" className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
          <ArrowLeft className="size-4" /> Sva događanja
        </Link>
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-accent-foreground">Kategorija</p>
        <h1 className="mt-2 font-heading text-3xl font-semibold md:text-4xl">{name}</h1>
        <p className="mb-8 mt-2 text-muted-foreground">
          Aktualna događanja, manifestacije i eventi iz odabrane kategorije.
        </p>
        <ResultsGrid events={events} />
      </main>
      <SiteFooter />
    </>
  );
}
