import { describe, expect, it } from "vitest"
import { cartoBasemapUrl } from "./carto-basemap"

describe("CARTO basemap authentication", () => {
  it("preserves Voyager and Leaflet placeholders and encodes the key parameter", () => {
    const url = cartoBasemapUrl(" test&key=value ")!
    expect(url.split("?")[0]).toBe("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png")
    expect(new URLSearchParams(url.split("?")[1]).get("key")).toBe("test&key=value")
    expect([...new URLSearchParams(url.split("?")[1]).keys()]).toEqual(["key"])
  })
  it.each([undefined, "", "   "])("does not generate unauthenticated tile URLs for %j", key => {
    expect(cartoBasemapUrl(key)).toBeUndefined()
  })
})
