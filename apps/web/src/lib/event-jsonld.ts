import type { CroEvent } from "./data"

type PostalAddress = {
  "@type": "PostalAddress"
  streetAddress?: string
  addressLocality?: string
  addressCountry: "HR"
}

type Place = {
  "@type": "Place"
  name?: string
  address?: PostalAddress
}

type Offer = {
  "@type": "Offer"
  price?: string
  priceCurrency: "EUR"
  availability?: "https://schema.org/InStock"
  url?: string
}

export type EventJsonLd = {
  "@context": "https://schema.org"
  "@type": "Event"
  name: string
  description: string
  startDate: string
  endDate?: string
  eventStatus: "https://schema.org/EventScheduled"
  eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode"
  url: string
  image?: string[]
  location?: Place
  organizer?: { "@type": "Organization"; name: string }
  offers?: Offer
}

const PLACEHOLDER_ORGANIZER = "Organizator nije naveden"

/** Serializes a value to JSON safely for embedding in a <script> tag — escapes
 *  characters that could otherwise close the tag early (e.g. `</script>` inside
 *  user-supplied text like an event title or description). */
export function safeJsonLdString(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c")
}

/**
 * Maps a fetched CroEvent to schema.org Event JSON-LD. Only includes fields
 * that are actually known — no invented addresses, organizers, or prices.
 * startDate/endDate use startsAtISO/endsAtISO (raw, unadjusted timestamps with
 * the Europe/Zagreb offset) when available; falls back to date+time for the
 * static demo dataset, which has no raw ISO timestamps.
 */
export function eventToJsonLd(event: CroEvent, webUrl: string): EventJsonLd {
  const startDate = event.startsAtISO ?? `${event.date}T${event.time}`
  const endDate = event.endsAtISO

  const address: PostalAddress | undefined =
    event.address || event.city
      ? {
          "@type": "PostalAddress",
          ...(event.address ? { streetAddress: event.address } : {}),
          ...(event.city ? { addressLocality: event.city } : {}),
          addressCountry: "HR",
        }
      : undefined

  const location: Place | undefined =
    event.venue || address
      ? {
          "@type": "Place",
          ...(event.venue ? { name: event.venue } : {}),
          ...(address ? { address } : {}),
        }
      : undefined

  const organizer =
    event.organizer && event.organizer !== PLACEHOLDER_ORGANIZER
      ? { "@type": "Organization" as const, name: event.organizer }
      : undefined

  let offers: Offer | undefined
  if (event.free) {
    offers = { "@type": "Offer", price: "0", priceCurrency: "EUR", availability: "https://schema.org/InStock" }
  } else if (event.price) {
    offers = { "@type": "Offer", price: event.price, priceCurrency: "EUR", ...(event.ticketUrl ? { url: event.ticketUrl } : {}) }
  }

  return {
    "@context": "https://schema.org",
    "@type": "Event",
    name: event.title,
    description: event.description,
    startDate,
    ...(endDate ? { endDate } : {}),
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    url: `${webUrl}/eventi/${event.slug}`,
    ...(event.image ? { image: [event.image] } : {}),
    ...(location ? { location } : {}),
    ...(organizer ? { organizer } : {}),
    ...(offers ? { offers } : {}),
  }
}

export type ItemListJsonLd = {
  "@context": "https://schema.org"
  "@type": "ItemList"
  itemListElement: { "@type": "ListItem"; position: number; url: string }[]
}

/**
 * Builds an ItemList JSON-LD for a listing page (search results, category,
 * region, or city page) — links each visible event by position, giving
 * Google a structured view of the page's contents without duplicating full
 * Event data (which belongs on each event's own detail page).
 */
export function eventsToItemListJsonLd(events: CroEvent[], webUrl: string): ItemListJsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: events.map((event, index) => ({
      "@type": "ListItem",
      position: index + 1,
      url: `${webUrl}/eventi/${event.slug}`,
    })),
  }
}

export type BreadcrumbJsonLd = {
  "@context": "https://schema.org"
  "@type": "BreadcrumbList"
  itemListElement: { "@type": "ListItem"; position: number; name: string; item: string }[]
}

/** Builds a BreadcrumbList JSON-LD from an ordered trail of {name, path} crumbs. */
export function breadcrumbsToJsonLd(crumbs: { name: string; path: string }[], webUrl: string): BreadcrumbJsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((crumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: crumb.name,
      item: `${webUrl}${crumb.path}`,
    })),
  }
}
