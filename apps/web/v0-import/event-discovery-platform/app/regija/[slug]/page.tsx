import type { Metadata } from "next"
import { notFound } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { ResultsGrid } from "@/components/results-grid"
import { regions, getRegion, eventsByRegion } from "@/lib/data"

export function generateStaticParams() {
  return regions.map((r) => ({ slug: r.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const region = getRegion(slug)
  if (!region) return { title: "Regija" }
  return { title: region.name, description: region.blurb }
}

export default async function RegionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const region = getRegion(slug)
  if (!region) notFound()

  const events = eventsByRegion(slug)

  return (
    <>
      <SiteHeader />
      <main>
        <section className="relative isolate overflow-hidden text-ink-foreground">
          <Image
            src={region.image || "/placeholder.svg"}
            alt={region.name}
            fill
            priority
            className="object-cover"
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/55 to-ink/35" aria-hidden />
          <div className="relative mx-auto max-w-6xl px-4 py-20 md:py-28">
            <Link
              href="/dogadanja"
              className="inline-flex items-center gap-1.5 text-sm text-ink-foreground/80 hover:text-ink-foreground"
            >
              <ArrowLeft className="size-4" aria-hidden />
              Sva događanja
            </Link>
            <p className="mt-6 text-sm font-medium uppercase tracking-[0.18em] text-ink-foreground/75">
              {region.county}
            </p>
            <h1 className="mt-2 max-w-2xl text-balance font-heading text-4xl font-semibold md:text-6xl">
              {region.name}
            </h1>
            <p className="mt-3 max-w-xl text-pretty text-ink-foreground/85 leading-relaxed">{region.blurb}</p>
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
