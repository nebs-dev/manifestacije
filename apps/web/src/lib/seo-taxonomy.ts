import {
  CATEGORY_DISPLAY,
  getRegion,
  regions as staticRegions,
  type CroEvent,
  type RegionSlug,
} from "@/lib/data"
import type { PublicCategory, PublicRegion } from "@/lib/public-api"

const regionSlugAliases: Record<string, RegionSlug> = {
  "slavonija-i-baranja": "slavonija",
  "zagreb-i-okolica": "zagreb",
  "istra-i-kvarner": "istra",
  "sredisnja-hrvatska": "sredisnja",
  "lika-i-gorski-kotar": "lika",
  "medimurje-i-zagorje": "medimurje",
}

const regionLocative: Record<string, string> = {
  "slavonija-i-baranja": "Slavoniji i Baranji",
  slavonija: "Slavoniji i Baranji",
  "zagreb-i-okolica": "Zagrebu i okolici",
  zagreb: "Zagrebu i okolici",
  dalmacija: "Dalmaciji",
  "istra-i-kvarner": "Istri i Kvarneru",
  istra: "Istri i Kvarneru",
  kvarner: "Istri i Kvarneru",
  "sredisnja-hrvatska": "središnjoj Hrvatskoj",
  sredisnja: "središnjoj Hrvatskoj",
  "lika-i-gorski-kotar": "Lici i Gorskom kotaru",
  lika: "Lici i Gorskom kotaru",
  "medimurje-i-zagorje": "Međimurju i Zagorju",
  medimurje: "Međimurju i Zagorju",
}

const cityLocative: Record<string, string> = {
  osijek: "Osijeku",
  zagreb: "Zagrebu",
  rijeka: "Rijeci",
  varazdin: "Varaždinu",
  vukovar: "Vukovaru",
  vinkovci: "Vinkovcima",
  dakovo: "Đakovu",
  nasice: "Našicama",
  cepin: "Čepinu",
  ilok: "Iloku",
  valpovo: "Valpovu",
  kutjevo: "Kutjevu",
  bilje: "Bilju",
  batina: "Batini",
  rovinj: "Rovinju",
  pula: "Puli",
  split: "Splitu",
  zadar: "Zadru",
  dubrovnik: "Dubrovniku",
}

export type SeoCategoryLink = {
  slug: string
  name: string
  href: string
}

export type CityEventSummary = {
  slug: string
  name: string
  count: number
}

export function humanizeSlug(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
}

export function slugifyLabel(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
}

export function categoryName(
  slug: string,
  categories: PublicCategory[] = [],
  events: CroEvent[] = [],
): string {
  return (
    categories.find((category) => category.slug === slug)?.name ||
    events.flatMap((event) => event.categories).find((category) => category.slug === slug)?.name ||
    CATEGORY_DISPLAY[slug] ||
    humanizeSlug(slug)
  )
}

export function cityName(slug: string, events: CroEvent[] = []): string {
  return events.find((event) => event.city)?.city || humanizeSlug(slug)
}

export function citySlugForEvent(event: CroEvent): string {
  return event.citySlug || slugifyLabel(event.city)
}

export function cityLocationPhrase(slug: string, name: string): string {
  return cityLocative[slug] || `gradu ${name}`
}

export function cityEventSummaries(events: CroEvent[]): CityEventSummary[] {
  return [...events.reduce((map, event) => {
    if (!event.city) return map
    const slug = citySlugForEvent(event)
    const existing = map.get(slug)
    map.set(slug, {
      slug,
      name: existing?.name || event.city,
      count: (existing?.count || 0) + 1,
    })
    return map
  }, new Map<string, CityEventSummary>()).values()]
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "hr"))
}

export function citySeoFields(slug: string, events: CroEvent[], webUrl: string) {
  const name = cityName(slug, events)
  const location = cityLocationPhrase(slug, name)
  const title = `Događanja u ${location} – danas, ovaj vikend i uskoro | Manifestacije`
  const description = `Digitalni kalendar događanja za ${location}: pregled koncerata, festivala, kazališta, radionica, događanja za djecu i besplatnih događanja u ${location}. Pronađi aktualne termine, lokacije i programe.`
  const canonical = `${webUrl}/gradovi/${slug}`

  return { name, location, title, description, canonical }
}

export function regionName(slug: string, regions: PublicRegion[] = []): string {
  const staticSlug = regionSlugAliases[slug] || slug
  return (
    regions.find((region) => region.slug === slug)?.name ||
    regions.find((region) => region.slug === staticSlug)?.name ||
    getRegion(staticSlug as RegionSlug)?.name ||
    staticRegions.find((region) => region.slug === staticSlug)?.name ||
    humanizeSlug(slug)
  )
}

export function regionImage(slug: string): string | undefined {
  const staticSlug = regionSlugAliases[slug] || slug
  return getRegion(staticSlug as RegionSlug)?.image || staticRegions.find((region) => region.slug === staticSlug)?.image
}

export function regionLocationPhrase(slug: string, name: string): string {
  return regionLocative[slug] || regionLocative[regionSlugAliases[slug] || ""] || `regiji ${name}`
}

export function categoryLinksForEvents(
  events: CroEvent[],
  categories: PublicCategory[] = [],
  buildHref: (categorySlug: string) => string,
  excludeSlug?: string,
): SeoCategoryLink[] {
  const counts = new Map<string, number>()
  for (const event of events) {
    const slugs = new Set([event.category, ...event.categories.map((category) => category.slug)])
    for (const slug of slugs) {
      if (slug && slug !== excludeSlug) counts.set(slug, (counts.get(slug) || 0) + 1)
    }
  }

  return [...counts.entries()]
    .sort(([slugA, countA], [slugB, countB]) => {
      const orderA = categories.find((category) => category.slug === slugA)?.sortOrder ?? 999
      const orderB = categories.find((category) => category.slug === slugB)?.sortOrder ?? 999
      return countB - countA || orderA - orderB || slugA.localeCompare(slugB, "hr")
    })
    .slice(0, 6)
    .map(([slug]) => ({ slug, name: categoryName(slug, categories, events), href: buildHref(slug) }))
}

export function cityLinksForEvents(
  events: CroEvent[],
  buildHref: (citySlug: string) => string,
): SeoCategoryLink[] {
  return cityEventSummaries(events)
    .slice(0, 8)
    .map((city) => ({ slug: city.slug, name: city.name, href: buildHref(city.slug) }))
}
