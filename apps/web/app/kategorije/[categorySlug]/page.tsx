import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { SiteHeader } from "@/components/public/site-header";
import { SiteFooter } from "@/components/public/site-footer";
import { ResultsGrid } from "@/components/public/results-grid";
import { getCategory } from "@/lib/data";
import { fetchEvents } from "@/lib/public-api";

export default async function CategoryPage({ params }: { params: { categorySlug: string } }) {
  const category = getCategory(params.categorySlug);
  const events = await fetchEvents({ category: params.categorySlug });
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-10 md:py-14">
        <Link href="/eventi" className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
          <ArrowLeft className="size-4" /> Sva dogadanja
        </Link>
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-accent-foreground">Kategorija</p>
        <h1 className="mt-2 font-heading text-3xl font-semibold md:text-4xl">{category?.name || params.categorySlug}</h1>
        <p className="mb-8 mt-2 text-muted-foreground">{category?.tagline || "Dogadanja iz odabrane kategorije."}</p>
        <ResultsGrid events={events} />
      </main>
      <SiteFooter />
    </>
  );
}
