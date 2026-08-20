import { CITY_COORDS, cloudinaryImage, eventHasCategory, events as fallbackEvents, toZagrebISOString, type CategorySlug, type CroEvent, type RegionSlug } from "./data"
import { eventOccursDuringCurrentWeekend } from "./weekend"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"
export const WEB_URL = process.env.NEXT_PUBLIC_WEB_URL || "http://localhost:3000"
const TZ = "Europe/Zagreb"
const ZAGREB_DATE_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
})
const ZAGREB_TIME_FORMATTER = new Intl.DateTimeFormat("hr-HR", {
  timeZone: TZ,
  hour: "2-digit",
  minute: "2-digit",
})

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
  description?: string
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
  organizer?: { id: number; name: string; websiteUrl?: string | null; slug?: string; status?: string } | null
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
  occurrences?: Array<{
    id: number
    startsAt: string
    endsAt?: string | null
    isAllDay?: boolean | null
  }>
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
  "sredisnja-hrvatska": "sredisnja",
  "lika-i-gorski-kotar": "lika",
  "medimurje-i-zagorje": "medimurje",
}

const reverseRegionMap: Record<string, string> = {
  slavonija: "slavonija-i-baranja",
  zagreb: "zagreb-i-okolica",
  dalmacija: "dalmacija",
  istra: "istra-i-kvarner",
  kvarner: "istra-i-kvarner",
  lika: "lika-i-gorski-kotar",
  sredisnja: "sredisnja-hrvatska",
  medimurje: "medimurje-i-zagorje",
}

function slugifyLabel(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
}

function coordPair(lat?: number | null, lng?: number | null) {
  if (typeof lat !== "number" || typeof lng !== "number") return null
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  return { lat, lng }
}

function coordsForCityLabel(label?: string | null) {
  if (!label) return null
  const tokens = [label, ...label.split(",")]
    .map((part) => slugifyLabel(part))
    .filter(Boolean)
  const city = Object.entries(CITY_COORDS).find(([name]) => tokens.includes(slugifyLabel(name)))
  if (!city) return null
  const [lat, lng] = city[1]
  return { lat, lng }
}

function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number) {
  const toRad = (value: number) => (value * Math.PI) / 180
  const earthRadiusKm = 6371
  const dLat = toRad(bLat - aLat)
  const dLng = toRad(bLng - aLng)
  const sinLat = Math.sin(dLat / 2)
  const sinLng = Math.sin(dLng / 2)
  const a =
    sinLat * sinLat +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * sinLng * sinLng
  return 2 * earthRadiusKm * Math.asin(Math.sqrt(a))
}

function resolveEventCoordinates(event: ApiEvent) {
  const cityCoords =
    coordPair(event.city?.lat, event.city?.lng) ??
    coordsForCityLabel(event.city?.name) ??
    coordsForCityLabel(event.cityName)

  const plausibleNearCity = (lat?: number | null, lng?: number | null) => {
    const coords = coordPair(lat, lng)
    if (!coords) return null
    if (!cityCoords) return coords
    return distanceKm(coords.lat, coords.lng, cityCoords.lat, cityCoords.lng) <= 80 ? coords : null
  }

  const eventCoords = plausibleNearCity(event.lat, event.lng)
  if (eventCoords) return eventCoords

  const venueCoords = plausibleNearCity(event.venue?.lat, event.venue?.lng)
  if (venueCoords) return venueCoords

  if (cityCoords) return cityCoords
  const rawEventCoords = coordPair(event.lat, event.lng)
  if (rawEventCoords) return rawEventCoords
  return { lat: undefined, lng: undefined }
}

export async function fetchCategories(): Promise<PublicCategory[]> {
  return fetchApi<PublicCategory[]>("/api/public/categories", 3600, ["taxonomy"]).catch(() => [])
}

export async function fetchRegions(): Promise<PublicRegion[]> {
  return fetchApi<PublicRegion[]>("/api/public/regions", 3600, ["taxonomy"]).catch(() => [])
}

export type PublicPartner = { id: number; name: string; logoUrl: string; websiteUrl?: string | null; sortOrder: number }

export async function fetchPartners(): Promise<PublicPartner[]> {
  return fetchApi<PublicPartner[]>("/api/public/partners", 3600, ["partners"]).catch(() => [])
}

export async function fetchEvents(filters: PublicFilters = {}) {
  const params = new URLSearchParams()
  params.set("compact", "true")
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
  return fetchApi<ApiEvent[]>(path).then(mapApiEvents).catch(() => fallbackEventsForFilters(filters))
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

export type ApiOrganizer = { id: number; name: string; slug: string; status: string }

export async function fetchOrganizer(slug: string) {
  return fetchApi<ApiOrganizer | null>(`/api/public/organizers/${slug}`, 60, ["organizers"]).catch(() => null)
}

export async function fetchMapEvents() {
  return fetchApi<ApiEvent[]>("/api/public/map/events", 300)
    .then(mapApiEvents)
    .catch(() => filterNotPast(fallbackEvents))
}

function toZagrebDate(d: Date): string {
  const parts = ZAGREB_DATE_FORMATTER.formatToParts(d)
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? ""
  return `${part("year")}-${part("month")}-${part("day")}`
}

function mapApiEvents(rows: ApiEvent[]) {
  const now = new Date()
  const today = toZagrebDate(now)
  return rows.map((event) => toCroEvent(event, now)).filter((event) => notPast(event, today))
}

function notPast(e: CroEvent, today = toZagrebDate(new Date())): boolean {
  return e.endDate ? e.endDate >= today : e.date >= today
}

function filterNotPast(events: CroEvent[]) {
  const today = toZagrebDate(new Date())
  return events.filter((event) => notPast(event, today))
}

function fallbackEventsForFilters(filters: PublicFilters): CroEvent[] {
  const today = toZagrebDate(new Date())
  const q = normalizeSearch(filters.q ?? "")
  const qTokens = [...new Set(q.split(" ").filter((token) => token.length >= 2))]
  const region = filters.region ? (reverseRegionMap[filters.region] || filters.region) : undefined
  return fallbackEvents
    .filter((event) => notPast(event, today))
    .filter((event) => {
      if (filters.category && !eventHasCategory(event, filters.category)) return false
      if (region && (reverseRegionMap[event.region] || event.region) !== region) return false
      if (filters.city && citySlugForFallback(event) !== filters.city && event.city.toLowerCase() !== filters.city.toLowerCase()) return false
      if (filters.free && !event.free) return false
      if (filters.kids && !event.forKids) return false
      if (filters.outdoor && !event.outdoor) return false
      if (filters.when === "danas" && !(event.date <= today && (event.endDate || event.date) >= today)) return false
      if (filters.when === "ovaj-vikend" && !eventOccursDuringCurrentWeekend(event)) return false
      if (filters.when === "ovaj-mjesec" && event.date.slice(0, 7) !== today.slice(0, 7)) return false
      if (qTokens.length > 0) {
        const hay = normalizeSearch([
          event.title,
          event.description,
          event.longDescription,
          event.city,
          event.citySlug,
          event.venue,
          event.address,
          event.organizer,
          event.source,
          event.price,
          event.region,
          event.category,
          ...event.categories.flatMap((category) => [category.slug, category.name]),
        ].filter(Boolean).join(" "))
        if (!matchesFuzzySearch(hay, q, qTokens)) return false
      }
      return true
    })
}

function normalizeSearch(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/ð/g, "d")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function matchesFuzzySearch(haystack: string, query: string, queryTokens: string[]) {
  const haystackTokens = [...new Set(haystack.split(" ").filter((token) => token.length >= 2))]
  if (haystack.includes(query)) return true
  return queryTokens.every((token) => {
    if (haystack.includes(token)) return true
    const maxDistance = token.length <= 4 ? 1 : Math.max(1, Math.floor(token.length * 0.25))
    return haystackTokens.some((candidate) => {
      if (Math.abs(candidate.length - token.length) > maxDistance) return false
      return levenshtein(token, candidate, maxDistance) <= maxDistance
    })
  })
}

function levenshtein(a: string, b: string, maxDistance: number) {
  if (a === b) return 0
  if (Math.abs(a.length - b.length) > maxDistance) return maxDistance + 1
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index)
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i]
    let rowMin = current[0]
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      current[j] = Math.min(current[j - 1] + 1, previous[j] + 1, previous[j - 1] + cost)
      rowMin = Math.min(rowMin, current[j])
    }
    if (rowMin > maxDistance) return maxDistance + 1
    previous = current
  }
  return previous[b.length]
}

function citySlugForFallback(event: CroEvent) {
  return event.citySlug || slugifyLabel(event.city)
}

async function fetchApi<T>(path: string, revalidate = 60, tags: string[] = ["events"]): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, { next: { revalidate, tags } })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  return res.json() as Promise<T>
}

function toCroEvent(event: ApiEvent, now = new Date()): CroEvent {
  const starts = new Date(event.startsAt)
  const ends = event.endsAt ? new Date(event.endsAt) : null
  const timeLabel = (value: Date) => ZAGREB_TIME_FORMATTER.format(value)
  const occurrences = (event.occurrences ?? []).map((occurrence) => {
    const occurrenceStart = new Date(occurrence.startsAt)
    const occurrenceEnd = occurrence.endsAt ? new Date(occurrence.endsAt) : null
    return {
      id: String(occurrence.id),
      date: toZagrebDate(occurrenceStart),
      endDate: occurrenceEnd ? toZagrebDate(occurrenceEnd) : undefined,
      startsAtISO: toZagrebISOString(occurrenceStart),
      endsAtISO: occurrenceEnd ? toZagrebISOString(occurrenceEnd) : undefined,
      time: timeLabel(occurrenceStart),
      allDay: occurrence.isAllDay === true,
    }
  })
  const selectedOccurrence = occurrences.find((occurrence) => {
    const endpoint = new Date(occurrence.endsAtISO ?? occurrence.startsAtISO)
    return endpoint >= now
  }) ?? occurrences[occurrences.length - 1]
  // Legacy ongoing ranges keep their existing display behavior. Occurrence-backed
  // events instead show the next active/upcoming real slot.
  const displayStart = selectedOccurrence
    ? new Date(selectedOccurrence.startsAtISO)
    : ends && starts < now ? now : starts
  const displayEnd = selectedOccurrence?.endsAtISO ? new Date(selectedOccurrence.endsAtISO) : ends
  const region = regionMap[event.region?.slug || ""] || "nepoznato"

  // Build categories list from EventCategory join; fall back to singular category
  const rawCats: { slug: string; name: string }[] =
    event.categories && event.categories.length > 0
      ? event.categories.map((ec) => ({ slug: ec.category.slug, name: ec.category.name }))
      : [{ slug: event.category.slug, name: event.category.name }]
  const allCats = Array.from(new Map(rawCats.map((category) => [category.slug, category])).values())

  const primarySlug = allCats[0]?.slug || event.category.slug
  const coords = resolveEventCoordinates(event)

  return {
    slug: event.slug,
    title: event.title,
    category: primarySlug as CategorySlug,
    categories: allCats,
    region,
    city: event.city?.name ?? event.cityName ?? "",
    citySlug: event.city?.slug || (event.cityName ? slugifyLabel(event.cityName) : undefined),
    venue: event.venue?.name || event.cityName || event.city?.name || "",
    date: selectedOccurrence?.date ?? toZagrebDate(displayStart),
    endDate: selectedOccurrence?.endDate ?? (displayEnd ? toZagrebDate(displayEnd) : undefined),
    startsAtISO: selectedOccurrence?.startsAtISO ?? toZagrebISOString(starts),
    endsAtISO: selectedOccurrence?.endsAtISO ?? (ends ? toZagrebISOString(ends) : undefined),
    occurrences: occurrences.length ? occurrences : undefined,
    displayOccurrenceId: selectedOccurrence?.id,
    time: selectedOccurrence?.time ?? timeLabel(starts),
    allDay: selectedOccurrence?.allDay ?? event.isAllDay === true,
    free: event.isFree === true,
    price: event.priceText || undefined,
    forKids: primarySlug === "djeca-i-obitelj" || allCats.some((c) => c.slug === "djeca-i-obitelj"),
    outdoor: primarySlug === "na-otvorenom" || primarySlug === "outdoor" ||
      allCats.some((c) => c.slug === "na-otvorenom" || c.slug === "outdoor"),
    description: event.description ?? "",
    longDescription: event.description ?? "",
    organizer: event.organizer?.name || "Organizator nije naveden",
    organizerUrl: event.organizer?.websiteUrl || undefined,
    organizerSlug: event.organizer?.status === "UNCLAIMED" ? event.organizer?.slug : undefined,
    organizerClaimable: event.organizer?.status === "UNCLAIMED",
    source: event.sourceUrl || "Manifestacije.hr",
    ticketUrl: event.ticketUrl || undefined,
    // Sized for the largest common display context (event card in a 3-column grid,
    // ~350-400px wide) at 2x for retina.
    image: cloudinaryImage(event.imageUrl, { w: 640, h: 480 }) || undefined,
    // Full-bleed detail page hero needs more resolution than a card thumbnail.
    heroImage: cloudinaryImage(event.imageUrl, { w: 1600, h: 900 }) || undefined,
    featured: event.isFeatured === true || (event.extractionConfidence ? event.extractionConfidence >= 0.85 : false),
    address: event.address ?? event.venue?.address ?? undefined,
    lat: coords.lat,
    lng: coords.lng,
    map: { x: 50, y: 50 },
  }
}
