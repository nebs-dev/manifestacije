import { describe, expect, it } from "vitest"

import { claimEventImagePrefetch } from "./event-image-prefetch"

describe("event image prefetch", () => {
  it("claims each URL only once", () => {
    const seen = new Set<string>()
    expect(claimEventImagePrefetch("https://example.com/event.jpg", false, seen)).toBe(true)
    expect(claimEventImagePrefetch("https://example.com/event.jpg", false, seen)).toBe(false)
    expect(seen).toEqual(new Set(["https://example.com/event.jpg"]))
  })

  it("skips empty URLs and Save-Data connections", () => {
    const seen = new Set<string>()
    expect(claimEventImagePrefetch(undefined, false, seen)).toBe(false)
    expect(claimEventImagePrefetch("https://example.com/event.jpg", true, seen)).toBe(false)
    expect(seen.size).toBe(0)
  })
})
