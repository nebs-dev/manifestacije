import { afterEach, describe, expect, it, vi } from "vitest"
import { breadcrumbsToJsonLd } from "./event-jsonld"
import { cityEventSummaries, citySeoFields, citySlugForEvent } from "./seo-taxonomy"

const osijekEvent = {
  slug: "koncert-u-osijeku",
  title: "Koncert u Osijeku",
  category: "glazba" as const,
  categories: [{ slug: "glazba", name: "Glazba" }],
  region: "slavonija" as const,
  city: "Osijek",
  citySlug: "osijek",
  venue: "Tvrđa",
  date: "2099-07-04",
  time: "18:30",
  free: true,
  forKids: false,
  outdoor: false,
  description: "Glazbeni program u Osijeku.",
  longDescription: "Glazbeni program u Osijeku.",
  organizer: "TZ Osijek",
  source: "Manifestacije.hr",
  map: { x: 50, y: 50 },
}

const vinkovciEvent = {
  ...osijekEvent,
  slug: "festival-u-vinkovcima",
  title: "Festival u Vinkovcima",
  category: "festivali" as const,
  categories: [{ slug: "festivali", name: "Festivali" }],
  city: "Vinkovci",
  citySlug: "vinkovci",
}

describe("city discovery SEO", () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it("builds /gradovi city navigation from visible events with valid city links and counts", () => {
    const cities = cityEventSummaries([osijekEvent, vinkovciEvent, { ...osijekEvent, slug: "radionica-osijek" }])

    expect(cities).toEqual([
      { slug: "osijek", name: "Osijek", count: 2 },
      { slug: "vinkovci", name: "Vinkovci", count: 1 },
    ])
    expect(cities.map((city) => `/gradovi/${city.slug}`)).toContain("/gradovi/osijek")
    expect(cities.every((city) => city.slug && city.name && city.count > 0)).toBe(true)
  })

  it("builds indexable Osijek metadata with a self canonical", () => {
    const metadata = citySeoFields("osijek", [osijekEvent], "https://manifestacije.hr")

    expect(metadata.title).toBe("Događanja u Osijeku – danas, ovaj vikend i uskoro | Manifestacije")
    expect(metadata.description).toContain("koncerata")
    expect(metadata.description).toContain("festivala")
    expect(metadata.description).toContain("kazališta")
    expect(metadata.description).toContain("radionica")
    expect(metadata.description).toContain("događanja za djecu")
    expect(metadata.description).toContain("besplatnih događanja")
    expect(metadata.description).toContain("Osijeku")
    expect(metadata.canonical).toBe("https://manifestacije.hr/gradovi/osijek")
  })

  it("builds Osijek event breadcrumb JSON-LD with the city landing page", () => {
    const citySlug = citySlugForEvent(osijekEvent)
    const jsonLd = breadcrumbsToJsonLd(
      [
        { name: "Početna", path: "/" },
        { name: "Događanja", path: "/eventi" },
        { name: osijekEvent.city, path: `/gradovi/${citySlug}` },
        { name: osijekEvent.title, path: `/eventi/${osijekEvent.slug}` },
      ],
      "https://manifestacije.hr",
    )

    expect(jsonLd.itemListElement).toContainEqual({
      "@type": "ListItem",
      position: 3,
      name: "Osijek",
      item: "https://manifestacije.hr/gradovi/osijek",
    })
  })

  it("includes /gradovi, /gradovi/osijek and valid city/category URLs in sitemap data", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => {
      const url = String(input)
      expect(url).toContain("/api/public/seo/sitemap-data")
      return {
        ok: true,
        json: async () => ({
          events: [{ slug: "koncert-u-osijeku", updatedAt: "2099-07-01T00:00:00.000Z" }],
          regions: [{ slug: "slavonija-i-baranja" }],
          cities: [{ slug: "osijek" }],
          categories: [{ slug: "glazba" }],
          cityCategories: [{ citySlug: "osijek", categorySlug: "glazba" }],
          regionCategories: [{ regionSlug: "slavonija-i-baranja", categorySlug: "glazba" }],
        }),
      }
    }))
    const { default: sitemap } = await import("../../app/sitemap")

    const urls = await sitemap()

    expect(urls).toContainEqual({ url: "http://localhost:3000/gradovi" })
    expect(urls).toContainEqual({ url: "http://localhost:3000/gradovi/osijek" })
    expect(urls).toContainEqual({ url: "http://localhost:3000/gradovi/osijek/kategorije/glazba" })
  })

  it("does not block city URLs in robots.txt", async () => {
    const { default: robots } = await import("../../app/robots")

    expect(JSON.stringify(robots().rules)).not.toContain("/gradovi")
  })
})

