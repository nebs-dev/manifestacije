// @vitest-environment jsdom
import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { OrganizerEventForm } from "./event-form"

const orgFetch = vi.hoisted(() => vi.fn())
const toastError = vi.hoisted(() => vi.fn())
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }))
vi.mock("sonner", () => ({ toast: { error: toastError, success: vi.fn() } }))
vi.mock("@/lib/organizer/api", () => ({ orgFetch }))
vi.mock("@/components/ui/location-autocomplete", () => ({ LocationAutocomplete: () => null }))

const initial = {
  title: "Podunavlje Trail",
  description: "Opis",
  startsAt: "2099-09-05T16:00:00.000Z",
  endsAt: "2099-09-07T18:00:00.000Z",
  isAllDay: false,
  categoryId: 1,
  isFree: false,
  priceText: "15 EUR",
  ticketUrl: "racesmanager",
  sourceUrl: "https://udruga.hr/trail",
  imageUrl: "https://res.cloudinary.com/demo/image/upload/a.jpg",
}

let container: HTMLDivElement, root: Root
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true)
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ json: async () => [] }))
  orgFetch.mockReset().mockResolvedValue({ ok: true, text: async () => "" })
  toastError.mockReset()
  container = document.createElement("div"); document.body.append(container); root = createRoot(container)
})
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals() })

const render = async () => { await act(async () => root.render(<OrganizerEventForm eventId={1} initial={initial} />)) }
const click = async (el: Element | null) => { expect(el).not.toBeNull(); await act(async () => { (el as HTMLElement).click() }) }
const byLabel = (label: string) => container.querySelector(`[aria-label="${label}"]`)
const buttonByText = (text: string) => [...container.querySelectorAll("button")].find((b) => b.textContent?.includes(text)) ?? null
const submit = async () => { await act(async () => { container.querySelector("form")!.requestSubmit() }) }
const sentBody = () => JSON.parse(orgFetch.mock.calls[0][1].body)

describe("organizer event form (EVT-06)", () => {
  it("warns about a stored invalid link and never renders it as a link", async () => {
    await render()
    expect(container.textContent).toContain("Spremljena poveznica nije valjana i ne prikazuje se na stranici.")
    expect([...container.querySelectorAll("a")].map((a) => a.getAttribute("href"))).not.toContain("racesmanager")
    expect(container.querySelector('input[name="ticketUrl"]')?.getAttribute("type")).not.toBe("url")
  })

  it("saves an unrelated change while the legacy value is still present", async () => {
    await render()
    await submit()
    expect(toastError).not.toHaveBeenCalled()
    expect(orgFetch).toHaveBeenCalledWith("/api/organizer/events/1", expect.objectContaining({ method: "PUT" }))
    const body = sentBody()
    expect(body.ticketUrl).toBe("racesmanager")
    expect(body.priceText).toBe("15 EUR")
    expect(body.endsAt).toBe("2099-09-07T18:00:00.000Z")
  })

  it("clears price, ticket link, source link, image and end with explicit nulls", async () => {
    await render()
    await click(byLabel("Obriši cijenu"))
    await click(byLabel("Obriši poveznicu za ulaznice"))
    await click(byLabel("Obriši poveznicu na događaj"))
    await click(buttonByText("Ukloni završetak"))
    await click(buttonByText("Ukloni"))
    expect(container.textContent).not.toContain("Spremljena poveznica nije valjana")
    await submit()
    expect(toastError).not.toHaveBeenCalled()
    expect(sentBody()).toEqual(expect.objectContaining({
      startsAt: "2099-09-05T16:00:00.000Z",
      endsAt: null, priceText: null, ticketUrl: null, sourceUrl: null, imageUrl: null,
    }))
  })
})
