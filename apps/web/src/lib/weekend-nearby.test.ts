import { describe, expect, it } from "vitest"
import type { CroEvent } from "./data"
import { nearbyWeekendCities, weekendFallbackLinks } from "./weekend-nearby"

const cities = [
  { slug: "karanac", name: "Karanac", countySlug: "osjecko-baranjska", regionSlug: "slavonija-i-baranja", lat: 45.76, lng: 18.62 },
  { slug: "beli-manastir", name: "Beli Manastir", countySlug: "osjecko-baranjska", regionSlug: "slavonija-i-baranja", lat: 45.77, lng: 18.61 },
  { slug: "osijek", name: "Osijek", countySlug: "osjecko-baranjska", regionSlug: "slavonija-i-baranja", lat: 45.56, lng: 18.69 },
  { slug: "vinkovci", name: "Vinkovci", countySlug: "vukovarsko-srijemska", regionSlug: "slavonija-i-baranja", lat: 45.29, lng: 18.8 },
  { slug: "rijeka", name: "Rijeka", countySlug: "primorsko-goranska", regionSlug: "istra-i-kvarner", lat: 45.33, lng: 14.44 },
]

const event = (citySlug: string, slug: string): CroEvent =>
  ({ slug, city: citySlug, citySlug, categories: [] } as unknown as CroEvent)

describe("nearby weekend places (SEO-15)", () => {
  it("offers the closest places that actually have something on", () => {
    const links = nearbyWeekendCities(
      { citySlug: "karanac" },
      cities,
      [event("beli-manastir", "a"), event("osijek", "b"), event("rijeka", "c")],
    )

    expect(links.map((link) => link.slug)).toEqual(["beli-manastir", "osijek", "rijeka"])
    expect(links[0].href).toBe("/kamo-za-vikend/gradovi/beli-manastir")
  })

  it("never offers a place that is empty this weekend, nor the page's own city", () => {
    const links = nearbyWeekendCities({ citySlug: "karanac" }, cities, [event("karanac", "a"), event("vinkovci", "b")])

    expect(links.map((link) => link.slug)).toEqual(["vinkovci"])
  })

  it("ranks the same county above the rest of the region", () => {
    const links = nearbyWeekendCities({ citySlug: "karanac" }, cities, [event("vinkovci", "a"), event("osijek", "b")])

    expect(links.map((link) => link.slug)).toEqual(["osijek", "vinkovci"])
  })

  it("works for a region page, which has no origin city", () => {
    const links = nearbyWeekendCities(
      { regionSlug: "slavonija-i-baranja" },
      cities,
      [event("rijeka", "a"), event("osijek", "b"), event("vinkovci", "c")],
      2,
    )

    expect(links.map((link) => link.slug)).toEqual(["osijek", "vinkovci"])
  })

  it("honours the limit", () => {
    const links = nearbyWeekendCities({ citySlug: "karanac" }, cities, cities.map((city, i) => event(city.slug, `e${i}`)), 2)

    expect(links).toHaveLength(2)
  })

  it("points at the place's own listing and calendar", () => {
    expect(weekendFallbackLinks({ kind: "city", slug: "karanac", name: "Karanac" })).toEqual([
      { slug: "karanac-all", name: "Svi najavljeni termini u gradu Karanac", href: "/gradovi/karanac" },
      { slug: "karanac-calendar", name: "Pogledaj u kalendaru", href: "/kalendar?grad=karanac" },
    ])
    expect(weekendFallbackLinks({ kind: "region", slug: "slavonija", name: "Slavonija i Baranja" })[0].href).toBe("/regije/slavonija")
  })
})
