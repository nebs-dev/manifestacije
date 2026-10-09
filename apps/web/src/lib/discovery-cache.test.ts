import { afterEach, expect, it, vi } from "vitest"
import { fetchEvents, fetchEvent, fetchMapEvents, fetchPartners, fetchCategories, fetchCategoryInventory, fetchOrganizer } from "./public-api"

afterEach(() => vi.unstubAllGlobals())

it("uses five-minute tagged discovery caches without extending unrelated caches", async () => {
  const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => [] })
  vi.stubGlobal("fetch", fetch)
  for (const filters of [{}, { when: "danas" }, { when: "ovaj-vikend" }, { city: "osijek" }] as const) {
    await fetchEvents(filters)
    expect(fetch).toHaveBeenLastCalledWith(expect.stringContaining("/api/public/events?"), {
      next: { revalidate: "when" in filters && filters.when === "ovaj-vikend" ? 0 : 300, tags: ["events"] },
    })
  }
  await fetchMapEvents()
  expect(fetch).toHaveBeenLastCalledWith(expect.stringContaining("/api/public/map/events"), { next: { revalidate: 300, tags: ["events"] } })
  fetch.mockResolvedValue({ ok: true, json: async () => null })
  await fetchEvent("example")
  expect(fetch).toHaveBeenLastCalledWith(expect.stringContaining("/events/example"), { next: { revalidate: 60, tags: ["events"] } })
  await fetchOrganizer("example")
  expect(fetch).toHaveBeenLastCalledWith(expect.stringContaining("/organizers/example"), { next: { revalidate: 60, tags: ["organizers"] } })
  await fetchPartners()
  expect(fetch).toHaveBeenLastCalledWith(expect.any(String), { next: { revalidate: 3600, tags: ["partners"] } })
  await fetchCategories()
  expect(fetch).toHaveBeenLastCalledWith(expect.any(String), { next: { revalidate: 3600, tags: ["taxonomy"] } })
})

it("refreshes live category counts on event or taxonomy invalidation", async () => {
  const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => [] })
  vi.stubGlobal("fetch", fetch)
  await fetchCategoryInventory()
  expect(fetch).toHaveBeenLastCalledWith(expect.stringContaining("/api/public/categories?counts=true"), {
    next: { revalidate: 300, tags: ["events", "taxonomy"] },
  })
})

it("uses a new data-cache key at Zagreb midnight and never caches weekend responses", async () => {
  vi.useFakeTimers()
  const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => [] })
  vi.stubGlobal("fetch", fetch)
  try {
    vi.setSystemTime(new Date("2026-07-05T21:59:59Z"))
    await fetchEvents()
    const before = new URL(fetch.mock.calls[0][0])
    vi.setSystemTime(new Date("2026-07-05T22:00:00Z"))
    await fetchEvents()
    const after = new URL(fetch.mock.calls[1][0])
    expect(before.searchParams.get("clockDate")).toBe("2026-07-05")
    expect(after.searchParams.get("clockDate")).toBe("2026-07-06")
    await fetchEvents({ when: "ovaj-vikend" })
    expect(fetch).toHaveBeenLastCalledWith(expect.any(String), { next: { revalidate: 0, tags: ["events"] } })
  } finally { vi.useRealTimers() }
})
