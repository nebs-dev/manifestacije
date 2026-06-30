"use client"

import { useState } from "react"
import { SlidersHorizontal, X } from "lucide-react"
import { EventFilters } from "@/components/public/event-filters"
import type { PublicCategory, PublicRegion } from "@/lib/public-api"

export function FiltersPanel({
  categories,
  regions,
}: {
  categories?: PublicCategory[]
  regions?: PublicRegion[]
}) {
  const [open, setOpen] = useState(false)

  return (
    <>
      {/* Desktop */}
      <aside className="hidden md:block">
        <div className="sticky top-24 rounded-2xl border border-border bg-card p-5 shadow-poster">
          <EventFilters categories={categories} regions={regions} />
        </div>
      </aside>

      {/* Mobile trigger */}
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium shadow-poster md:hidden"
      >
        <SlidersHorizontal className="size-4" aria-hidden />
        Filtri
      </button>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            className="absolute inset-0 bg-ink/50 backdrop-blur-sm"
            aria-label="Zatvori filtre"
            onClick={() => setOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 flex w-[88%] max-w-sm flex-col bg-background shadow-poster-lg">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <span className="font-heading text-lg font-semibold">Filtri</span>
              <button onClick={() => setOpen(false)} aria-label="Zatvori" className="rounded-full p-1 hover:bg-muted">
                <X className="size-5" aria-hidden />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-6">
              <EventFilters categories={categories} regions={regions} />
            </div>
            <div className="border-t border-border p-4">
              <button
                onClick={() => setOpen(false)}
                className="w-full rounded-full bg-primary py-3 text-sm font-semibold text-primary-foreground"
              >
                Prikaži rezultate
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
