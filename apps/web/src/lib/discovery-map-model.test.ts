import { expect, it } from "vitest"
import { events } from "./data"
import { DISCOVERY_BOUNDS, resolveMapCity } from "./discovery-map-model"
const osijek = { ...events[0], city: "Osijek", citySlug: "osijek", title: "Koncert", lat: 1, lng: 1 }
it("resolves exact city intent without using outlier coordinates", () => {
  expect(resolveMapCity(" Osijek ", [osijek])).toEqual([45.555, 18.695])
  expect(DISCOVERY_BOUNDS).toEqual([[44.95, 16.9], [46.1, 19.5]])
})
it("does not recenter generic text, partial or unsuccessful location searches", () => {
  expect(resolveMapCity("koncert", [osijek])).toBeUndefined()
  expect(resolveMapCity("Osi", [osijek])).toBeUndefined()
  expect(resolveMapCity("Osijek", [])).toBeUndefined()
})
