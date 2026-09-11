"use client"

import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { useCallback, useState, useEffect } from "react"
import { Search } from "lucide-react"
import { normalizeDiscoveryParams, changeDiscoveryFilter } from "@/lib/discovery-filters"
import { trackEvent } from "@/lib/analytics"
import { startProgress } from "@/lib/route-progress"
import { categories as staticCategories, categoryName } from "@/lib/data"
import { cn } from "@/lib/utils"
import type { PublicCategory } from "@/lib/public-api"

const whenOptions = [
  { value: "", label: "Bilo kada" },
  { value: "danas", label: "Danas" },
  { value: "ovaj-vikend", label: "Ovaj vikend" },
  { value: "ovaj-mjesec", label: "Ovaj mjesec" },
]

const toggles = [
  { key: "besplatno", label: "Besplatno" },
]

export function EventFilters({
  categories: fetchedCategories,
  categoryCounts,
}: {
  categories?: PublicCategory[]
  categoryCounts?: Record<string, number>
}) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const [q, setQ] = useState(params.get("q") ?? "")

  // Fall back to static lists if nothing fetched yet
  const allCategories = fetchedCategories?.length
    ? fetchedCategories
    : staticCategories.map((c) => ({ id: 0, slug: c.slug, name: categoryName(c.slug), sortOrder: 0 }))

  useEffect(() => {
    setQ(params.get("q") ?? "")
  }, [params])

  const update = useCallback(
    (key: string, value: string | null) => {
      const next = normalizeDiscoveryParams(new URLSearchParams(params.toString()))
      // Any filter change also commits whatever is currently typed in the
      // search box — otherwise clearing it without pressing Enter left a
      // stale q= behind the next time a different filter (e.g. category)
      // was clicked, silently narrowing results by the old search term too.
      if (q) next.set("q", q)
      else next.delete("q")
      const changed = changeDiscoveryFilter(next, key, value)
      trackEvent({ name: "filter_change", params: { source_page: pathname, filter: key, action: changed.has(key) ? "apply" : "remove" } })
      startProgress()
      router.push(`${pathname}?${changed.toString()}`, { scroll: false })
    },
    [params, pathname, router, q],
  )

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault()
    update("q", q || null)
  }

  const activeCategory = normalizeDiscoveryParams(new URLSearchParams(params.toString())).get("kategorija") ?? ""
  const categories = categoryCounts ? allCategories.filter(c => (categoryCounts[c.slug] || 0) > 0 || c.slug === activeCategory)
    .sort((a, b) => (categoryCounts[b.slug] || 0) - (categoryCounts[a.slug] || 0)) : allCategories
  const activeWhen = params.get("kada") ?? ""


  return (
    <div className="flex flex-col gap-7">
      <form id="event-filters-search-form" onSubmit={onSearch} className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          type="search"
          placeholder="Pretraži naziv, grad ili lokaciju…"
          aria-label="Pretraži naziv, grad ili lokaciju"
          className="w-full rounded-full border border-input bg-card py-2.5 pl-10 pr-4 text-sm outline-none ring-ring/40 transition focus:ring-2"
        />
      </form>

      <FilterGroup label="Kada">
        <div className="flex flex-wrap gap-2">
          {whenOptions.map((o) => (
            <Chip
              key={o.value}
              active={activeWhen === o.value}
              onClick={() => update("kada", o.value || null)}
            >
              {o.label}
            </Chip>
          ))}
        </div>
      </FilterGroup>

      <FilterGroup label="Kategorija">
        <div className="flex flex-col gap-1">
          <RadioRow active={activeCategory === ""} onClick={() => update("kategorija", null)}>
            Sve kategorije
          </RadioRow>
          {categories.map((c) => (
            <RadioRow
              key={c.slug}
              active={activeCategory === c.slug}
              onClick={() => update("kategorija", c.slug)}
            >
              {c.name}{categoryCounts && <span className="ml-2 text-xs text-muted-foreground">{categoryCounts[c.slug] || 0}</span>}
            </RadioRow>
          ))}
        </div>
      </FilterGroup>

      <FilterGroup label="Filtri">
        <div className="flex flex-col gap-2">
          {toggles.map((t) => {
            const checked = params.get(t.key) === "1"
            return (
              <label key={t.key} className="flex cursor-pointer items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => update(t.key, checked ? null : "1")}
                  className="size-4 rounded border-input accent-primary"
                />
                {t.label}
              </label>
            )
          })}
        </div>
      </FilterGroup>


    </div>
  )
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">{label}</h3>
      {children}
    </div>
  )
}

function Chip({
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
      aria-pressed={active}
      className={cn(
        "rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card text-foreground hover:border-foreground/30",
      )}
    >
      {children}
    </button>
  )
}

function RadioRow({
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
      aria-pressed={active}
      className={cn(
        "rounded-lg px-3 py-2 text-left text-sm transition-colors",
        active ? "bg-secondary font-semibold text-secondary-foreground" : "text-foreground hover:bg-muted",
      )}
    >
      {children}
    </button>
  )
}
