import { type CroEvent, eventHasCategory } from "./data"
import { normalizeCity } from "./discovery-filters"
import { eventHasEnded } from "./event-schedule"

// Candidates come exclusively from the published public feed.
export function rankRelatedEvents(current: CroEvent, candidates: CroEvent[], now = new Date()): CroEvent[] {
  const city = (event: CroEvent) => normalizeCity(event.citySlug || event.city)
  const categorySlugs = [current.category, ...current.categories.map(category => category.slug)]
  const tier = (event: CroEvent) => {
    const sameCity = Boolean(city(current)) && city(event) === city(current)
    const sameCategory = categorySlugs.some(slug => eventHasCategory(event, slug))
    if (sameCity && sameCategory) return 0
    if (sameCategory && current.region !== "nepoznato" && event.region === current.region) return 1
    if (sameCity) return 2
    return sameCategory ? 3 : 4
  }
  const distance = (event: CroEvent) => current.lat != null && current.lng != null && event.lat != null && event.lng != null
    ? Math.hypot(event.lat - current.lat, (event.lng - current.lng) * Math.cos(current.lat * Math.PI / 180)) : Number.MAX_VALUE
  const identity = (event: CroEvent) => `${normalizeCity(event.title)}|${city(event)}|${event.date}|${event.time}`
  const seen = new Set<string>([current.slug])
  const identities = new Set([identity(current)])
  return candidates.filter(event => event.slug !== current.slug && !eventHasEnded(event, now))
    .sort((a, b) => tier(a) - tier(b) || (tier(a) === 4 ? distance(a) - distance(b) : 0) || a.date.localeCompare(b.date) || a.time.localeCompare(b.time) || a.slug.localeCompare(b.slug))
    .filter(event => {
      if (seen.has(event.slug) || identities.has(identity(event))) return false
      seen.add(event.slug)
      identities.add(identity(event))
      return true
    })
    .slice(0, 3)
}
