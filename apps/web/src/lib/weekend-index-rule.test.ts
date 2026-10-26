import type { ReactElement } from "react"
import type { WeekendEmptyState } from "./weekend-nearby"
import { afterEach, describe, expect, it, vi } from "vitest"

type Robots = { index: boolean; follow: boolean } | undefined

const scopes = { windowDays: 90, cities: ["karanac"], regions: ["slavonija-i-baranja"] }

/** Routes the two calls each weekend page makes: the event feed and the scopes. */
function stubApi(weekendEvents: unknown[]) {
  vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => ({
    ok: true,
    json: async () => (String(input).includes("/seo/weekend-scopes") ? scopes : weekendEvents),
  })))
}

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules() })

describe("weekend page index rule (SEO-15)", () => {
  it("indexes a city with nothing on this weekend but events in the window", async () => {
    stubApi([])
    const { generateMetadata } = await import("../../app/kamo-za-vikend/gradovi/[citySlug]/page")

    const metadata = await generateMetadata({ params: { citySlug: "karanac" } })

    expect(metadata.robots as Robots).toBeUndefined()
  })

  it("keeps a city with no programme at all out of the index", async () => {
    stubApi([])
    const { generateMetadata } = await import("../../app/kamo-za-vikend/gradovi/[citySlug]/page")

    const metadata = await generateMetadata({ params: { citySlug: "beograd" } })

    expect(metadata.robots as Robots).toEqual({ index: false, follow: true })
  })

  it("indexes a region by its canonical slug although the API reports the long one", async () => {
    stubApi([])
    const { generateMetadata } = await import("../../app/kamo-za-vikend/regije/[regionSlug]/page")

    for (const regionSlug of ["slavonija", "slavonija-i-baranja"]) {
      expect((await generateMetadata({ params: { regionSlug } })).robots as Robots).toBeUndefined()
    }
    expect((await generateMetadata({ params: { regionSlug: "dalmacija" } })).robots as Robots).toEqual({ index: false, follow: true })
  })

  it("falls back to the old rule when the scopes call fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => {
      if (String(input).includes("/seo/weekend-scopes")) throw new Error("offline")
      return { ok: true, json: async () => [] }
    }))
    const { generateMetadata } = await import("../../app/kamo-za-vikend/gradovi/[citySlug]/page")

    expect((await generateMetadata({ params: { citySlug: "karanac" } })).robots as Robots).toEqual({ index: false, follow: true })
  })
})

/** Collects every href in an element tree, including link lists passed as props. */
function hrefs(node: unknown): string[] {
  if (Array.isArray(node)) return node.flatMap(hrefs)
  if (!node || typeof node !== "object") return []
  const record = node as Record<string, unknown>
  const own = typeof record.href === "string" ? [record.href] : []
  return [...own, ...hrefs(record.props), ...hrefs(record.children), ...hrefs(record.links)]
}

const osijekWeekendEvent = {
  id: 7,
  title: "Koncert u Osijeku",
  slug: "koncert-u-osijeku",
  startsAt: new Date(Date.now() - 3600_000).toISOString(),
  endsAt: new Date(Date.now() + 7200_000).toISOString(),
  city: { id: 1, name: "Osijek", slug: "osijek" },
  cityName: "Osijek",
  category: { id: 1, name: "Glazba", slug: "glazba" },
  categories: [],
}

const apiCities = [
  { id: 1, name: "Osijek", slug: "osijek", lat: 45.56, lng: 18.69, county: { slug: "osjecko-baranjska", region: { slug: "slavonija-i-baranja" } } },
  { id: 2, name: "Karanac", slug: "karanac", lat: 45.76, lng: 18.62, county: { slug: "osjecko-baranjska", region: { slug: "slavonija-i-baranja" } } },
]

describe("empty weekend page is not a dead end (SEO-15)", () => {
  it("hands the page the city's own listing, its calendar and the nearest place that has something on", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => {
      const url = String(input)
      const body = url.includes("/seo/weekend-scopes")
        ? scopes
        : url.includes("/public/cities")
          ? apiCities
          : url.includes("city=karanac")
            ? []
            : [osijekWeekendEvent]
      return { ok: true, json: async () => body }
    }))
    const { default: KamoZaVikendCityPage } = await import("../../app/kamo-za-vikend/gradovi/[citySlug]/page")

    const page = (await KamoZaVikendCityPage({ params: { citySlug: "karanac" } })) as ReactElement<{ emptyState?: WeekendEmptyState }>
    const emptyState = page.props.emptyState

    expect(emptyState?.browse.map((link) => link.href)).toEqual(["/gradovi/karanac", "/kalendar?grad=karanac"])
    expect(emptyState?.nearby.map((link) => link.href)).toEqual(["/kamo-za-vikend/gradovi/osijek"])
  })

  it("passes no empty state once the weekend has events", async () => {
    stubApi([osijekWeekendEvent])
    const { default: KamoZaVikendCityPage } = await import("../../app/kamo-za-vikend/gradovi/[citySlug]/page")

    const page = (await KamoZaVikendCityPage({ params: { citySlug: "osijek" } })) as ReactElement<{ emptyState?: WeekendEmptyState }>

    expect(page.props.emptyState).toBeUndefined()
  })

  it("renders those links in the empty state instead of the bare dead end", async () => {
    const { WeekendLanding } = await import("../components/public/weekend-landing")

    const tree = WeekendLanding({
      events: [],
      eyebrow: "Kamo za vikend",
      h1: "Kamo za vikend u gradu Karanac?",
      intro: "Pregled aktualnih događanja ovaj vikend.",
      breadcrumbs: [{ name: "Početna", path: "/" }],
      emptyState: {
        browse: [{ slug: "a", name: "Svi najavljeni termini", href: "/gradovi/karanac" }],
        nearbyTitle: "Ovaj vikend u blizini",
        nearby: [{ slug: "osijek", name: "Osijek", href: "/kamo-za-vikend/gradovi/osijek" }],
      },
    })

    const links = hrefs(tree)
    expect(links).toContain("/gradovi/karanac")
    expect(links).toContain("/kamo-za-vikend/gradovi/osijek")
    expect(links).toContain("/eventi")
  })
})
