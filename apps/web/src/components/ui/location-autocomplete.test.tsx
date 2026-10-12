// @vitest-environment jsdom
import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { dropdownAnchor, LocationAutocomplete } from "./location-autocomplete"

describe("dropdownAnchor", () => {
  const view = { top: 0, bottom: 800, layoutHeight: 800 }
  it("opens below with up to 288px when there is room", () => {
    expect(dropdownAnchor({ top: 100, bottom: 140, left: 16, width: 300 }, view)).toEqual({ left: 16, width: 300, top: 144, bottom: 704, maxHeight: 288, above: false })
  })
  it("flips above an input near the bottom and caps the height to the visible space", () => {
    const anchor = dropdownAnchor({ top: 700, bottom: 740, left: 16, width: 300 }, view)!
    expect(anchor.above).toBe(true)
    expect(anchor.bottom).toBe(104)
    expect(anchor.maxHeight).toBe(288)
  })
  it("uses the visual viewport (mobile keyboard) for available space", () => {
    const anchor = dropdownAnchor({ top: 380, bottom: 420, left: 0, width: 360 }, { top: 0, bottom: 450, layoutHeight: 800 })!
    expect(anchor.above).toBe(true)
    expect(anchor.maxHeight).toBe(288)
  })
  it("hides while the input is scrolled out of view", () => {
    expect(dropdownAnchor({ top: -90, bottom: -50, left: 0, width: 300 }, view)).toBeNull()
    expect(dropdownAnchor({ top: 900, bottom: 940, left: 0, width: 300 }, view)).toBeNull()
  })
})

describe("LocationAutocomplete", () => {
  let container: HTMLDivElement, root: Root
  beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true)
    vi.useFakeTimers()
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => [
      { place_id: 1, lat: "45.56", lon: "18.67", display_name: "Trg Ante Starčevića, Osijek", address: { name: "Trg Ante Starčevića", city: "Osijek", county: "Osječko-baranjska" } },
      { place_id: 2, lat: "45.55", lon: "18.69", display_name: "Europska avenija, Osijek", address: { road: "Europska avenija", city: "Osijek" } },
    ] }))
    container = document.createElement("div"); document.body.append(container); root = createRoot(container)
  })
  afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.useRealTimers(); vi.unstubAllGlobals() })

  it("supports arrow keys, Enter selection and Escape as a combobox", async () => {
    const onChange = vi.fn()
    await act(async () => root.render(<LocationAutocomplete value={null} onChange={onChange} />))
    const input = container.querySelector("input")!
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "Osijek trg")
      input.dispatchEvent(new Event("input", { bubbles: true }))
    })
    await act(async () => { vi.advanceTimersByTime(450) })
    await act(async () => { await Promise.resolve() })
    expect(input.getAttribute("aria-expanded")).toBe("true")
    expect(document.querySelectorAll('[role="option"]')).toHaveLength(2)

    const key = (k: string) => act(async () => { input.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true })) })
    await key("ArrowDown"); await key("ArrowDown")
    expect(input.getAttribute("aria-activedescendant")).toBe(document.querySelectorAll('[role="option"]')[1].id)
    await key("Enter")
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ address: "Europska avenija, Osijek", cityName: "Osijek" }))
    expect(input.getAttribute("aria-expanded")).toBe("false")

    await key("ArrowDown")
    expect(input.getAttribute("aria-expanded")).toBe("true")
    await key("Escape")
    expect(input.getAttribute("aria-expanded")).toBe("false")
  })
})
