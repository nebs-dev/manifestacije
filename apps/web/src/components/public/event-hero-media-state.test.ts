import { describe, expect, it } from "vitest"

import { eventHeroMediaVisibility } from "./event-hero-media-state"

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
