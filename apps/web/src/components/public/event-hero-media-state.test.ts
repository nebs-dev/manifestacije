import { describe, expect, it } from "vitest"

import { eventHeroMediaMode, eventHeroMediaVisibility } from "./event-hero-media-state"

describe("event hero media mode", () => {
  it("uses landscape cover for normal wide photography", () => {
    expect(eventHeroMediaMode({ hasImage: true, width: 1600, height: 900 })).toBe("landscape")
    expect(eventHeroMediaMode({ hasImage: true, width: 1500, height: 1000 })).toBe("landscape")
  })

  it("protects portrait, story, square, unknown, low-resolution, and ultra-wide media", () => {
    expect(eventHeroMediaMode({ hasImage: true, width: 1200, height: 1500 })).toBe("poster")
    expect(eventHeroMediaMode({ hasImage: true, width: 900, height: 1600 })).toBe("poster")
    expect(eventHeroMediaMode({ hasImage: true, width: 1200, height: 1200 })).toBe("poster")
    expect(eventHeroMediaMode({ hasImage: true })).toBe("poster")
    expect(eventHeroMediaMode({ hasImage: true, width: 480, height: 320, sourceDimensions: true })).toBe("poster")
    expect(eventHeroMediaMode({ hasImage: true, width: 2400, height: 600 })).toBe("poster")
  })

  it("uses the branded fallback when no event image exists", () => {
    expect(eventHeroMediaMode({ hasImage: false })).toBe("fallback")
  })
})

describe("event hero progressive visibility", () => {
  it("keeps a distinct preview visible until the detail image is decoded", () => {
    expect(eventHeroMediaVisibility("card.jpg", "detail.jpg", false)).toEqual({
      fullImage: "detail.jpg",
      previewVisible: true,
      detailVisible: false,
    })
  })

  it("crossfades to the decoded detail image", () => {
    expect(eventHeroMediaVisibility("card.jpg", "detail.jpg", true)).toEqual({
      fullImage: "detail.jpg",
      previewVisible: false,
      detailVisible: true,
    })
  })

  it("does not duplicate an identical preview and detail source", () => {
    expect(eventHeroMediaVisibility("event.jpg", "event.jpg", false)).toEqual({
      fullImage: "event.jpg",
      previewVisible: false,
      detailVisible: false,
    })
  })
})
