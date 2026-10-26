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
