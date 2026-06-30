import { events as fallbackEvents, type CategorySlug, type CroEvent, type RegionSlug } from "./data"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"
export const WEB_URL = process.env.NEXT_PUBLIC_WEB_URL || "http://localhost:3000"

type ApiTaxonomy = { id: number; name: string; slug: string; lat?: number | null; lng?: number | null }

type ApiEvent = {
  id: number
  title: string
  slug: string
  description: string
  shortDescription?: string | null
  startsAt: string
  endsAt?: string | null
  isFree?: boolean | null
  priceText?: string | null
  ticketUrl?: string | null
  sourceUrl?: string | null
  imageUrl?: string | null
  extractionConfidence?: number | null
  organizer?: { id: number; name: string } | null
  venue?: { id: number; name: string; address?: string | null; lat?: number | null; lng?: number | null } | null
  city: ApiTaxonomy
  county?: ApiTaxonomy
  region?: ApiTaxonomy
  category: ApiTaxonomy
}

export type PublicFilters = {
  q?: string
  category?: string
  region?: string
  city?: string
  free?: boolean
  kids?: boolean
  outdoor?: boolean
  when?: "danas" | "ovaj-vikend" | "ovaj-mjesec"
}

const categoryMap: Record<string, CategorySlug> = {
  glazba: "koncerti",
  kultura: "izlozbe",
  "djeca-i-obitelj": "obiteljski",
  sport: "na-otvorenom",
  outdoor: "na-otvorenom",
  "hrana-i-vino": "gastro",
  radionice: "radionice",
  sajmovi: "manifestacije",
  humanitarno: "manifestacije",
  "nocni-zivot": "festivali",
  edukacija: "radionice",
  udruge: "manifestacije",
  "tradicija-i-folklor": "manifestacije",
  ostalo: "manifestacije",
}

const reverseCategoryMap: Record<string, string> = {
  koncerti: "glazba",
  festivali: "nocni-zivot",
  radionice: "radionice",
  obiteljski: "djeca-i-obitelj",
  "na-otvorenom": "outdoor",
  gastro: "hrana-i-vino",
  izlozbe: "kultura",
  manifestacije: "tradicija-i-folklor",
}

const regionMap: Record<string, RegionSlug> = {
  "slavonija-i-baranja": "slavonija",
  "zagreb-i-okolica": "zagreb",
  dalmacija: "dalmacija",
  "istra-i-kvarner": "istra",
  "sredisnja-hrvatska": "zagreb",
  "lika-i-gorski-kotar": "lika",
  "medimurje-i-zagorje": "zagreb",
}

const reverseRegionMap: Record<string, string> = {
  slavonija: "slavonija-i-baranja",
  zagreb: "zagreb-i-okolica",
  dalmacija: "dalmacija",
  istra: "istra-i-kvarner",
  kvarner: "istra-i-kvarner",
  lika: "lika-i-gorski-kotar",
}

export async function fetchEvents(filters: PublicFilters = {}) {
  const params = new URLSearchParams()
  if (filters.q) params.set("search", filters.q)
  if (filters.category) params.set("category", reverseCategoryMap[filters.category] || filters.category)
  if (filters.region) params.set("region", reverseRegionMap[filters.region] || filters.region)
  if (filters.city) params.set("city", filters.city)
  if (filters.free) params.set("free", "true")
  if (filters.when === "danas") params.set("today", "true")
  if (filters.when === "ovaj-vikend") params.set("weekend", "true")
  const path = `/api/public/events${params.size ? `?${params.toString()}` : ""}`
  return fetchApi<ApiEvent[]>(path).then((rows) => rows.map(toCroEvent)).catch(() => fallbackEvents)
}

export async function fetchEvent(slug: string) {
  const event = await fetchApi<ApiEvent | null>(`/api/public/events/${slug}`).catch(() => null)
  if (event) return toCroEvent(event)
  return fallbackEvents.find((item) => item.slug === slug) || null
}

export async function fetchRelatedEvents(event: CroEvent) {
  const all = await fetchEvents()
  return all
    .filter((item) => item.slug !== event.slug && (item.region === event.region || item.category === event.category))
    .slice(0, 3)
}

export async function fetchMapEvents() {
  return fetchApi<ApiEvent[]>("/api/public/map/events").then((rows) => rows.map(toCroEvent)).catch(() => fallbackEvents)
}

async function fetchApi<T>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, { cache: "no-store" })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  return res.json() as Promise<T>
}

function toCroEvent(event: ApiEvent): CroEvent {
  const starts = new Date(event.startsAt)
  const ends = event.endsAt ? new Date(event.endsAt) : null
  const category = categoryMap[event.category.slug] || "manifestacije"
  const region = regionMap[event.region?.slug || ""] || "slavonija"
  return {
    slug: event.slug,
    title: event.title,
    category,
    region,
    city: event.city.name,
    venue: event.venue?.name || event.city.name,
    date: starts.toISOString().slice(0, 10),
    endDate: ends ? ends.toISOString().slice(0, 10) : undefined,
    time: new Intl.DateTimeFormat("hr-HR", { hour: "2-digit", minute: "2-digit" }).format(starts),
    free: event.isFree === true,
    price: event.priceText || undefined,
    forKids: category === "obiteljski",
    outdoor: category === "na-otvorenom" || Boolean(event.venue?.lat || event.city.lat),
    description: event.shortDescription || event.description,
    longDescription: event.description,
    organizer: event.organizer?.name || "Organizator nije naveden",
    source: event.sourceUrl || "Manifestacije.hr",
    ticketUrl: event.ticketUrl || event.sourceUrl || undefined,
    image: event.imageUrl || imageFor(category, region),
    featured: event.extractionConfidence ? event.extractionConfidence >= 0.85 : false,
    map: { x: 50, y: 50 },
  }
}

function imageFor(category: CategorySlug, region: RegionSlug) {
  if (category === "koncerti") return "/images/event-concert.png"
  if (category === "gastro") return "/images/event-food.png"
  if (category === "obiteljski") return "/images/event-family.png"
  if (category === "na-otvorenom") return "/images/event-outdoor.png"
  if (category === "izlozbe") return "/images/event-art.png"
  if (category === "radionice") return "/images/event-workshop.png"
  if (category === "festivali") return "/images/hero-night.png"
  if (region === "slavonija") return "/images/region-slavonija.png"
  if (region === "dalmacija") return "/images/region-dalmacija.png"
  if (region === "istra") return "/images/region-istra.png"
  if (region === "zagreb") return "/images/region-zagreb.png"
  return "/images/hero-night.png"
}
