import type { CroEvent } from "./data"
import { fetchCities, fetchEvents } from "./public-api"
import { canonicalRegionSlug, citySlugForEvent, cityLocationPhrase, type SeoCategoryLink } from "./seo-taxonomy"

export type NearbyCity = {
  slug: string
  name: string
  countySlug?: string
  regionSlug?: string
  lat?: number | null
  lng?: number | null
}

/** Rough km between two points; only the ordering matters here. */
function distanceKm(from: NearbyCity, to: NearbyCity): number {
  if (from.lat == null || from.lng == null || to.lat == null || to.lng == null) return Number.MAX_VALUE
  const dLat = (to.lat - from.lat) * 111
  const dLng = (to.lng - from.lng) * 111 * Math.cos((from.lat * Math.PI) / 180)
  return Math.hypot(dLat, dLng)
}

function weekendCounts(events: CroEvent[]): Map<string, number> {
  return events.reduce((counts, event) => {
    const slug = citySlugForEvent(event)
    if (slug) counts.set(slug, (counts.get(slug) ?? 0) + 1)
    return counts
  }, new Map<string, number>())
}

/**
 * Places to offer on a weekend page that has nothing on (SEO-15): the nearest
 * cities that *do* have something this weekend, closest county first. Sending a
 * visitor to another empty page would be worse than the dead end it replaces,
 * so a city only qualifies when it has at least one weekend event.
 */
export function nearbyWeekendCities(
  origin: { citySlug?: string; regionSlug?: string },
  cities: NearbyCity[],
  weekendEvents: CroEvent[],
  limit = 5,
): SeoCategoryLink[] {
  const counts = weekendCounts(weekendEvents)
  const from = origin.citySlug ? cities.find((city) => city.slug === origin.citySlug) : undefined
  const regionSlug = origin.regionSlug ?? from?.regionSlug
  return cities
    .filter((city) => city.slug !== origin.citySlug && (counts.get(city.slug) ?? 0) > 0)
    .map((city) => ({
      city,
      tier: from && city.countySlug && city.countySlug === from.countySlug ? 0 : regionSlug && city.regionSlug === regionSlug ? 1 : 2,
      distance: from ? distanceKm(from, city) : Number.MAX_VALUE,
      count: counts.get(city.slug) ?? 0,
    }))
    .sort((a, b) =>
      a.tier - b.tier ||
      a.distance - b.distance ||
      b.count - a.count ||
      a.city.name.localeCompare(b.city.name, "hr"),
    )
    .slice(0, limit)
    .map(({ city }) => ({ slug: city.slug, name: city.name, href: `/kamo-za-vikend/gradovi/${city.slug}` }))
}

/** Where to send a visitor when the weekend itself is empty: the place's own
 *  listing, which covers every announced date, and its calendar. */
export function weekendFallbackLinks(scope: { kind: "city" | "region"; slug: string; name: string }): SeoCategoryLink[] {
  const location = scope.kind === "city" ? cityLocationPhrase(scope.slug, scope.name) : `regiji ${scope.name}`
  const base = scope.kind === "city" ? `/gradovi/${scope.slug}` : `/regije/${scope.slug}`
  const calendarParam = scope.kind === "city" ? `grad=${scope.slug}` : `regija=${scope.slug}`
  return [
    { slug: `${scope.slug}-all`, name: `Svi najavljeni termini u ${location}`, href: base },
    { slug: `${scope.slug}-calendar`, name: "Pogledaj u kalendaru", href: `/kalendar?${calendarParam}` },
  ]
}

export type WeekendEmptyState = {
  browse: SeoCategoryLink[]
  nearbyTitle: string
  nearby: SeoCategoryLink[]
}

/** Builds the content an empty weekend page shows instead of a dead end: the
 *  place's own listing plus the nearest places that do have something on. */
export async function weekendEmptyState(scope: { kind: "city" | "region"; slug: string; name: string }): Promise<WeekendEmptyState> {
  // 900s matches the weekend pages that render this; a shorter feed would cap
  // their revalidate (PERF-01).
  const [cities, weekendEvents] = await Promise.all([fetchCities(), fetchEvents({ when: "ovaj-vikend" }, { revalidate: 900 })])
  const nearbyCities: NearbyCity[] = cities.map((city) => ({
    slug: city.slug,
    name: city.name,
    countySlug: city.county?.slug,
    // The API reports the long region slug; URLs use the canonical short one.
    regionSlug: city.county?.region?.slug ? canonicalRegionSlug(city.county.region.slug) : undefined,
    lat: city.lat,
    lng: city.lng,
  }))
  const origin = scope.kind === "city" ? { citySlug: scope.slug } : { regionSlug: canonicalRegionSlug(scope.slug) }
  return {
    browse: weekendFallbackLinks(scope),
    nearbyTitle: "Ovaj vikend u blizini",
    nearby: nearbyWeekendCities(origin, nearbyCities, weekendEvents),
  }
}
