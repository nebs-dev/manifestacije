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

const response = (value: unknown) => ({ ok: true, json: async () => value, text: async () => "" })
const candidate: ParsedCandidate = {
  id: "19:0", sourceId: "19", candidateIndex: 0, _status: "pending", title: "Afterwork Party",
  startsAt: "2099-11-12T17:00:00Z", endsAt: null, city: "Osijek", description: "Opis",
  venueName: "Club O2", address: null, county: null, region: null, isFree: true, priceText: null,
  ticketUrl: null, organizerName: null, imageUrl: null, sourceUrl: "", category: "koncerti",
  confidence: 0.9, warnings: [], missingFields: [],
}

let container: HTMLDivElement, root: Root
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true)
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response([])))
  api.mockReset().mockImplementation(async (path: string) =>
    response(path.endsWith("/check") ? { hiddenMatch: false, matches: [] } : path.includes("create-event") ? { event: { id: 77 } } : []))
  container = document.createElement("div"); document.body.append(container); root = createRoot(container)
})
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals() })

const render = async (element: React.ReactNode) => { await act(async () => root.render(element)) }
const click = async (element: Element | null | undefined, what: string) => {
  expect(element, what).toBeTruthy()
  await act(async () => (element as HTMLElement).click())
}
const button = (label: string) => [...container.querySelectorAll("button")].find(b => b.textContent?.trim() === label)
/** The card renders collapsed; the fields only exist once it is open. */
/** The card holds more than one switch, so the control is reached through its
 *  own label — which is also what an admin and a screen reader go by. */
const featuredToggle = () => {
  const label = [...container.querySelectorAll("label")].find(l => l.textContent?.includes("Izdvojeno"))
  expect(label, "Izdvojeno label").toBeTruthy()
  return container.querySelector(`#${CSS.escape(label!.getAttribute("for")!)}`)
}
const expand = async () => click([...container.querySelectorAll("button")].find(b => b.textContent?.includes(candidate.title)), "candidate title")
const createCalls = () => api.mock.calls.filter(call => String(call[0]).includes("create-event"))
const createdCandidate = () => JSON.parse(createCalls()[0][1].body).candidate

describe("Izdvojeno in the parsed candidate review", () => {
  it("sends the editorial flag with the import once the admin turns it on", async () => {
    await render(<ParsedCandidateCard candidate={candidate} />)
    await expand()
    await click(featuredToggle(), "Izdvojeno switch")
    await click(button("Kreiraj događaj"), "Kreiraj događaj")
    expect(createCalls()).toHaveLength(1)
    expect(createdCandidate().isFeatured).toBe(true)
  })

  it("can be turned back off before the import", async () => {
    await render(<ParsedCandidateCard candidate={candidate} />)
    await expand()
    await click(featuredToggle(), "Izdvojeno switch on")
    await click(featuredToggle(), "Izdvojeno switch off")
    await click(button("Kreiraj događaj"), "Kreiraj događaj")
    expect(createdCandidate().isFeatured).toBe(false)
  })

  it("imports as not featured when the admin leaves it alone", async () => {
    await render(<ParsedCandidateCard candidate={candidate} />)
    await expand()
    await click(button("Kreiraj događaj"), "Kreiraj događaj")
    expect(createdCandidate().isFeatured).toBe(false)
  })
})
