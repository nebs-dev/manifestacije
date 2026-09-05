import { afterEach, expect, it, vi } from "vitest"
import { fetchEvents, fetchEvent, fetchMapEvents, fetchPartners, fetchCategories, fetchOrganizer } from "./public-api"

afterEach(() => vi.unstubAllGlobals())

it("uses five-minute tagged discovery caches without extending unrelated caches", async () => {
  const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => [] })
  vi.stubGlobal("fetch", fetch)
  for (const filters of [{}, { when: "danas" }, { when: "ovaj-vikend" }, { city: "osijek" }] as const) {
    await fetchEvents(filters)
    expect(fetch).toHaveBeenLastCalledWith(expect.stringContaining("/api/public/events?"), {
      next: { revalidate: 300, tags: ["events"] },
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
