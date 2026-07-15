import { describe, expect, it } from "vitest"
import { resolvePosterSource } from "./event-poster"

describe("resolvePosterSource", () => {
  it("uses the event image when present and not failed", () => {
    expect(resolvePosterSource({ hasImage: true, imageFailed: false, fallbackFailed: false })).toBe("image")
  })

  it("falls back to the category fallback image once the event image errors (e.g. an expired Facebook CDN link returning 403)", () => {
    expect(resolvePosterSource({ hasImage: true, imageFailed: true, fallbackFailed: false })).toBe("fallback")
  })

  it("falls back to the category fallback image when there is no event image at all", () => {
    expect(resolvePosterSource({ hasImage: false, imageFailed: false, fallbackFailed: false })).toBe("fallback")
  })

  it("falls through to the gradient placeholder once both the event image and the fallback image have failed", () => {
    expect(resolvePosterSource({ hasImage: true, imageFailed: true, fallbackFailed: true })).toBe("placeholder")
  })

  it("falls through to the gradient placeholder when there's no event image and the fallback also failed", () => {
    expect(resolvePosterSource({ hasImage: false, imageFailed: false, fallbackFailed: true })).toBe("placeholder")
  })
})
