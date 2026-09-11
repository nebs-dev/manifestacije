import { categoryName, regionName, type CroEvent, eventHasCategory } from "./data"
import { eventHasEnded } from "./event-schedule"

export function normalizeCity(value: string): string {
  return value.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")
}

export function discoveryParams(input: Record<string, string | string[] | undefined>): URLSearchParams {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(input)) {
    const first = Array.isArray(value) ? value[0] : value
    if (first) params.set(key, first)
  }
  return normalizeDiscoveryParams(params)
}

// These attributes have always been category aliases. Preserve old precedence:
// explicit category, then kids, then outdoor. New controls only write kategorija.
export function normalizeDiscoveryParams(input: URLSearchParams): URLSearchParams {
  const params = new URLSearchParams(input)
  if (!params.get("kategorija")) {
    if (params.get("djeca") === "1") params.set("kategorija", "djeca-i-obitelj")
    else if (params.get("vani") === "1") params.set("kategorija", "na-otvorenom")
  }
  params.delete("djeca")
  params.delete("vani")
  if (params.has("grad")) {
    const city = normalizeCity(params.get("grad") ?? "")
    if (city) params.set("grad", city)
    else params.delete("grad")
  }
  return params
}

export function changeDiscoveryFilter(input: URLSearchParams, key: string, value: string | null): URLSearchParams {
  const params = normalizeDiscoveryParams(input)
  if (key === "kategorija" && params.get(key) === value) params.delete(key)
  else if (value?.trim()) params.set(key, key === "grad" ? normalizeCity(value) : value.trim())
  else params.delete(key)
  return params
}

export const filterKeys = ["q", "grad", "regija", "kada", "kategorija", "besplatno"] as const
export function activeDiscoveryFilters(input: URLSearchParams, names: Record<string, string> = {}) {
  const params = normalizeDiscoveryParams(input)
  const when: Record<string, string> = { danas: "Danas", "ovaj-vikend": "Ovaj vikend", "ovaj-mjesec": "Ovaj mjesec" }
  return filterKeys.flatMap(key => {
    const value = params.get(key)
    if (!value || (key === "besplatno" && value !== "1")) return []
    const label = key === "q" ? `Pretraga: ${value}` : key === "grad" ? `Grad: ${value.replaceAll("-", " ")}`
      : key === "kategorija" ? names[value] || categoryName(value)
      : key === "regija" ? regionName(value as CroEvent["region"])
      : key === "kada" ? when[value] || value : "Besplatno"
    return [{ key, label }]
  })
}

export function upcomingCategoryCounts(events: CroEvent[], now = new Date()): Record<string, number> {
  const counts: Record<string, number> = {}
  const seen = new Set<string>()
  for (const event of events) {
    if (seen.has(event.slug) || eventHasEnded(event, now)) continue
    seen.add(event.slug)
    const slugs = new Set([event.category, ...event.categories.map(category => category.slug)])
    for (const slug of slugs) if (eventHasCategory(event, slug)) counts[slug] = (counts[slug] || 0) + 1
  }
  return counts
}
