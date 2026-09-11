"use client"

import type { PublicCategory } from "@/lib/public-api"
import Link from "next/link"
import { useRef, useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { categories, type CroEvent } from "@/lib/data"
import { buttonVariants } from "@/components/ui/button"
import { upcomingCategoryCounts } from "@/lib/discovery-filters"
import { cn } from "@/lib/utils"

// 3 rows x 4 columns per page — the full 24-category grid at once read as a
// wall of tiles, so it's paged like the event rails instead.
const PAGE_SIZE = 12

function chunk<T>(items: T[], size: number): T[][] {
  const pages: T[][] = []
  for (let i = 0; i < items.length; i += size) pages.push(items.slice(i, i + size))
  return pages
}

export function CategoryStrip({ events, inventory = [] }: { events?: CroEvent[]; inventory?: PublicCategory[] }) {
  const railRef = useRef<HTMLDivElement>(null)
  const [page, setPage] = useState(0)
  const counts = inventory.length && inventory.every(c => c.upcomingCount !== undefined)
    ? Object.fromEntries(inventory.map(c => [c.slug, c.upcomingCount!]))
    : upcomingCategoryCounts(events || [])
  const pages = chunk(categories.filter(c => (counts[c.slug] || 0) > 0).sort((a, b) => (counts[b.slug] || 0) - (counts[a.slug] || 0)), PAGE_SIZE)

  function scrollToPage(index: number) {
    const rail = railRef.current
    if (!rail) return
    const target = Math.max(0, Math.min(index, pages.length - 1))
    rail.scrollTo({ left: target * rail.clientWidth, behavior: "smooth" })
    setPage(target)
  }

  function onScroll() {
    const rail = railRef.current
    if (!rail || rail.clientWidth === 0) return
    setPage(Math.round(rail.scrollLeft / rail.clientWidth))
  }

  return (
    <div>
      {pages.length > 1 && (
        <div className="-mt-3 mb-4 flex justify-end gap-2">
          <button
            type="button"
            aria-label="Prikaži prethodne kategorije"
            className={buttonVariants({ variant: "outline", size: "icon" })}
            disabled={page === 0}
            onClick={() => scrollToPage(page - 1)}
          >
            <ChevronLeft className="size-4" aria-hidden />
          </button>
          <button
            type="button"
            aria-label="Prikaži sljedeće kategorije"
            className={buttonVariants({ variant: "outline", size: "icon" })}
            disabled={page === pages.length - 1}
            onClick={() => scrollToPage(page + 1)}
          >
            <ChevronRight className="size-4" aria-hidden />
          </button>
        </div>
      )}
      <div
        ref={railRef}
        onScroll={onScroll}
        className="flex snap-x snap-mandatory gap-3 overflow-x-auto no-scrollbar"
      >
        {pages.map((pageCategories, index) => (
          <div key={index} className="grid w-full shrink-0 snap-start grid-cols-2 gap-3 self-start sm:grid-cols-4">
            {pageCategories.map((cat) => (
              <Link
                key={cat.slug}
                href={`/kategorije/${cat.slug}`}
                className="group relative isolate flex aspect-[5/3] flex-col justify-end overflow-hidden rounded-2xl p-4 text-ink-foreground shadow-poster transition-transform hover:-translate-y-0.5"
                style={{ background: `linear-gradient(140deg, ${cat.gradient[0]}, ${cat.gradient[1]})` }}
              >
                <span className="absolute inset-0 bg-ink/10 transition-colors group-hover:bg-ink/0" aria-hidden />
                <span className="relative font-heading text-lg font-semibold leading-tight">{cat.name}</span>
                <span className="relative mt-0.5 text-xs text-ink-foreground/80">
                  {counts[cat.slug]} događanja
                </span>
              </Link>
            ))}
          </div>
        ))}
      </div>
      {pages.length > 1 && (
        <div className="mt-4 flex justify-center gap-1.5">
          {pages.map((_, index) => (
            <button
              key={index}
              type="button"
              aria-label={`Stranica ${index + 1}`}
              className={cn("h-1.5 rounded-full transition-all", index === page ? "w-5 bg-ink" : "w-1.5 bg-ink/20")}
              onClick={() => scrollToPage(index)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
