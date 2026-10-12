// @vitest-environment jsdom
import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { beforeEach, afterEach, describe, it, expect, vi } from "vitest"
import { EventsTable, InlinePricingCell } from "./events-table"
import { EventEditForm } from "./event-edit-form"
import { PriceBadge } from "../public/badges"
import { adaptEvent } from "@/lib/admin/adapters"
import { parseEventFilters } from "@/lib/admin/event-filters"

const api = vi.hoisted(() => vi.fn())
const toastError = vi.hoisted(() => vi.fn())
vi.mock("@/lib/admin/api", () => ({ authedFetch: api }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: toastError } }))
vi.mock("@/components/ui/location-autocomplete", () => ({ LocationAutocomplete: () => null }))
vi.mock("@/components/admin/event-image-picker", () => ({ EventImagePicker: () => null }))
let container: HTMLDivElement, root: Root
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true)
  api.mockReset().mockResolvedValue({ ok: true, json: async () => [], text: async () => "" })
  toastError.mockReset(); localStorage.clear()
  container = document.createElement("div"); document.body.append(container); root = createRoot(container)
})
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals() })
const render = async (node: React.ReactNode) => { await act(async () => root.render(node)) }
const select = async (value: string) => { await act(async () => {
  const field = container.querySelector("select")!; field.value = value; field.dispatchEvent(new Event("change", { bubbles: true }))
}) }
const event = () => adaptEvent({ id: 1, title: "Koncert", slug: "koncert", description: "Opis", isFree: null,
  startsAt: "2099-10-12T18:00:00Z", priceText: "15 EUR", ticketUrl: "https://tickets.example.test", status: "PENDING_REVIEW", categoryId: 1 })

describe("admin pricing workflow", () => {
  it.each([["FREE", true], ["PAID", false], ["UNKNOWN", null]] as const)("updates only isFree from the list: %s", async (state, value) => {
    const row = { ...event(), isFree: state === "UNKNOWN" ? true : null }
    await render(<EventsTable events={[row]} filters={parseEventFilters()} onFiltersChange={vi.fn()} dateSort="asc" onDateSortChange={vi.fn()}
      sortBy="startsAt" onSortByChange={vi.fn()} pagination={{ page: 1, pageSize: 25, total: 1 }} onPageChange={vi.fn()} onPageSizeChange={vi.fn()} />)
    expect(container.querySelector('select[aria-label="Način naplate: Koncert"]')).not.toBeNull()
    await select(state)
    const update = api.mock.calls.find(([, init]) => init?.method === "PUT")!
    expect(update[0]).toBe("/api/admin/events/1")
    expect(JSON.parse(update[1].body)).toEqual({ isFree: value })
  })
  it.each([true, false, null])("full admin editor preserves %s and optional values on save", async isFree => {
    await render(<EventEditForm event={{ ...event(), isFree }} />)
    const save = [...container.querySelectorAll("button")].find(button => button.textContent?.includes("Spremi"))!
    await act(async () => save.click())
    const update = api.mock.calls.find(([, init]) => init?.method === "PUT")!
    expect(JSON.parse(update[1].body)).toMatchObject({ isFree, priceText: "15 EUR", ticketUrl: "https://tickets.example.test" })
  })
  it("disables repeated inline actions while saving and recovers after network failure", async () => {
    let reject!: (error: Error) => void
    const save = vi.fn(() => new Promise<void>((_, fail) => { reject = fail }))
    await render(<InlinePricingCell value={null} title="Koncert" onSave={save} />)
    await select("PAID")
    expect(container.querySelector("select")!.disabled).toBe(true)
    expect(save).toHaveBeenCalledTimes(1)
    await act(async () => reject(new Error("network")))
    expect(container.querySelector("select")!.disabled).toBe(false)
    expect(container.querySelector("select")!.value).toBe("UNKNOWN")
    expect(toastError).toHaveBeenCalledWith("Greška pri spremanju načina naplate")
  })
  it.each([[true, "Besplatno"], [false, "Naplata"], [null, "Cijena nije navedena"]] as const)("public badge labels %s correctly", async (free, label) => {
    await render(<PriceBadge free={free} />)
    expect(container.textContent).toBe(label)
  })
})
