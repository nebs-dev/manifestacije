import { afterEach, describe, expect, it, vi } from "vitest"
import { fetchEvents } from "./public-api"

const apiEvent = {
  id: 31,
  title: "Cipelcugom po Osijeku",
  slug: "cipelcugom-po-osijeku",
  description: "Storytelling tura Osijekom.",
  shortDescription: "Tura gradom",
  startsAt: "2026-07-04T18:30:00.000Z",
  endsAt: null,
  isAllDay: false,
  isFree: true,
  priceText: null,
  ticketUrl: "https://tickets.example/event",
  sourceUrl: "https://source.example/event",
  imageUrl: "https://res.cloudinary.com/demo/image/upload/event.jpg",
  imageAlt: "Ljudi u šetnji Osijekom",
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
      image: "https://res.cloudinary.com/demo/image/upload/c_fill,g_auto,f_auto,q_auto,w_1200,h_900/event.jpg",
      imageAlt: "Ljudi u šetnji Osijekom",
      category: "na-otvorenom",
      categories: [
        { slug: "na-otvorenom", name: "Na otvorenom" },
        { slug: "sport", name: "Sport" },
      ],
      outdoor: true,
      free: true,
    }))
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

  it("falls back to mock data if public API fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")))

    const events = await fetchEvents()

    expect(events.length).toBeGreaterThan(0)
  })
})
