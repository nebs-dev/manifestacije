// @vitest-environment jsdom
import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { EventRevisionReview } from "./event-revision-review"
import { AdminTopbar } from "./admin-topbar"
import EditEventPage from "../../../app/organizer/events/[id]/page"

const api = vi.hoisted(() => vi.fn())
const org = vi.hoisted(() => vi.fn())
vi.mock("@/lib/admin/api", () => ({ authedFetch: api, clearToken: vi.fn() }))
vi.mock("@/lib/organizer/api", () => ({ orgFetch: org }))
vi.mock("@/hooks/use-organizer-auth", () => ({ useOrganizerAuth: vi.fn() }))
vi.mock("next/navigation", () => ({ useParams: () => ({ id: "7" }), useRouter: () => ({ push: vi.fn() }) }))
vi.mock("@/components/organizer/event-form", () => ({ OrganizerEventForm: ({ initial, published }: { initial: { title: string }; published: boolean }) => <div data-published={published}>{initial.title}</div> }))

const revision = {
  id: 3, eventId: 7, version: 2, status: "PENDING", submittedAt: "2026-10-09T12:00:00Z", conflict: false,
  event: { id: 7, title: "Objavljeni koncert", slug: "objavljeni-koncert" }, organizer: { id: 4, name: "Udruga" }, submittedBy: { name: "Ana", email: "ana@example.test" },
  original: { title: "Objavljeni koncert" }, proposed: { title: "Predloženi koncert" }, categories: [{ id: 1, name: "Glazba" }],
  changes: [
    { field: "title", original: "Objavljeni koncert", proposed: "Predloženi koncert" },
    { field: "endsAt", original: "2026-10-10T00:00:00Z", proposed: null },
    { field: "description", original: "Opis", proposed: '<script>alert("x")</script>' },
    { field: "ticketUrl", original: "https://example.test", proposed: "javascript:alert(1)" },
    { field: "categoryIds", original: [], proposed: [1] },
    { field: "occurrences", original: [], proposed: [{ startsAt: "2026-10-09T20:00:00Z", endsAt: "2026-10-10T00:00:00Z" }] },
  ],
}
let container: HTMLDivElement, root: Root
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true)
  api.mockReset().mockResolvedValue({ ok: true, json: async () => revision })
  org.mockReset()
  localStorage.clear()
  container = document.createElement("div"); document.body.append(container); root = createRoot(container)
})
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals() })
const button = (text: string) => [...container.querySelectorAll("button")].find(el => el.textContent === text)!
const click = async (text: string) => { await act(async () => button(text).click()) }
const render = async () => { await act(async () => root.render(<EventRevisionReview id={3} />)) }

describe("event revision review", () => {
  it("shows Croatian field changes, cleared values, Zagreb times and escaped content", async () => {
    await render()
    for (const text of ["Izvorna verzija", "Predložena verzija", "Predloženi koncert", "Nije navedeno", "Završetak", "Raspored termina", "Glazba", "22:00", "02:00", "Ana", "Udruga"]) expect(container.textContent).toContain(text)
    expect(container.querySelector("script")).toBeNull()
    expect(container.querySelector('a[href^="javascript:"]')).toBeNull()
    expect(container.textContent).toContain('<script>alert("x")</script>')
  })
  it("approves the exact version and refreshes the notification count", async () => {
    await render()
    const changed = vi.fn(); window.addEventListener("event-revisions-changed", changed)
    api.mockResolvedValueOnce({ ok: true, json: async () => ({ status: "APPROVED" }) })
    await click("Odobri izmjene")
    expect(api).toHaveBeenLastCalledWith("/api/admin/event-revisions/3/approve", expect.objectContaining({ method: "POST", body: JSON.stringify({ version: 2 }) }))
    expect(container.textContent).toContain("Izmjene su odobrene.")
    expect(button("Odobri izmjene")).toBeUndefined()
    expect(changed).toHaveBeenCalledOnce(); window.removeEventListener("event-revisions-changed", changed)
  })
  it("sends an optional rejection reason", async () => {
    await render()
    const textarea = container.querySelector("textarea")!
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(textarea, "Provjerite datum.")
      textarea.dispatchEvent(new Event("input", { bubbles: true }))
    })
    api.mockResolvedValueOnce({ ok: true, json: async () => ({ status: "REJECTED", rejectionReason: "Provjerite datum." }) })
    await click("Odbij izmjene")
    expect(JSON.parse(api.mock.calls.at(-1)![1].body)).toEqual({ version: 2, reason: "Provjerite datum." })
    expect(container.textContent).toContain("Objavljena verzija nije promijenjena.")
  })
  it("blocks approval on conflicts until a fresh review is explicitly loaded", async () => {
    await render()
    api.mockResolvedValueOnce({ ok: false, status: 409, text: async () => JSON.stringify({ message: "Prijedlog je promijenjen." }) })
    await click("Odobri izmjene")
    expect(button("Odobri izmjene").disabled).toBe(true)
    expect(container.textContent).toContain("Prijedlog je promijenjen.")
    api.mockResolvedValueOnce({ ok: true, json: async () => ({ ...revision, version: 3 }) })
    await click("Osvježi pregled")
    expect(button("Odobri izmjene").disabled).toBe(false)
    expect(api.mock.calls.filter(([, options]) => options?.method === "POST")).toHaveLength(1)
  })
  it("keeps pending revisions in the notification count after clicking the bell", async () => {
    localStorage.setItem("adminLastSeenEventsAt", "2999-01-01T00:00:00Z")
    api.mockResolvedValue({ ok: true, json: async () => ({ events: 0, sources: 0, organizers: 0, revisions: 2 }) })
    await act(async () => root.render(<AdminTopbar />))
    const link = container.querySelector("a")!
    expect(link.getAttribute("href")).toBe("/admin/notifications")
    expect(container.textContent).toContain("2")
    await act(async () => { link.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })) })
    expect(container.textContent).toContain("2")
    await act(async () => window.dispatchEvent(new Event("event-revisions-changed")))
    expect(api).toHaveBeenCalledTimes(2)
  })
  it("initially loads published data and explicitly lets the organizer view/edit their proposal", async () => {
    org.mockResolvedValueOnce({ ok: true, json: async () => [{ id: 7, title: "Objavljeni koncert", status: "PUBLISHED", category: { id: 1 }, revisions: [{ id: 3 }] }] })
    await act(async () => root.render(<EditEventPage />))
    expect(container.querySelector('[data-published="true"]')?.textContent).toBe("Objavljeni koncert")
    org.mockResolvedValueOnce({ ok: true, json: async () => revision })
    await click("Pogledaj predložene izmjene")
    expect(org).toHaveBeenLastCalledWith("/api/organizer/event-revisions/3")
    expect(container.querySelector('[data-published="true"]')?.textContent).toBe("Objavljeni koncert")
    await click("Uredi prijedlog")
    expect(container.querySelector('[data-published="true"]')?.textContent).toBe("Predloženi koncert")
    await click("Učitaj objavljenu verziju")
    expect(container.querySelector('[data-published="true"]')?.textContent).toBe("Objavljeni koncert")
  })
});
