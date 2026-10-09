// @vitest-environment jsdom
import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { EventDuplicateWarning, useEventDuplicateCheck } from "./event-duplicate-warning"
import { EventCreateForm } from "./admin/event-create-form"
import { OrganizerEventForm } from "./organizer/event-form"
import { ParsedCandidateCard } from "./admin/parsed-candidate-card"
import type { ParsedCandidate } from "@/lib/admin/types"

const api = vi.hoisted(() => vi.fn())
vi.mock("@/lib/admin/api", () => ({ authedFetch: api }))
vi.mock("@/lib/organizer/api", () => ({ orgFetch: api }))
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock("@/components/ui/location-autocomplete", () => ({ LocationAutocomplete: () => null }))
vi.mock("@/components/admin/event-image-picker", () => ({ EventImagePicker: () => null }))

const input = { title: "Čarobna đurđevačka šuma", startsAt: "2099-07-09T20:00:00Z", endsAt: "2099-07-10T00:00:00Z", cityName: "Đurđevac" }
const result = { hiddenMatch: false, matches: [{ id: 44, title: input.title, startsAt: input.startsAt, endsAt: input.endsAt,
  isAllDay: false, venueName: "Dvorana Šuma", address: "Trg 1", cityName: "Đurđevac", reasons: ["Podudaranje naslova", "Isti grad"], href: "/admin/events/44" }] }
const response = (value: unknown) => ({ ok: true, json: async () => value, text: async () => "" })
let container: HTMLDivElement, root: Root
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true)
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response([])))
  api.mockReset().mockImplementation(async (path: string) => response(path.endsWith("/check") ? result : path.includes("categories") || path.includes("regions") || path.includes("organizers") ? [] : { id: 77 }))
  container = document.createElement("div"); document.body.append(container); root = createRoot(container)
})
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.useRealTimers(); vi.unstubAllGlobals() })
const render = async (element: React.ReactNode) => { await act(async () => root.render(element)) }
const click = async (text: string) => {
  const button = [...container.querySelectorAll("button")].find(button => button.textContent?.includes(text))
  expect(button, text).toBeDefined()
  await act(async () => button!.click())
}
const change = async (element: HTMLInputElement | HTMLTextAreaElement, value: string) => {
  await act(async () => {
    const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
    Object.getOwnPropertyDescriptor(prototype, "value")!.set!.call(element, value)
    element.dispatchEvent(new Event("input", { bubbles: true }))
    element.dispatchEvent(new Event("change", { bubbles: true }))
  })
}
const creates = () => api.mock.calls.filter(([path, init]) => init?.method === "POST" && !path.endsWith("/check"))
const submit = async () => { await act(async () => container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }))) }

describe("shared advisory duplicate warning", () => {
  function Harness({ title = input.title }: { title?: string }) {
    const check = useEventDuplicateCheck({ ...input, title }, api, "/check")
    return <div onInputCapture={check.cancelPending}>{check.warning}<input aria-label="Opis" /><button onClick={async () => { if (await check.beforeSave(input)) await api("/create", { method: "POST" }) }}>Spremi</button></div>
  }
  it("debounces typing, ignores stale results and makes a fresh check before saving", async () => {
    vi.useFakeTimers()
    await render(<Harness title="Čar" />)
    await act(async () => vi.advanceTimersByTime(500))
    await render(<Harness />)
    await act(async () => vi.advanceTimersByTime(599))
    expect(api).not.toHaveBeenCalled()
    await act(async () => vi.advanceTimersByTime(1))
    expect(api).toHaveBeenCalledTimes(1)
    expect(container.textContent).toContain("Mogući duplikat")
    await click("Spremi")
    expect(api.mock.calls.filter(([path]) => path === "/check")).toHaveLength(2)
    expect(creates()).toHaveLength(0)
    await click("Svejedno kreiraj")
    expect(creates()).toHaveLength(1)
  })
  it("does not check an incomplete title, and cancellation never creates", async () => {
    vi.useFakeTimers()
    await render(<Harness title="" />)
    await act(async () => vi.advanceTimersByTime(1000))
    expect(api).not.toHaveBeenCalled()
    await click("Spremi")
    await click("Odustani")
    expect(creates()).toHaveLength(0)
  })
  it("ignores an older preview response after the title changes", async () => {
    vi.useFakeTimers()
    let resolveOld!: (value: unknown) => void
    api.mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve }))
    await render(<Harness />)
    await act(async () => vi.advanceTimersByTime(600))
    await render(<Harness title="Novi naslov" />)
    await act(async () => resolveOld(response(result)))
    expect(container.textContent).not.toContain("Mogući duplikat")
    await act(async () => vi.advanceTimersByTime(600))
    expect(api).toHaveBeenCalledTimes(2)
  })
  it("does not save after the form unmounts while a fresh check is in flight", async () => {
    let resolveCheck!: (value: unknown) => void
    api.mockImplementationOnce(() => new Promise(resolve => { resolveCheck = resolve }))
    await render(<Harness title="" />)
    await click("Spremi")
    await render(null)
    await act(async () => resolveCheck(response({ matches: [], hiddenMatch: false })))
    expect(creates()).toHaveLength(0)
  })
  it("cancels confirmation on unrelated description edits and on a matching-field change", async () => {
    await render(<Harness />)
    await click("Spremi")
    await change(container.querySelector("input")!, "Novi opis")
    expect(container.textContent).not.toContain("Svejedno kreiraj")
    expect(creates()).toHaveLength(0)
    await click("Spremi")
    await render(<Harness title="Drugi naslov" />)
    expect(container.textContent).not.toContain("Svejedno kreiraj")
    expect(creates()).toHaveLength(0)
  })
  it("keeps a failed check advisory, requiring explicit continuation", async () => {
    api.mockRejectedValue(new Error("network"))
    await render(<Harness />)
    await click("Spremi")
    expect(container.textContent).toContain("Provjera duplikata trenutačno nije dostupna")
    expect(creates()).toHaveLength(0)
    api.mockResolvedValue(response({ id: 77 }))
    await click("Svejedno kreiraj")
    expect(creates()).toHaveLength(1)
  })
  it("proceeds without confirmation when there is no match", async () => {
    api.mockResolvedValue(response({ matches: [], hiddenMatch: false }))
    await render(<Harness />)
    await click("Spremi")
    expect(creates()).toHaveLength(1)
    expect(container.textContent).not.toContain("Svejedno kreiraj")
  })
  it("ignores duplicate save attempts during one confirmation", async () => {
    await render(<Harness />)
    await click("Spremi")
    await click("Spremi")
    expect(api.mock.calls.filter(([path]) => path === "/check")).toHaveLength(1)
    await click("Svejedno kreiraj")
    expect(creates()).toHaveLength(1)
  })
  it("discloses no details for a private match and rejects unsafe record links", async () => {
    await render(<EventDuplicateWarning result={{ matches: [], hiddenMatch: true }} checking={false} confirming={false} onContinue={() => {}} onCancel={() => {}} />)
    expect(container.textContent).toContain("čiji podaci nisu dostupni vašem računu")
    expect(container.querySelectorAll("a")).toHaveLength(0)
    await render(<EventDuplicateWarning result={{ ...result, matches: [{ ...result.matches[0], href: "javascript:alert(1)", title: "<script>bad()</script>" }] }} checking={false} confirming={false} onContinue={() => {}} onCancel={() => {}} />)
    expect(container.querySelector("script")).toBeNull()
    expect(container.querySelector("a")).toBeNull()
  })
  it.each([ ["2099-01-09T21:00:00Z", "22:00"], ["2099-07-09T20:00:00Z", "22:00"] ])("shows %s in Europe/Zagreb", async (startsAt, expected) => {
    await render(<EventDuplicateWarning result={{ ...result, matches: [{ ...result.matches[0], startsAt }] }} checking={false} confirming={false} onContinue={() => {}} onCancel={() => {}} />)
    expect(container.textContent).toContain(expected)
    expect(container.textContent).toContain("02:00")
    expect(container.querySelector("a")?.getAttribute("href")).toBe("/admin/events/44")
  })
})

describe("actual creation forms", () => {
  it("admin checks before creation, can cancel, then explicitly continue", async () => {
    await render(<EventCreateForm />)
    await change(container.querySelector("input")!, input.title)
    await change(container.querySelector('input[type="date"]')!, "2099-07-09")
    await change(container.querySelector('input[type="time"]')!, "22:00")
    await submit()
    expect(creates()).toHaveLength(0)
    expect(container.textContent).toContain("Dvorana Šuma")
    await click("Odustani")
    expect(creates()).toHaveLength(0)
    await submit()
    await click("Svejedno kreiraj")
    expect(creates()).toHaveLength(1)
    expect(creates()[0][0]).toBe("/api/admin/events")
    expect(JSON.parse(creates()[0][1].body).startsAt).toBe("2099-07-09T20:00:00.000Z")
  })
  it("organizer uses the private-aware endpoint before creating, while edits bypass this creation warning", async () => {
    await render(<OrganizerEventForm initial={{ ...input, categoryId: 1, isFree: true }} />)
    await submit()
    expect(api).toHaveBeenCalledWith("/api/organizer/duplicates/check", expect.objectContaining({ method: "POST" }))
    expect(creates()).toHaveLength(0)
    await click("Svejedno kreiraj")
    expect(creates()[0][0]).toBe("/api/organizer/events")
  })
  it("parsed review checks the edited candidate before import and shows preview even when collapsed", async () => {
    vi.useFakeTimers()
    const candidate: ParsedCandidate = { ...input, id: "19:2", city: "Đurđevac", sourceId: "19", candidateIndex: 2, _status: "pending", warnings: [], missingFields: [], confidence: 0.9, category: "koncerti",
      description: "Opis", venueName: null, address: null, county: null, region: null, isFree: true, priceText: null, ticketUrl: null, organizerName: null, imageUrl: null, sourceUrl: "" }
    await render(<ParsedCandidateCard candidate={candidate} />)
    await act(async () => vi.advanceTimersByTime(600))
    expect(container.textContent).toContain("Mogući duplikat")
    expect(container.querySelector('a[href="/admin/events/44"]')).not.toBeNull()
    await click(input.title)
    await click("Kreiraj i objavi")
    expect(creates()).toHaveLength(0)
    await click("Svejedno kreiraj")
    expect(creates()).toHaveLength(1)
    expect(creates()[0][0]).toBe("/api/admin/event-sources/19/create-event")
    expect(JSON.parse(creates()[0][1].body)).toEqual(expect.objectContaining({ candidateIndex: 2, publish: true }))
  })
})
