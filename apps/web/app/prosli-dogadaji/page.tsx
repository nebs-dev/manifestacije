import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRight, History } from "lucide-react";
import { SiteHeader } from "@/components/public/site-header";
import { SiteFooter } from "@/components/public/site-footer";
import { EventCard } from "@/components/public/event-card";
import { fetchPastEvents, WEB_URL } from "@/lib/public-api";

// Archive changes slowly; the API classifies by actual end time. Mutations
// still invalidate the shared `events` cache tag.
export const revalidate = 3600;

const PAGE_SIZE = 24;

function pageFrom(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  const page = Number.parseInt(raw ?? "1", 10);
  return Number.isFinite(page) && page >= 1 && page <= 1000 ? page : 1;
}

export async function generateMetadata({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }): Promise<Metadata> {
  const page = pageFrom(searchParams.stranica);
  const canonical = page === 1 ? `${WEB_URL}/prosli-dogadaji` : `${WEB_URL}/prosli-dogadaji?stranica=${page}`;
  return {
    title: page === 1 ? "Prošli događaji" : `Prošli događaji – stranica ${page}`,
    description: "Arhiva održanih događanja i manifestacija u Slavoniji i Baranji koje smo objavili na Manifestacije.hr.",
    alternates: { canonical },
    // Only the first archive page is indexed; deeper pages are for browsing.
    ...(page > 1 ? { robots: { index: false, follow: true } } : {}),
  };
}

export default async function PastEventsPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const page = pageFrom(searchParams.stranica);
  const data = await fetchPastEvents(page, PAGE_SIZE).catch(() => null);
  const href = (n: number) => (n === 1 ? "/prosli-dogadaji" : `/prosli-dogadaji?stranica=${n}`);

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl px-4 py-10 md:py-14">
        <header className="mb-8 max-w-2xl">
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-accent-foreground">Arhiva</p>
          <h1 className="mt-2 font-heading text-3xl font-semibold md:text-5xl">Prošli događaji</h1>
          <p className="mt-3 text-pretty leading-relaxed text-muted-foreground">
            Pogledajte što je sve prošlo kroz naše ruke — održana događanja i manifestacije koje smo objavili. Za ono što tek dolazi pogledajte{" "}
            <Link href="/eventi" className="font-medium text-primary hover:underline">nadolazeća događanja</Link>.
          </p>
        </header>

        {!data ? (
          <p role="status" className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-muted-foreground">Arhivu trenutačno nije moguće učitati. Pokušajte ponovno za koju minutu.</p>
        ) : data.items.length === 0 ? (
          <div className="flex flex-col items-center rounded-2xl border border-dashed border-border bg-card px-6 py-16 text-center">
            <History className="size-10 text-muted-foreground" aria-hidden />
            <p className="mt-4 font-heading text-xl font-semibold">{page > 1 ? "Ova stranica arhive je prazna" : "Još nema prošlih događaja"}</p>
            {page > 1 && <Link href={href(1)} className="mt-3 text-sm font-medium text-primary hover:underline">Na prvu stranicu arhive</Link>}
          </div>
        ) : (
          <>
            <p className="mb-6 text-sm text-muted-foreground">{data.total} održanih događanja · stranica {data.page} od {data.pageCount}</p>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
              {data.items.map((event) => (
                <EventCard key={event.slug} event={event} ended imageSizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw" />
              ))}
            </div>
            {data.pageCount > 1 && (
              <nav aria-label="Stranice arhive" className="mt-10 flex flex-wrap items-center justify-between gap-3">
                {page > 1 ? (
                  <Link href={href(page - 1)} rel="prev" className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-muted">
                    <ArrowLeft className="size-4" aria-hidden /> Novije
                  </Link>
                ) : <span />}
                <span className="text-sm text-muted-foreground">Stranica {page} od {data.pageCount}</span>
                {page < data.pageCount ? (
                  <Link href={href(page + 1)} rel="next" className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-muted">
                    Starije <ArrowRight className="size-4" aria-hidden />
                  </Link>
                ) : <span />}
              </nav>
            )}
          </>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
