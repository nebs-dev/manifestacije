import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@next/third-parties/google", () => ({ sendGAEvent: vi.fn() }))

import { sendGAEvent } from "@next/third-parties/google"
import { analyticsSourcePage, trackDiscoveryNavigation } from "./analytics"

const send = vi.mocked(sendGAEvent)

describe("discovery analytics", () => {
  beforeEach(() => {
    vi.stubGlobal("window", {})
    send.mockReset()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it.each([
    ["/kalendar", "calendar_click"],
    ["/mapa", "map_click"],
    ["/ovaj-vikend", "weekend_click"],
  ] as const)("maps %s to %s with exact shared parameters", (destination, name) => {
    trackDiscoveryNavigation({
      source_page: "home",
      source_component: "hero_quick_link",
      destination,
    })

    expect(send).toHaveBeenCalledTimes(1)
    expect(send).toHaveBeenCalledWith("event", name, {
      source_page: "home",
      source_component: "hero_quick_link",
      destination,
    })
  })

  it("does nothing during server rendering", () => {
    vi.unstubAllGlobals()
    trackDiscoveryNavigation({
      source_page: "home",
      source_component: "calendar_teaser",
      destination: "/kalendar",
    })
    expect(send).not.toHaveBeenCalled()
  })

  it("swallows analytics failures", () => {
    send.mockImplementationOnce(() => {
      throw new Error("gtag unavailable")
    })
    expect(() => trackDiscoveryNavigation({
      source_page: "home",
      source_component: "map_teaser",
      destination: "/mapa",
    })).not.toThrow()
  })

  it("uses home for root and pathname elsewhere", () => {
    expect(analyticsSourcePage("/")).toBe("home")
    expect(analyticsSourcePage("/eventi")).toBe("/eventi")
    expect(analyticsSourcePage(null)).toBe("unknown")
  })
})
