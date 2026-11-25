// @vitest-environment jsdom
import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { ParsedCandidateCard } from "./parsed-candidate-card"
import type { ParsedCandidate } from "@/lib/admin/types"

const api = vi.hoisted(() => vi.fn())
vi.mock("@/lib/admin/api", () => ({ authedFetch: api }))
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock("@/components/ui/location-autocomplete", () => ({ LocationAutocomplete: () => null }))
vi.mock("@/components/admin/event-image-picker", () => ({ EventImagePicker: () => null }))

const oxygene = { id: 3, name: "Oxygene", address: "Kapucinska 41", cityName: "Osijek", cityId: 1, lat: 45.55, lng: 18.69, label: "Oxygene, Kapucinska 41, Osijek" }
const dvoranaOs = { id: 4, name: "Dvorana", address: "Osječka 2", cityName: "Osijek", cityId: 1, lat: 45.5, lng: 18.6, label: "Dvorana, Osječka 2, Osijek" }
const dvoranaZg = { id: 9, name: "Dvorana", address: "Zagrebačka 1", cityName: "Zagreb", cityId: 9, lat: null, lng: null, label: "Dvorana, Zagrebačka 1, Zagreb" }
const response = (value: unknown) => ({ ok: true, json: async () => value, text: async () => "" })

/** The poster named the club and nothing else — the case the request is about. */
const candidate: ParsedCandidate = {
  id: "19:0", sourceId: "19", candidateIndex: 0, _status: "pending", title: "Afterwork Party",
  startsAt: "2099-11-12T17:00:00Z", endsAt: null, city: "Osijek", description: "Opis",
  venueName: null, address: null, county: null, region: null, isFree: true, priceText: null,
  ticketUrl: null, organizerName: null, imageUrl: null, sourceUrl: "", category: "koncerti",
  confidence: 0.9, warnings: [], missingFields: [],
}

let container: HTMLDivElement, root: Root
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true)
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response([])))
  api.mockReset().mockImplementation(async (path: string) =>
    response(path.includes("/venues/search") ? [oxygene]
      : path.endsWith("/check") ? { hiddenMatch: false, matches: [] }
      : path.includes("create-event") ? { event: { id: 77 } } : []))
  container = document.createElement("div"); document.body.append(container); root = createRoot(container)
})
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.useRealTimers(); vi.unstubAllGlobals() })

const render = async (element: React.ReactNode) => { await act(async () => root.render(element)) }
const buttons = () => [...container.querySelectorAll("button")]
const click = async (element: Element | undefined | null, what: string) => {
  expect(element, what).toBeTruthy()
  await act(async () => (element as HTMLElement).click())
}
const expand = async () => click(buttons().find(b => b.textContent?.includes(candidate.title)), "candidate title")
const venueField = () => container.querySelector('[role="combobox"]') as HTMLInputElement
const field = (labelText: string) => {
  const label = [...container.querySelectorAll("label")].find(l => l.textContent?.includes(labelText))
  expect(label, labelText).toBeTruthy()
  return container.querySelector(`#${CSS.escape(label!.getAttribute("for")!)}`) as HTMLInputElement
}
const type = async (element: HTMLInputElement, value: string) => {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")!.set!
  await act(async () => { setter.call(element, value); element.dispatchEvent(new Event("input", { bubbles: true })) })
  await act(async () => { vi.advanceTimersByTime(400) })
}

describe("venue memory in the parsed candidate review", () => {
  beforeEach(() => vi.useFakeTimers())

  it("fills the address and city from a venue confirmed on an earlier event", async () => {
    await render(<ParsedCandidateCard candidate={candidate} />)
    await expand()

    await type(venueField(), "oxy")
    await click(container.querySelector('[role="option"]'), "Oxygene suggestion")

    expect(venueField().value).toBe("Oxygene")
    expect(field("Adresa").value).toBe("Kapucinska 41")
    expect(field("Grad").value).toBe("Osijek")
  })

  it("imports the event with the remembered address", async () => {
    await render(<ParsedCandidateCard candidate={candidate} />)
    await expand()
    await type(venueField(), "oxy")
    await click(container.querySelector('[role="option"]'), "Oxygene suggestion")

    await click(buttons().find(b => b.textContent?.trim() === "Kreiraj događaj"), "Kreiraj događaj")

    const call = api.mock.calls.find(call => String(call[0]).includes("create-event"))
    expect(call, "create-event call").toBeTruthy()
    expect(JSON.parse(call![1].body).candidate).toEqual(expect.objectContaining({
      venueName: "Oxygene", address: "Kapucinska 41", city: "Osijek",
    }))
  })

  it("asks the venue search for the candidate's city, so another town's address is not offered first", async () => {
    await render(<ParsedCandidateCard candidate={candidate} />)
    await expand()

    await type(venueField(), "dvorana")

    const search = api.mock.calls.map(call => String(call[0])).find(url => url.includes("/venues/search"))
    expect(search).toContain(`city=${encodeURIComponent("Osijek")}`)
  })
})

describe("address filled from the poster's venue name (VEN-04)", () => {
  const named = (venueName: string, city = "Osijek"): ParsedCandidate => ({ ...candidate, venueName, city })

  it("fills the stored address when the poster named a venue and nothing else", async () => {
    api.mockImplementation(async (path: string) =>
      response(path.includes("/venues/search") ? [oxygene] : path.endsWith("/check") ? { hiddenMatch: false, matches: [] } : []))

    await render(<ParsedCandidateCard candidate={named("Oxygene")} />)
    await expand()

    expect(field("Adresa").value).toBe("Kapucinska 41")
    expect(container.textContent).toContain("spremljenih mjesta")
  })

  it("does not choose between two towns' venues of the same name", async () => {
    api.mockImplementation(async (path: string) =>
      response(path.includes("/venues/search") ? [dvoranaOs, dvoranaZg] : path.endsWith("/check") ? { hiddenMatch: false, matches: [] } : []))

    await render(<ParsedCandidateCard candidate={{ ...named("Dvorana"), city: "" }} />)
    await expand()

    expect(field("Adresa").value).toBe("")
  })

  it("leaves an address the parser already read alone", async () => {
    api.mockImplementation(async (path: string) =>
      response(path.includes("/venues/search") ? [oxygene] : path.endsWith("/check") ? { hiddenMatch: false, matches: [] } : []))

    await render(<ParsedCandidateCard candidate={{ ...named("Oxygene"), address: "Ulica s plakata 1" }} />)
    await expand()

    expect(field("Adresa").value).toBe("Ulica s plakata 1")
  })

  it("asks for nothing when the poster named no venue", async () => {
    await render(<ParsedCandidateCard candidate={candidate} />)
    await expand()

    expect(api.mock.calls.map(call => String(call[0])).filter(url => url.includes("/venues/search"))).toHaveLength(0)
  })
})
