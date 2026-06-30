import type { Metadata } from "next"
import { notFound } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { ResultsGrid } from "@/components/results-grid"
import { categories, getCategory, eventsByCategory } from "@/lib/data"

export function generateStaticParams() {
  return categories.map((c) => ({ slug: c.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const cat = getCategory(slug)
  if (!cat) return { title: "Kategorija" }
  return { title: cat.name, description: cat.tagline }
}

export default async function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const cat = getCategory(slug)
  if (!cat) notFound()

  const events = eventsByCategory(slug)

  return (
    <>
      <SiteHeader />
      <main>
        <section
          className="relative isolate overflow-hidden px-4 py-16 text-ink-foreground md:py-24"
          style={{ background: `linear-gradient(140deg, ${cat.gradient[0]}, ${cat.gradient[1]})` }}
        >
          <div className="mx-auto max-w-6xl">
            <Link
              href="/dogadanja"
              className="inline-flex items-center gap-1.5 text-sm text-ink-foreground/80 hover:text-ink-foreground"
            >
              <ArrowLeft className="size-4" aria-hidden />
              Sva događanja
            </Link>
            <p className="mt-6 text-sm font-medium uppercase tracking-[0.18em] text-ink-foreground/75">Kategorija</p>
            <h1 className="mt-2 max-w-2xl text-balance font-heading text-4xl font-semibold md:text-5xl">{cat.name}</h1>
            <p className="mt-3 max-w-xl text-pretty text-ink-foreground/85 leading-relaxed">{cat.tagline}</p>
          </div>
        </section>

        <div className="mx-auto max-w-6xl px-4 py-12 md:py-16">
          <p className="mb-6 text-muted-foreground">{events.length} događanja</p>
          <ResultsGrid events={events} />
        </div>
      </main>
      <SiteFooter />
    </>
  )
}
