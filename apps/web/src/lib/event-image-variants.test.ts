import { describe, expect, it } from "vitest"
import { eventImagePrimaryUrl, eventImageSrcSet, eventImageVariant } from "./event-image-variants"

const original = "https://res.cloudinary.com/demo/image/upload/v123/event.jpg"
const oldHero = "https://res.cloudinary.com/demo/image/upload/c_fill,g_auto,f_auto,q_auto,w_1600,h_900/v123/event.jpg"

describe("event image variants", () => {
  it("creates exact 4:3 card variants and uncropped detail variants", () => {
    expect(eventImageVariant(original, 800)).toBe(
      "https://res.cloudinary.com/demo/image/upload/c_fill,g_auto,f_auto,q_auto,w_800,h_600/v123/event.jpg",
    )
    expect(eventImagePrimaryUrl(original, "detail")).toBe(
      "https://res.cloudinary.com/demo/image/upload/c_limit,f_auto,q_auto,w_1600/v123/event.jpg",
    )
  })

  it("replaces a generated transform instead of stacking another one", () => {
    const result = eventImageVariant(oldHero, 1200, "detail")
    expect(result).toBe(
      "https://res.cloudinary.com/demo/image/upload/c_limit,f_auto,q_auto,w_1200/v123/event.jpg",
    )
    expect(result).not.toContain("c_fill")
    expect(result.match(/c_limit/g)).toHaveLength(1)
  })

  it("uses smaller candidates for cards and high-resolution candidates for detail", () => {
    expect(eventImageSrcSet(original, "card")).toContain("w_360,h_270/v123/event.jpg 360w")
    expect(eventImageSrcSet(original, "card")).not.toContain("1600w")
    expect(eventImageSrcSet(original, "detail")).toContain("c_limit,f_auto,q_auto,w_1600/v123/event.jpg 1600w")
  })

  it("leaves non-Cloudinary URLs unchanged", () => {
    const external = "https://images.example.com/event.jpg"
    expect(eventImageVariant(external, 800)).toBe(external)
    expect(eventImagePrimaryUrl(external, "detail")).toBe(external)
    expect(eventImageSrcSet(external, "card")).toBeUndefined()
  })
})

describe("the Cloudinary check matches the host, not a substring (CodeQL js/incomplete-url-substring-sanitization)", () => {
  // `url.includes("res.cloudinary.com")` treated any URL merely containing the
  // string as one of ours, and rewrote its path as a Cloudinary transform.
  const impostors = [
    "https://evil.example/res.cloudinary.com/upload/x.jpg",
    "https://res.cloudinary.com.evil.example/upload/x.jpg",
    "https://evil.example/?u=res.cloudinary.com",
  ]

  it.each(impostors)("leaves %s untouched", (url) => {
    expect(eventImageVariant(url, 800)).toBe(url)
    expect(eventImageSrcSet(url, "card")).toBeUndefined()
  })

  it("still transforms a real Cloudinary URL", () => {
    const real = "https://res.cloudinary.com/demo/image/upload/sample.jpg"
    expect(eventImageVariant(real, 800)).toContain("w_800")
    expect(eventImageSrcSet(real, "card")).toContain("800w")
  })
})
