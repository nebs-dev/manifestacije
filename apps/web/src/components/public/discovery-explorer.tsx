"use client"

import { useMemo, useState } from "react"
import dynamic from "next/dynamic"
import Link from "next/link"
import { MapPin, CalendarDays } from "lucide-react"
import { categories, dateParts, eventHasCategory, priceLabel, regionName, type CroEvent } from "@/lib/data"
import { cn } from "@/lib/utils"

const DiscoveryMap = dynamic(() => import("@/components/public/discovery-map"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-muted" />,
})

export function DiscoveryExplorer({ events }: { events: CroEvent[] }) {
  const [category, setCategory] = useState<string>("")
  const [selected, setSelected] = useState<string | undefined>(undefined)

  const filtered = useMemo(
    () => (category ? events.filter((e) => eventHasCategory(e, category)) : events),
    [events, category],
  )

  return (
    <div className="grid h-[calc(100vh-4rem)] grid-rows-[auto_1fr] md:grid-rows-1 md:grid-cols-[400px_1fr]">
      {/* List panel */}
      <div className="flex min-h-0 flex-col border-b border-border md:border-b-0 md:border-r">
        <div className="border-b border-border px-4 py-3">
          <div className="flex gap-2 overflow-x-auto no-scrollbar">
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

        <ul className="min-h-0 flex-1 overflow-y-auto">
          {filtered.map((e) => {
            const d = dateParts(e.date)
            return (
              <li key={e.slug}>
                <button
                  onMouseEnter={() => setSelected(e.slug)}
                  onClick={() => setSelected(e.slug)}
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
                    <p className="truncate font-medium">{e.title}</p>
                    <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="size-3" aria-hidden />
                      {e.city} · {regionName(e.region)}
                    </p>
                    <div className="mt-1.5 flex items-center gap-2">
                      <span className="text-xs font-semibold text-accent-foreground">{priceLabel(e)}</span>
                      <Link
                        href={`/eventi/${e.slug}`}
                        className="text-xs font-medium text-primary hover:underline"
                      >
                        Detalji
                      </Link>
                    </div>
                  </div>
                </button>
              </li>
            )
          })}
          {filtered.length === 0 && (
            <li className="flex flex-col items-center gap-2 px-4 py-16 text-center text-muted-foreground">
              <CalendarDays className="size-8" aria-hidden />
              <span className="text-sm">Nema događanja u ovoj kategoriji.</span>
            </li>
          )}
        </ul>
      </div>

      {/* Map */}
      <div className="relative min-h-[360px]">
        <DiscoveryMap events={filtered} selected={selected} onSelect={setSelected} />
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
        "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
        active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:border-foreground/30",
      )}
    >
      {children}
    </button>
  )
}
