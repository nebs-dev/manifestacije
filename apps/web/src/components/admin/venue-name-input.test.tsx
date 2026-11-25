// @vitest-environment jsdom
import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { VenueNameInput, type VenueSuggestion } from "./venue-name-input"

const api = vi.hoisted(() => vi.fn())
vi.mock("@/lib/admin/api", () => ({ authedFetch: api }))

const oxygene: VenueSuggestion = { id: 3, name: "Oxygene", address: "Kapucinska 41", cityName: "Osijek", cityId: 1, lat: 45.55, lng: 18.69, label: "Oxygene, Kapucinska 41, Osijek" }
const dvoranaZg: VenueSuggestion = { id: 9, name: "Dvorana", address: "Zagrebačka 1", cityName: "Zagreb", cityId: 9, lat: null, lng: null, label: "Dvorana, Zagrebačka 1, Zagreb" }

const response = (value: unknown) => ({ ok: true, json: async () => value, text: async () => "" })
let container: HTMLDivElement, root: Root
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true)
  vi.useFakeTimers()
  api.mockReset().mockResolvedValue(response([oxygene, dvoranaZg]))
  container = document.createElement("div"); document.body.append(container); root = createRoot(container)
})
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.useRealTimers(); vi.unstubAllGlobals() })

const render = async (element: React.ReactNode) => { await act(async () => root.render(element)) }
const input = () => container.querySelector("input") as HTMLInputElement
const type = async (value: string) => {
  const field = input()
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")!.set!
  await act(async () => {
    setter.call(field, value)
    field.dispatchEvent(new Event("input", { bubbles: true }))
  })
  await act(async () => { vi.advanceTimersByTime(400) })
}
const options = () => [...container.querySelectorAll('[role="option"]')]

describe("venue name autocomplete", () => {
  it("suggests stored venues once enough is typed, and asks for the event's city", async () => {
    await render(<VenueNameInput value="" cityName="Osijek" onChange={() => {}} onPick={() => {}} />)

    await type("oxy")

    expect(api).toHaveBeenCalledTimes(1)
    const url = String(api.mock.calls[0][0])
    expect(url).toContain("q=oxy")
    expect(url).toContain(`city=${encodeURIComponent("Osijek")}`)
    expect(options().map(option => option.textContent)).toEqual([
      expect.stringContaining("Oxygene"),
      expect.stringContaining("Dvorana"),
    ])
  })

  it("asks for nothing on one typed letter", async () => {
    await render(<VenueNameInput value="" onChange={() => {}} onPick={() => {}} />)

    await type("o")

    expect(api).not.toHaveBeenCalled()
    expect(options()).toHaveLength(0)
  })

  it("hands the whole stored venue over when one is picked", async () => {
    const onPick = vi.fn()
    const onChange = vi.fn()
    await render(<VenueNameInput value="" cityName="Osijek" onChange={onChange} onPick={onPick} />)
    await type("oxy")

    await act(async () => (options()[0] as HTMLElement).click())

    expect(onPick).toHaveBeenCalledWith(oxygene)
    expect(onChange).toHaveBeenLastCalledWith("Oxygene")
    expect(options()).toHaveLength(0)
  })

  it("offers a venue from another city too, and says which city it is", async () => {
    const onPick = vi.fn()
    await render(<VenueNameInput value="" cityName="Osijek" onChange={() => {}} onPick={onPick} />)
    await type("dvorana")

    const other = options().find(option => option.textContent?.includes("Zagreb"))
    expect(other).toBeTruthy()
    await act(async () => (other as HTMLElement).click())

    expect(onPick).toHaveBeenCalledWith(dvoranaZg)
  })

  it("keeps free typing working when nothing matches", async () => {
    api.mockResolvedValue(response([]))
    const onChange = vi.fn()
    await render(<VenueNameInput value="" onChange={onChange} onPick={() => {}} />)

    await type("Novo mjesto")

    expect(onChange).toHaveBeenLastCalledWith("Novo mjesto")
    expect(options()).toHaveLength(0)
  })

  it("stays quiet and queries nothing while disabled", async () => {
    await render(<VenueNameInput value="Oxygene" disabled onChange={() => {}} onPick={() => {}} />)

    expect(input().disabled).toBe(true)
    await type("oxy")
    expect(api).not.toHaveBeenCalled()
  })
})
