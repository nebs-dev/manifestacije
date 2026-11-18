import { afterEach, describe, expect, it, vi } from "vitest"

type FetchInit = { next?: { revalidate?: number; tags?: string[] }; cache?: string }

function stubFetch(body: unknown = []) {
  const spy = vi.fn(async () => ({ ok: true, json: async () => body }))
  vi.stubGlobal("fetch", spy)
  return spy
}

const initOf = (spy: { mock: { calls: unknown[][] } }, index = 0) =>
  (spy.mock.calls[index]?.[1] ?? {}) as FetchInit

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); vi.doUnmock("next/headers") })

describe("route caching (PERF-01)", () => {
  it("asks for a finite revalidate on every feed, so no fetch opts a route out of static rendering", async () => {
    const spy = stubFetch()
    const { fetchEvents } = await import("./public-api")

    for (const when of [undefined, "danas", "ovaj-vikend", "ovaj-mjesec"] as const) {
      await fetchEvents(when ? { when } : {})
    }

    expect(spy).toHaveBeenCalledTimes(4)
    for (let call = 0; call < 4; call += 1) {
      expect(initOf(spy, call).next?.revalidate).toBe(300)
      expect(initOf(spy, call).cache).toBeUndefined()
    }
  })

  it.each([
    ["../../app/danas/page", 300],
    ["../../app/ovaj-vikend/page", 300],
    ["../../app/kamo-za-vikend/gradovi/[citySlug]/page", 900],
    ["../../app/kamo-za-vikend/regije/[regionSlug]/page", 900],
  ])("caches %s for %i seconds", async (route, revalidate) => {
    const { revalidate: value } = await import(route)

    expect(value).toBe(revalidate)
  })

  it.each([
    ["../../app/kamo-za-vikend/gradovi/[citySlug]/page", { citySlug: "karanac" }],
    ["../../app/kamo-za-vikend/regije/[regionSlug]/page", { regionSlug: "slavonija" }],
  ])("keeps %s off the 300-second feed, which would cap its own revalidate", async (route, params) => {
    const spy = stubFetch()
    const { generateMetadata } = await import(route)

    await generateMetadata({ params })

    const calls = spy.mock.calls as unknown[][]
    const feed = calls.findIndex((call) => String(call[0]).includes("/api/public/events"))
    expect(initOf(spy, feed).next?.revalidate).toBe(900)
  })

  it.each([
    "../../app/kamo-za-vikend/gradovi/[citySlug]/page",
    "../../app/kamo-za-vikend/regije/[regionSlug]/page",
  ])("renders %s on demand and caches it, without prerendering any slug at build time", async (route) => {
    const { dynamicParams, generateStaticParams } = await import(route)

    // An empty list is what turns the route from "server-rendered on demand"
    // into ISR: Next needs generateStaticParams to exist, not to be populated.
    expect(dynamicParams).toBe(true)
    expect(await generateStaticParams()).toEqual([])
  })

  it("caches the weekend scopes for an hour, longer than any page that reads them", async () => {
    const spy = stubFetch({ windowDays: 90, cities: ["karanac"], regions: [] })
    const { fetchWeekendScopes, WEEKEND_SCOPES_REVALIDATE } = await import("./public-api")

    await fetchWeekendScopes()

    expect(WEEKEND_SCOPES_REVALIDATE).toBe(3600)
    expect(String((spy.mock.calls as unknown[][])[0]?.[0])).toContain("/api/public/seo/weekend-scopes")
    expect(initOf(spy)).toEqual({ next: { revalidate: 3600, tags: ["events"] } })
  })

  it("falls back to empty scopes on a failed call, which Next never caches", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 503, statusText: "Service Unavailable", json: async () => ({}) })))
    const { fetchWeekendScopes } = await import("./public-api")

    expect(await fetchWeekendScopes()).toEqual({ windowDays: 0, cities: [], regions: [] })
  })

  const listingRoutes: Array<[string, Record<string, string>]> = [
    ["../../app/gradovi/[citySlug]/page", { citySlug: "osijek" }],
    ["../../app/regije/[regionSlug]/page", { regionSlug: "slavonija" }],
    ["../../app/kategorije/[categorySlug]/page", { categorySlug: "glazba" }],
    ["../../app/gradovi/[citySlug]/kategorije/[categorySlug]/page", { citySlug: "osijek", categorySlug: "glazba" }],
    ["../../app/regije/[regionSlug]/kategorije/[categorySlug]/page", { regionSlug: "slavonija", categorySlug: "glazba" }],
  ]

  it.each(listingRoutes)("caches the listing route %s for 900 seconds, on demand", async (route) => {
    const { revalidate, dynamicParams, generateStaticParams } = await import(route)

    expect(revalidate).toBe(900)
    expect(dynamicParams).toBe(true)
    expect(await generateStaticParams()).toEqual([])
  })

  it.each(listingRoutes)("keeps %s off the 300-second feed", async (route, params) => {
    const spy = stubFetch()
    const { generateMetadata } = await import(route)

    await generateMetadata({ params })

    const calls = spy.mock.calls as unknown[][]
    const feed = calls.findIndex((call) => String(call[0]).includes("/api/public/events"))
    expect(initOf(spy, feed).next?.revalidate).toBe(900)
  })

  it("renders the event detail page on demand and caches it for 300 seconds (PERF-02)", async () => {
    const { revalidate, dynamicParams, generateStaticParams } = await import("../../app/eventi/[eventSlug]/page")

    expect(revalidate).toBe(300)
    expect(dynamicParams).toBe(true)
    expect(await generateStaticParams()).toEqual([])
  })

  it("keeps the event detail page off the 60-second default, which would cap its own revalidate", async () => {
    const spy = stubFetch(null)
    vi.doMock("next/headers", () => ({
      draftMode: () => ({ isEnabled: false }),
      cookies: () => { throw new Error("cookies() must not be read outside draft mode") },
    }))
    const { generateMetadata } = await import("../../app/eventi/[eventSlug]/page")

    await generateMetadata({ params: { eventSlug: "neki-event" } })

    expect(String((spy.mock.calls as unknown[][])[0]?.[0])).toContain("/api/public/events/neki-event")
    expect(initOf(spy).next?.revalidate).toBe(300)
    expect(initOf(spy).cache).toBeUndefined()
  })

  it("sends the preview token uncached, and only while draft mode is on", async () => {
    const spy = stubFetch(null)
    vi.doMock("next/headers", () => ({
      draftMode: () => ({ isEnabled: true }),
      cookies: () => ({ get: (name: string) => (name === "event_preview_token" ? { value: "tok.en" } : undefined) }),
    }))
    const { generateMetadata } = await import("../../app/eventi/[eventSlug]/page")

    await generateMetadata({ params: { eventSlug: "skica" } })

    expect(String((spy.mock.calls as unknown[][])[0]?.[0])).toContain("preview=tok.en")
    expect(initOf(spy).cache).toBe("no-store")
  })

  it("caches the homepage for 300 seconds instead of opting out with revalidate 0 (PERF-02)", async () => {
    const { revalidate } = await import("../../app/page")

    expect(revalidate).toBe(300)
  })

  it("caches the sitemap for an hour instead of rebuilding it per crawl (PERF-02)", async () => {
    const spy = stubFetch({
      events: [], regions: [], cities: [], categories: [],
      cityCategories: [], regionCategories: [], weekendCities: [], weekendRegions: [],
    })
    const sitemapRoute = await import("../../app/sitemap")

    await sitemapRoute.default()

    expect(sitemapRoute.revalidate).toBe(3600)
    expect(String((spy.mock.calls as unknown[][])[0]?.[0])).toContain("/api/public/seo/sitemap-data")
    // The shared api() helper sends cache: "no-store", which opts the whole
    // route out of static rendering; this route must not use it.
    expect(initOf(spy).cache).toBeUndefined()
    expect(initOf(spy).next).toEqual({ revalidate: 3600, tags: ["events"] })
  })
})
