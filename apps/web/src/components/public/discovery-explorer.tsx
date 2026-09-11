"use client"

import { useEffect, useMemo, useState } from "react"
import dynamic from "next/dynamic"
import { MapPin, CalendarDays, Search, X } from "lucide-react"
import { categories, dateParts, eventHasCategory, priceLabel, regionName, type CroEvent } from "@/lib/data"
import { resolveMapCity } from "@/lib/discovery-map-model"
import { normalizeCity } from "@/lib/discovery-filters"
import { trackEvent } from "@/lib/analytics"
import { cn } from "@/lib/utils"
import { PrefetchEventLink } from "./prefetch-event-link"

const DiscoveryMap = dynamic(() => import("@/components/public/discovery-map"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-muted" />,
})

export function DiscoveryExplorer({ events }: { events: CroEvent[] }) {
  const [category, setCategory] = useState<string>("")
  const [query, setQuery] = useState("")
  const [selected, setSelected] = useState<string | undefined>(undefined)

  const filtered = useMemo(() => {
    let result = category ? events.filter((e) => eventHasCategory(e, category)) : events
    const q = normalizeCity(query)
    if (q) {
      result = result.filter((e) =>
        normalizeCity(e.title).includes(q) ||
        normalizeCity(e.city).includes(q) ||
        normalizeCity(e.venue).includes(q)
      )
    }
    return result
  }, [events, category, query])

  const cityCenter = useMemo(() => resolveMapCity(query, filtered), [query, filtered])
  useEffect(() => {
    if (!cityCenter) return
    const timer = setTimeout(() => trackEvent({ name: "map_city_search", params: { result_count: filtered.length } }), 350)
    return () => clearTimeout(timer)
  }, [cityCenter, filtered.length])

  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] md:h-[calc(100dvh-4rem)] md:grid-cols-[minmax(0,400px)_minmax(0,1fr)]">
      {/* List panel */}
      <div className="flex min-h-0 min-w-0 flex-col border-b border-border md:border-b-0 md:border-r">
        <div className="border-b border-border px-4 py-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              type="search"
              placeholder="Pretraži naziv, grad, lokaciju…"
              aria-label="Pretraži događanja"
              className="w-full rounded-full border border-input bg-card py-2 pl-9 pr-8 text-sm outline-none ring-ring/40 transition focus:ring-2"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                aria-label="Očisti pretragu"
                className="absolute right-0 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center text-muted-foreground hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            )}
          </div>
          <div className="mt-2.5 flex gap-2 overflow-x-auto no-scrollbar">
            <FilterPill active={category === ""} onClick={() => setCategory("")}>
              Sve
            </FilterPill>
            {categories.map((c) => (
              <FilterPill key={c.slug} active={category === c.slug} onClick={() => setCategory(c.slug)}>
                {c.name}
              </FilterPill>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">{filtered.length} događanja na karti</p>
        </div>

        <ul className="min-h-0 max-h-96 flex-1 overflow-y-auto md:max-h-none">
          {filtered.map((e) => {
            const d = dateParts(e.date)
            return (
              <li key={e.slug}>
                <div
                  className={cn(
                    "flex w-full gap-3 border-b border-border px-4 py-3 text-left transition-colors",
                    selected === e.slug ? "bg-secondary" : "hover:bg-muted",
                  )}
                >
                  <div className="flex w-12 shrink-0 flex-col items-center justify-center rounded-lg bg-primary py-1.5 text-primary-foreground">
                    <span className="text-[0.65rem] font-medium uppercase">{d.month}</span>
                    <span className="text-lg font-semibold leading-none">{d.day}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <button onClick={() => setSelected(e.slug)} className="min-h-11 w-full break-words text-left font-medium" aria-label={`Prikaži na karti: ${e.title}`}>{e.title}</button>
                    <p className="mt-0.5 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="size-3 shrink-0" aria-hidden />
                      {e.city} · {regionName(e.region)}
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold text-accent-foreground">{priceLabel(e)}</span>
                      <PrefetchEventLink
                        heroImage={e.heroImage ?? e.image}
                        href={`/eventi/${e.slug}?from=mapa`}
                        className="inline-flex min-h-11 items-center text-xs font-medium text-primary hover:underline"
                      >
                        Detalji
                      </PrefetchEventLink>
                    </div>
                  </div>
                </div>
              </li>
            )
          })}
          {filtered.length === 0 && (
            <li className="flex flex-col items-center gap-2 px-4 py-16 text-center text-muted-foreground">
              <CalendarDays className="size-8" aria-hidden />
              <span className="text-sm">{query ? "Nema rezultata za tu pretragu." : "Nema događanja u ovoj kategoriji."}</span>
            </li>
          )}
        </ul>
      </div>

      {/* Map */}
      <div className="relative h-[55dvh] min-h-[360px] min-w-0 md:h-auto">
        <DiscoveryMap cityCenter={cityCenter} events={filtered} selected={selected} onSelect={setSelected} />
      </div>
    </div>
  )
}

function FilterPill({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "min-h-11 shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
        active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:border-foreground/30",
      )}
    >
      {children}
    </button>
  )
}
