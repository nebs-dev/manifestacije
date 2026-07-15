import { describe, expect, it } from "vitest"
import { eventToJsonLd, eventsToItemListJsonLd, breadcrumbsToJsonLd, safeJsonLdString } from "./event-jsonld"
import type { CroEvent } from "./data"

const WEB_URL = "https://manifestacije.hr"

function baseEvent(overrides: Partial<CroEvent> = {}): CroEvent {
  return {
    slug: "tvrdja-fest",
    title: "Tvrđa Fest",
    category: "glazba",
    categories: [{ slug: "glazba", name: "Glazba" }],
    region: "slavonija",
    city: "Osijek",
    venue: "Tvrđa",
    date: "2026-08-28",
    time: "18:00",
    startsAtISO: "2026-08-28T18:00:00+02:00",
    free: false,
    forKids: false,
    outdoor: true,
    description: "Ljetni glazbeni festival u Tvrđi.",
    longDescription: "Ljetni glazbeni festival u Tvrđi.",
    organizer: "TZ Osijek",
    source: "https://source.example",
    map: { x: 50, y: 50 },
    ...overrides,
  }
}

describe("eventToJsonLd", () => {
  it("maps a fully-populated event to schema.org Event JSON-LD", () => {
    const event = baseEvent({
      endsAtISO: "2026-08-29T02:00:00+02:00",
      image: "https://res.cloudinary.com/demo/image/upload/event.jpg",
      address: "Kuhačeva 1",
      price: "od 25 EUR",
      ticketUrl: "https://tickets.example/tvrdja-fest",
    })

    const jsonLd = eventToJsonLd(event, WEB_URL)

    expect(jsonLd).toEqual({
      "@context": "https://schema.org",
      "@type": "Event",
      name: "Tvrđa Fest",
      description: "Ljetni glazbeni festival u Tvrđi.",
      startDate: "2026-08-28T18:00:00+02:00",
      endDate: "2026-08-29T02:00:00+02:00",
      eventStatus: "https://schema.org/EventScheduled",
      eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
      url: "https://manifestacije.hr/eventi/tvrdja-fest",
      image: ["https://res.cloudinary.com/demo/image/upload/event.jpg"],
      location: {
        "@type": "Place",
        name: "Tvrđa",
        address: {
          "@type": "PostalAddress",
          streetAddress: "Kuhačeva 1",
          addressLocality: "Osijek",
          addressCountry: "HR",
        },
      },
      organizer: { "@type": "Organization", name: "TZ Osijek" },
      offers: { "@type": "Offer", price: "od 25 EUR", priceCurrency: "EUR", url: "https://tickets.example/tvrdja-fest" },
    })
  })

  it("uses startsAtISO instead of the display-adjusted date field", () => {
    // date is advanced to "today" for multi-day events in progress; startDate must use the raw timestamp.
    const event = baseEvent({ date: "2026-08-30", startsAtISO: "2026-08-28T18:00:00+02:00" })
    const jsonLd = eventToJsonLd(event, WEB_URL)
    expect(jsonLd.startDate).toBe("2026-08-28T18:00:00+02:00")
  })

  it("falls back to date+time when startsAtISO is absent (static demo events)", () => {
    const event = baseEvent({ startsAtISO: undefined, date: "2026-08-28", time: "18:00" })
    const jsonLd = eventToJsonLd(event, WEB_URL)
    expect(jsonLd.startDate).toBe("2026-08-28T18:00")
  })

  it("omits endDate when not available, rather than inventing one", () => {
    const event = baseEvent({ endsAtISO: undefined, endDate: undefined })
    const jsonLd = eventToJsonLd(event, WEB_URL)
    expect(jsonLd.endDate).toBeUndefined()
    expect("endDate" in jsonLd).toBe(false)
  })

  it("omits image when not available", () => {
    const event = baseEvent({ image: undefined })
    const jsonLd = eventToJsonLd(event, WEB_URL)
    expect(jsonLd.image).toBeUndefined()
    expect("image" in jsonLd).toBe(false)
  })

  it("omits organizer when unknown (placeholder 'Organizator nije naveden')", () => {
    const event = baseEvent({ organizer: "Organizator nije naveden" })
    const jsonLd = eventToJsonLd(event, WEB_URL)
    expect(jsonLd.organizer).toBeUndefined()
    expect("organizer" in jsonLd).toBe(false)
  })

  it("builds a free-entry offer with price 0 when the event is free", () => {
    const event = baseEvent({ free: true, price: undefined })
    const jsonLd = eventToJsonLd(event, WEB_URL)
    expect(jsonLd.offers).toEqual({ "@type": "Offer", price: "0", priceCurrency: "EUR", availability: "https://schema.org/InStock" })
  })

  it("omits offers entirely when price is unknown and event is not free", () => {
    const event = baseEvent({ free: false, price: undefined, ticketUrl: undefined })
    const jsonLd = eventToJsonLd(event, WEB_URL)
    expect(jsonLd.offers).toBeUndefined()
    expect("offers" in jsonLd).toBe(false)
  })

  it("omits location when there is no venue and no address/city", () => {
    const event = baseEvent({ venue: "", city: "", address: undefined })
    const jsonLd = eventToJsonLd(event, WEB_URL)
    expect(jsonLd.location).toBeUndefined()
  })

  it("always uses OfflineEventAttendanceMode and EventScheduled", () => {
    const jsonLd = eventToJsonLd(baseEvent(), WEB_URL)
    expect(jsonLd.eventAttendanceMode).toBe("https://schema.org/OfflineEventAttendanceMode")
    expect(jsonLd.eventStatus).toBe("https://schema.org/EventScheduled")
  })

  it("builds an absolute canonical URL from the site URL and slug", () => {
    const jsonLd = eventToJsonLd(baseEvent({ slug: "neki-event" }), "https://manifestacije.hr")
    expect(jsonLd.url).toBe("https://manifestacije.hr/eventi/neki-event")
  })
})

describe("eventsToItemListJsonLd", () => {
  it("builds a positioned ItemList of event URLs", () => {
    const events = [baseEvent({ slug: "a" }), baseEvent({ slug: "b" }), baseEvent({ slug: "c" })]
    const jsonLd = eventsToItemListJsonLd(events, WEB_URL)
    expect(jsonLd).toEqual({
      "@context": "https://schema.org",
      "@type": "ItemList",
      itemListElement: [
        { "@type": "ListItem", position: 1, url: "https://manifestacije.hr/eventi/a" },
        { "@type": "ListItem", position: 2, url: "https://manifestacije.hr/eventi/b" },
        { "@type": "ListItem", position: 3, url: "https://manifestacije.hr/eventi/c" },
      ],
    })
  })

  it("returns an empty itemListElement for an empty event list", () => {
    const jsonLd = eventsToItemListJsonLd([], WEB_URL)
    expect(jsonLd.itemListElement).toEqual([])
  })
})

describe("breadcrumbsToJsonLd", () => {
  it("builds a positioned BreadcrumbList with absolute URLs", () => {
    const jsonLd = breadcrumbsToJsonLd(
      [
        { name: "Početna", path: "/" },
        { name: "Događanja", path: "/eventi" },
        { name: "Tvrđa Fest", path: "/eventi/tvrdja-fest" },
      ],
      WEB_URL
    )
    expect(jsonLd).toEqual({
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Početna", item: "https://manifestacije.hr/" },
        { "@type": "ListItem", position: 2, name: "Događanja", item: "https://manifestacije.hr/eventi" },
        { "@type": "ListItem", position: 3, name: "Tvrđa Fest", item: "https://manifestacije.hr/eventi/tvrdja-fest" },
      ],
    })
  })
})

describe("safeJsonLdString", () => {
  it("escapes '<' so a </script> inside event text cannot break out of the script tag", () => {
    const malicious = { name: 'Concert</script><script>alert(1)</script>' }
    const serialized = safeJsonLdString(malicious)
    expect(serialized).not.toContain("</script>")
    expect(serialized).toContain("\\u003c/script>")
  })

  it("still produces valid JSON that round-trips", () => {
    const value = { a: 1, b: "hello <world>" }
    const serialized = safeJsonLdString(value)
    expect(JSON.parse(serialized)).toEqual(value)
  })
})
