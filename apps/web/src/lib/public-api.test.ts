import { afterEach, describe, expect, it, vi } from "vitest"
import { fetchEvents, fetchMapEvents } from "./public-api"

const apiEvent = {
  id: 31,
  title: "Cipelcugom po Osijeku",
  slug: "cipelcugom-po-osijeku",
  description: "Storytelling tura Osijekom.",
  startsAt: "2099-07-04T18:30:00.000Z",
  endsAt: null,
  isAllDay: false,
  isFree: true,
  priceText: null,
  ticketUrl: "https://tickets.example/event",
  sourceUrl: "https://source.example/event",
  imageUrl: "https://res.cloudinary.com/demo/image/upload/event.jpg",
  extractionConfidence: 0.9,
  organizer: { id: 5, name: "TZ Osijek" },
  venue: { id: 7, name: "Tvrđa", address: "Trg 1", lat: 45.56, lng: 18.69 },
  city: { id: 1, name: "Osijek", slug: "osijek", lat: 45.55, lng: 18.69 },
  county: { id: 2, name: "Osječko-baranjska", slug: "osjecko-baranjska" },
  region: { id: 3, name: "Slavonija i Baranja", slug: "slavonija-i-baranja" },
  category: { id: 4, name: "Na otvorenom", slug: "na-otvorenom" },
  categories: [
    { eventId: 31, categoryId: 4, isPrimary: true, category: { id: 4, name: "Na otvorenom", slug: "na-otvorenom" } },
    { eventId: 31, categoryId: 9, isPrimary: false, category: { id: 9, name: "Sport", slug: "sport" } },
  ],
}

describe("public API adapter", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("maps API event image metadata into CroEvent", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [apiEvent],
    }))

    const events = await fetchEvents()

    expect(events[0]).toEqual(expect.objectContaining({
      slug: "cipelcugom-po-osijeku",
      // Card-sized transform (640x480) — smaller listing image for faster mobile loads.
      image: "https://res.cloudinary.com/demo/image/upload/c_fill,g_auto,f_auto,q_auto,w_640,h_480/event.jpg",
      // Larger transform (1600x900) for the full-bleed event detail page hero.
      heroImage: "https://res.cloudinary.com/demo/image/upload/c_fill,g_auto,f_auto,q_auto,w_1600,h_900/event.jpg",
      category: "na-otvorenom",
      categories: [
        { slug: "na-otvorenom", name: "Na otvorenom" },
        { slug: "sport", name: "Sport" },
      ],
      outdoor: true,
      free: true,
    }))
  })

  it("maps the lightweight map response without detail-only fields", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{
        ...apiEvent,
        description: undefined,
        imageUrl: undefined,
        organizer: undefined,
        ticketUrl: undefined,
        sourceUrl: undefined,
      }],
    })
    vi.stubGlobal("fetch", fetchMock)

    const events = await fetchMapEvents()

    expect(String(fetchMock.mock.calls[0][0])).toContain("/api/public/map/events")
    expect(events[0]).toEqual(expect.objectContaining({
      slug: apiEvent.slug,
      description: "",
      image: undefined,
      lat: apiEvent.venue.lat,
      lng: apiEvent.venue.lng,
    }))
  })

  it("maps explicit occurrences and selects next upcoming slot for generic cards", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2099-07-04T12:00:00.000Z"))
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{
        ...apiEvent,
        startsAt: "2099-07-04T06:00:00.000Z",
        endsAt: "2099-07-06T20:00:00.000Z",
        occurrences: [
          { id: 1, startsAt: "2099-07-04T06:00:00.000Z", endsAt: "2099-07-04T10:00:00.000Z", isAllDay: false },
          { id: 2, startsAt: "2099-07-06T16:00:00.000Z", endsAt: "2099-07-06T20:00:00.000Z", isAllDay: false },
        ],
      }],
    }))

    const [event] = await fetchEvents()
    expect(event.date).toBe("2099-07-06")
    expect(event.displayOccurrenceId).toBe("2")
    expect(event.occurrences).toHaveLength(2)
    vi.useRealTimers()
  })

  it("builds public event query params for filters", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => [] })
    vi.stubGlobal("fetch", fetchMock)

    await fetchEvents({ q: "osijek", kids: true, outdoor: true, free: true, region: "slavonija", city: "osijek", when: "danas" })

    const url = String(fetchMock.mock.calls[0][0])
    expect(url).toContain("/api/public/events?")
    expect(url).toContain("search=osijek")
    expect(url).toContain("category=djeca-i-obitelj")
    expect(url).toContain("free=true")
    expect(url).toContain("region=slavonija-i-baranja")
    expect(url).toContain("city=osijek")
    expect(url).toContain("today=true")
    expect(url).not.toContain("outdoor=true")
  })

  it("ignores event coordinates that are far away from the event city", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{
        ...apiEvent,
        lat: 45.1,
        lng: 15.5,
        venue: null,
      }],
    }))

    const events = await fetchEvents()

    expect(events[0]).toEqual(expect.objectContaining({
      city: "Osijek",
      lat: 45.55,
      lng: 18.69,
    }))
  })

  it("uses known city coordinates when cityName contains a venue and city label", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{
        ...apiEvent,
        lat: 45.1,
        lng: 15.5,
        cityName: "Kopacabana, Osijek",
        city: null,
        venue: null,
      }],
    }))

    const events = await fetchEvents()

    expect(events[0]).toEqual(expect.objectContaining({
      city: "Kopacabana, Osijek",
      lat: 45.555,
      lng: 18.695,
    }))
  })

  it("keeps event coordinates when they are plausible for the event city", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{
        ...apiEvent,
        lat: 45.558,
        lng: 18.693,
      }],
    }))

    const events = await fetchEvents()

    expect(events[0]).toEqual(expect.objectContaining({
      lat: 45.558,
      lng: 18.693,
    }))
  })

  it("uses canonical city relation before legacy cityName in public display", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{
        ...apiEvent,
        cityName: "Donji Kukuljica",
      }],
    }))

    const events = await fetchEvents()

    expect(events[0]).toEqual(expect.objectContaining({
      city: "Osijek",
      citySlug: "osijek",
    }))
  })

  it("falls back to mock data if public API fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")))

    const events = await fetchEvents()

    expect(events.length).toBeGreaterThan(0)
  })

  it("applies filters to fallback data when the public API is offline", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")))

    const events = await fetchEvents({ city: "osijek" })

    expect(events).toEqual([])
  })

  it("searches fallback data across categories and other event fields", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")))

    const events = await fetchEvents({ q: "festivali" })

    expect(events.length).toBeGreaterThan(0)
    expect(events.some((event) => event.categories.some((category) => category.name === "Festivali"))).toBe(true)
  })
})
