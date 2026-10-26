import { afterEach, describe, expect, it, vi } from "vitest"

type FetchInit = { next?: { revalidate?: number; tags?: string[] }; cache?: string }

function stubFetch(body: unknown = []) {
  const spy = vi.fn(async () => ({ ok: true, json: async () => body }))
  vi.stubGlobal("fetch", spy)
  return spy
}

const initOf = (spy: { mock: { calls: unknown[][] } }, index = 0) =>
  (spy.mock.calls[index]?.[1] ?? {}) as FetchInit

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules() })

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
  ])("caches %s for %i seconds", async (route, revalidate) => {
    const { revalidate: value } = await import(route)

    expect(value).toBe(revalidate)
  })
})
