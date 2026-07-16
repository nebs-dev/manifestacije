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
  organizer?: { "@type": "Organization"; name: string; url?: string }
  offers?: Offer
}

const PLACEHOLDER_ORGANIZER = "Organizator nije naveden"

/**
 * Normalizes a free-text price string (as entered by an admin or extracted by
 * the AI parser, e.g. "25 EUR", "20 € ", "41,50", "od 15€") into the bare
 * numeric string schema.org's Offer.price requires. Returns undefined when no
 * reliable single number can be extracted — callers must omit the whole
 * offers object in that case rather than emitting a guessed or malformed value.
 */
export function normalizeOfferPrice(raw: string): string | undefined {
  const trimmed = raw.trim()
  if (!trimmed) return undefined

  // Reject ranges/lists ("15-20 EUR", "15 ili 20 EUR") and "starting at" text
  // ("od 15 EUR") — schema.org Offer.price is a single value, so a range or a
  // qualified minimum can't be represented without guessing which number (or
  // whether the qualifier changes the meaning) Google should treat as truth.
  if (/[-–—/]|\bili\b|\bod\b/i.test(trimmed)) return undefined

  const match = trimmed.match(/(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,2})?)/)
  if (!match) return undefined

  const numeric = match[1]
  // Distinguish "1.234,56" (thousands+decimal) from "41,50" (decimal only) by
  // presence of both separators vs. one; a single comma or dot is always the
  // decimal separator here since event ticket prices never reach four digits.
  const hasThousands = /[.,]\d{3}(?:[.,]|$)/.test(numeric) && numeric.replace(/[^.,]/g, "").length > 1
  const normalized = hasThousands
    ? numeric.replace(/\./g, "").replace(",", ".")
    : numeric.replace(",", ".")

  const value = Number(normalized)
  if (!Number.isFinite(value) || value < 0) return undefined

  // Schema.org expects a plain number string — trim a trailing ".00" but keep
  // real cents (e.g. "41.50" stays, "25.00" becomes "25").
  return String(value)
}

/** True for absolute http(s) URLs only — rejects mailto:, bare emails, and other non-URL strings. */
function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === "http:" || url.protocol === "https:"
  } catch {
    return false
  }
}

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
      ? {
          "@type": "Organization" as const,
          name: event.organizer,
          ...(event.organizerUrl && isHttpUrl(event.organizerUrl) ? { url: event.organizerUrl } : {}),
        }
      : undefined

  let offers: Offer | undefined
  if (event.free) {
    offers = { "@type": "Offer", price: "0", priceCurrency: "EUR", availability: "https://schema.org/InStock" }
  } else if (event.price) {
    const normalizedPrice = normalizeOfferPrice(event.price)
    // Omit the whole offers object when the price can't be reliably parsed to
    // a bare number — a malformed or missing price is worse than no offer at
    // all, since Google flags invalid offers.price as a structured-data error.
    if (normalizedPrice !== undefined) {
      offers = {
        "@type": "Offer",
        price: normalizedPrice,
        priceCurrency: "EUR",
        ...(event.ticketUrl && isHttpUrl(event.ticketUrl) ? { url: event.ticketUrl } : {}),
      }
    }
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
