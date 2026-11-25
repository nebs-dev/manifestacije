// @vitest-environment jsdom
import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { VenuesPage } from "./venues-page"

const api = vi.hoisted(() => vi.fn())
vi.mock("@/lib/admin/api", () => ({ authedFetch: api }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const oxygene = { id: 1, name: "Oxygene", address: "Kapucinska 41", cityName: "Osijek", cityId: 1, lat: 45.55, lng: 18.69, eventCount: 12 }
const klub = { id: 2, name: "Klub Oxygene", address: null, cityName: "Osijek", cityId: 1, lat: null, lng: null, eventCount: 3 }
const groups = [{ cityId: 1, cityName: "Osijek", venues: [oxygene, klub] }]

const response = (value: unknown) => ({ ok: true, json: async () => value, text: async () => "" })
let container: HTMLDivElement, root: Root
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true)
  api.mockReset().mockImplementation(async (path: string) => response(
    path.includes("duplicates") ? groups : path.includes("/merge") ? { movedEvents: 3, removedVenueId: 2 } : [oxygene, klub]))
  container = document.createElement("div"); document.body.append(container); root = createRoot(container)
})
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals() })

const render = async () => { await act(async () => root.render(<VenuesPage />)) }
const buttons = () => [...container.querySelectorAll("button")]
const click = async (element: Element | undefined, what: string) => {
  expect(element, what).toBeTruthy()
  await act(async () => (element as HTMLElement).click())
}

describe("venues admin page", () => {
  it("lists stored venues with how many events use them", async () => {
    await render()
    const table = container.querySelector('[aria-label="Sva mjesta"]')!.textContent ?? ""
    expect(table).toContain("Oxygene")
    expect(table).toContain("Kapucinska 41")
    expect(table).toContain("12")
  })

  it("offers to merge a duplicate into the busiest venue of its city", async () => {
    await render()
    const duplicates = container.querySelector('[aria-label="Mogući duplikati"]')!.textContent ?? ""
    expect(duplicates).toContain("Klub Oxygene")
    expect(buttons().some(button => button.textContent?.includes("Spoji u"))).toBe(true)
  })

  it("spells out the consequence before merging anything", async () => {
    await render()

    await click(buttons().find(button => button.textContent?.includes("Spoji u")), "merge")

    const dialog = container.querySelector('[role="alertdialog"]')!.textContent ?? ""
    expect(dialog).toContain("premjestit će se")
    expect(dialog).toContain("briše")
    // Nothing has been sent yet.
    expect(api.mock.calls.some(call => String(call[0]).includes("/merge"))).toBe(false)
  })

  it("merges only after the confirmation, naming the venue that survives", async () => {
    await render()
    await click(buttons().find(button => button.textContent?.includes("Spoji u")), "merge")

    await click(buttons().find(button => button.textContent?.trim() === "Spoji"), "confirm")

    const call = api.mock.calls.find(call => String(call[0]).includes("/merge"))
    expect(call![0]).toBe("/api/admin/venues/2/merge")
    expect(JSON.parse(call![1].body)).toEqual({ intoId: 1 })
  })

  it("abandons the merge when told to", async () => {
    await render()
    await click(buttons().find(button => button.textContent?.includes("Spoji u")), "merge")

    await click(buttons().find(button => button.textContent?.trim() === "Odustani"), "cancel")

    expect(container.querySelector('[role="alertdialog"]')).toBeNull()
    expect(api.mock.calls.some(call => String(call[0]).includes("/merge"))).toBe(false)
  })

  it("says so when the venues cannot be loaded", async () => {
    api.mockResolvedValue({ ok: false, json: async () => ({}), text: async () => "" })
    await render()
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("nije moguće učitati")
  })
})
