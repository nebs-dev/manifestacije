"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { X } from "lucide-react"
import { activeDiscoveryFilters, changeDiscoveryFilter, filterKeys, normalizeDiscoveryParams } from "@/lib/discovery-filters"
import { trackEvent } from "@/lib/analytics"
import type { PublicCategory } from "@/lib/public-api"

export function ActiveFilters({ categories = [] }: { categories?: PublicCategory[] }) {
  const params = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const active = activeDiscoveryFilters(new URLSearchParams(params.toString()), Object.fromEntries(categories.map(c => [c.slug, c.name])))
  if (!active.length) return null
  const navigate = (next: URLSearchParams) => router.push(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false })
  return <div aria-label="Aktivni filtri" className="mb-5 flex min-w-0 flex-wrap items-center gap-2">
    {active.map(({ key, label }) => <button key={key} type="button" aria-label={`Ukloni filtar: ${label}`}
      onClick={() => {
        trackEvent({ name: "filter_change", params: { source_page: pathname, filter: key, action: "remove" } })
        navigate(changeDiscoveryFilter(new URLSearchParams(params.toString()), key, null))
      }} className="inline-flex min-h-11 max-w-full items-center gap-2 rounded-full border border-border bg-secondary px-3 py-2 text-sm">
      <span className="min-w-0 break-words">{label}</span><X className="size-4 shrink-0" aria-hidden />
    </button>)}
    <button type="button" className="min-h-11 px-2 text-sm font-medium text-primary underline" onClick={() => {
      const next = normalizeDiscoveryParams(new URLSearchParams(params.toString()))
      filterKeys.forEach(key => next.delete(key))
      trackEvent({ name: "filter_reset", params: { source_page: pathname } })
      navigate(next)
    }}>Poništi sve</button>
  </div>
}
