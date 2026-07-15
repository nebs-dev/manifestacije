import { cloudinaryImage, eventHasCategory, events as fallbackEvents, toZagrebISOString, type CategorySlug, type CroEvent, type RegionSlug } from "./data"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"
export const WEB_URL = process.env.NEXT_PUBLIC_WEB_URL || "http://localhost:3000"

type ApiTaxonomy = { id: number; name: string; slug: string; lat?: number | null; lng?: number | null }

type ApiEventCategory = {
  eventId: number
  categoryId: number
  category: ApiTaxonomy
}

type ApiEvent = {
  id: number
  title: string
  slug: string
  description: string
  startsAt: string
  endsAt?: string | null
  isAllDay?: boolean | null
  isFree?: boolean | null
  priceText?: string | null
  ticketUrl?: string | null
  sourceUrl?: string | null
  imageUrl?: string | null
  extractionConfidence?: number | null
  isFeatured?: boolean | null
  organizer?: { id: number; name: string } | null
  venue?: { id: number; name: string; address?: string | null; lat?: number | null; lng?: number | null } | null
  cityName?: string | null
  city?: ApiTaxonomy | null
  address?: string | null
  lat?: number | null
  lng?: number | null
  county?: ApiTaxonomy
  region?: ApiTaxonomy
  category: ApiTaxonomy
  categories?: ApiEventCategory[]
}

export type PublicCategory = { id: number; name: string; slug: string; sortOrder: number }
export type PublicRegion = { id: number; name: string; slug: string; sortOrder: number }

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

export async function fetchCategories(): Promise<PublicCategory[]> {
  return fetchApi<PublicCategory[]>("/api/public/categories", 3600, ["taxonomy"]).catch(() => [])
}

export async function fetchRegions(): Promise<PublicRegion[]> {
  return fetchApi<PublicRegion[]>("/api/public/regions", 3600, ["taxonomy"]).catch(() => [])
}

export async function fetchEvents(filters: PublicFilters = {}) {
  const params = new URLSearchParams()
  if (filters.q) params.set("search", filters.q)
  // Category: explicit filter takes priority; kids/outdoor map to category slugs
  if (filters.category) {
    params.set("category", filters.category)
  } else if (filters.kids) {
    params.set("category", "djeca-i-obitelj")
  } else if (filters.outdoor) {
    params.set("category", "na-otvorenom")
  }
  if (filters.region) params.set("region", reverseRegionMap[filters.region] || filters.region)
  if (filters.city) params.set("city", filters.city)
  if (filters.free) params.set("free", "true")
  if (filters.when === "danas") params.set("today", "true")
  if (filters.when === "ovaj-vikend") params.set("weekend", "true")
  if (filters.when === "ovaj-mjesec") params.set("month", "true")
  const path = `/api/public/events${params.size ? `?${params.toString()}` : ""}`
  return fetchApi<ApiEvent[]>(path).then((rows) => rows.map(toCroEvent).filter(notPast)).catch(() => fallbackEvents.filter(notPast))
}

export async function fetchEvent(slug: string) {
  const event = await fetchApi<ApiEvent | null>(`/api/public/events/${slug}`).catch(() => null)
  if (event) return toCroEvent(event)
  return fallbackEvents.find((item) => item.slug === slug) || null
}

export async function fetchRelatedEvents(event: CroEvent) {
  const all = await fetchEvents()
  return all
    .filter((item) => item.slug !== event.slug && (item.region === event.region || event.categories.some((category) => eventHasCategory(item, category.slug))))
    .slice(0, 3)
}

export async function fetchMapEvents() {
  return fetchApi<ApiEvent[]>("/api/public/map/events", 300)
    .then((rows) => rows.map(toCroEvent).filter(notPast))
    .catch(() => fallbackEvents.filter(notPast))
}

const TZ = "Europe/Zagreb"

function toZagrebDate(d: Date): string {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function notPast(e: CroEvent): boolean {
  const today = toZagrebDate(new Date())
  return e.endDate ? e.endDate >= today : e.date >= today
}

async function fetchApi<T>(path: string, revalidate = 60, tags: string[] = ["events"]): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, { next: { revalidate, tags } })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  return res.json() as Promise<T>
}

function toCroEvent(event: ApiEvent): CroEvent {
  const starts = new Date(event.startsAt)
  const ends = event.endsAt ? new Date(event.endsAt) : null
  const now = new Date()
  // For ongoing multi-day events, advance display date to today so past start dates don't show
  const displayStart = ends && starts < now ? now : starts
  const region = regionMap[event.region?.slug || ""] || "slavonija"

  // Build categories list from EventCategory join; fall back to singular category
  const rawCats: { slug: string; name: string }[] =
    event.categories && event.categories.length > 0
      ? event.categories.map((ec) => ({ slug: ec.category.slug, name: ec.category.name }))
      : [{ slug: event.category.slug, name: event.category.name }]
  const allCats = Array.from(new Map(rawCats.map((category) => [category.slug, category])).values())

  const primarySlug = allCats[0]?.slug || event.category.slug

  return {
    slug: event.slug,
    title: event.title,
    category: primarySlug as CategorySlug,
    categories: allCats,
    region,
    city: event.cityName ?? event.city?.name ?? "",
    venue: event.venue?.name || event.cityName || event.city?.name || "",
    date: toZagrebDate(displayStart),
    endDate: ends ? toZagrebDate(ends) : undefined,
    startsAtISO: toZagrebISOString(starts),
    endsAtISO: ends ? toZagrebISOString(ends) : undefined,
    time: new Intl.DateTimeFormat("hr-HR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" }).format(starts),
    allDay: event.isAllDay === true,
    free: event.isFree === true,
    price: event.priceText || undefined,
    forKids: primarySlug === "djeca-i-obitelj" || allCats.some((c) => c.slug === "djeca-i-obitelj"),
    outdoor: primarySlug === "na-otvorenom" || primarySlug === "outdoor" ||
      allCats.some((c) => c.slug === "na-otvorenom" || c.slug === "outdoor"),
    description: event.description,
    longDescription: event.description,
    organizer: event.organizer?.name || "Organizator nije naveden",
    source: event.sourceUrl || "Manifestacije.hr",
    ticketUrl: event.ticketUrl || undefined,
    // Sized for the largest common display context (event card in a 3-column grid,
    // ~350-400px wide) at 2x for retina.
    image: cloudinaryImage(event.imageUrl, { w: 800, h: 600 }) || undefined,
    // Full-bleed detail page hero needs more resolution than a card thumbnail.
    heroImage: cloudinaryImage(event.imageUrl, { w: 1600, h: 900 }) || undefined,
    featured: event.isFeatured === true || (event.extractionConfidence ? event.extractionConfidence >= 0.85 : false),
    address: event.address ?? event.venue?.address ?? undefined,
    lat: (event.lat ?? event.venue?.lat ?? event.city?.lat) ?? undefined,
    lng: (event.lng ?? event.venue?.lng ?? event.city?.lng) ?? undefined,
    map: { x: 50, y: 50 },
  }
}
