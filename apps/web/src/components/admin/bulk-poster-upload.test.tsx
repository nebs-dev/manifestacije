// @vitest-environment jsdom
import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { BulkPosterUpload } from "./bulk-poster-upload"

const api = vi.hoisted(() => vi.fn())
vi.mock("@/lib/admin/api", () => ({ authedFetch: api }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }))
// The browser's image decoding is not what this component is responsible for.
vi.mock("@/components/screenshots-picker", () => ({
  resizeToBase64: async () => ({ base64: "ZmFrZQ==", mediaType: "image/jpeg" }),
}))

const poster = (name: string) => new File([new Uint8Array([1, 2, 3])], name, { type: "image/png" })
const response = (value: unknown, ok = true) => ({ ok, json: async () => value, text: async () => (ok ? "" : "Obrada nije uspjela.") })

let container: HTMLDivElement, root: Root
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true)
  vi.stubGlobal("URL", { ...URL, createObjectURL: () => "blob:preview", revokeObjectURL: () => {} })
  api.mockReset().mockResolvedValue(response({ id: 31, parsedJson: { candidates: [{}, {}] } }))
  container = document.createElement("div"); document.body.append(container); root = createRoot(container)
})
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals() })

const render = async () => { await act(async () => root.render(<BulkPosterUpload />)) }
const button = (label: string) => [...container.querySelectorAll("button")].find(element => element.textContent?.includes(label))
const click = async (element: Element | undefined, what: string) => {
  expect(element, what).toBeTruthy()
  await act(async () => (element as HTMLElement).click())
}
const choose = async (...files: File[]) => {
  const input = container.querySelector("#bulk-posters") as HTMLInputElement
  Object.defineProperty(input, "files", { value: files, configurable: true })
  await act(async () => input.dispatchEvent(new Event("change", { bubbles: true })))
}
const parseCalls = () => api.mock.calls.filter(call => String(call[0]).includes("manual-email"))

describe("bulk poster processing", () => {
  it("parses each poster as its own source, not as several images of one event", async () => {
    await render()
    await choose(poster("a.png"), poster("b.png"), poster("c.png"))

    await click(button("Obradi sve"), "Obradi sve")

    expect(parseCalls()).toHaveLength(3)
    for (const call of parseCalls()) {
      const body = JSON.parse(call[1].body)
      expect(body.screenshots).toHaveLength(1)
      expect(body.useLlm).toBe(true)
    }
    expect(container.querySelector('[role="status"]')?.textContent).toContain("Obrađeno 3 od 3")
  })

  it("reports how many events were recognised across the run", async () => {
    await render()
    await choose(poster("a.png"), poster("b.png"))

    await click(button("Obradi sve"), "Obradi sve")

    expect(container.querySelector('[role="status"]')?.textContent).toContain("prepoznato 4 događaja")
  })

  it("keeps going when one poster fails, and offers to retry just that one", async () => {
    api.mockImplementation(async (_url: string, init: { body: string }) =>
      JSON.parse(init.body).screenshots.length && api.mock.calls.length === 2
        ? response(null, false)
        : response({ id: 31, parsedJson: { candidates: [{}] } }))
    await render()
    await choose(poster("a.png"), poster("b.png"), poster("c.png"))

    await click(button("Obradi sve"), "Obradi sve")

    expect(parseCalls()).toHaveLength(3)
    expect(container.textContent).toContain("Greška")
    const retry = button("Pokušaj ponovno")
    expect(retry?.textContent).toContain("(1)")

    api.mockResolvedValue(response({ id: 32, parsedJson: { candidates: [{}] } }))
    await click(retry, "retry")
    // Only the failed poster is sent again; the two that worked are not re-parsed.
    expect(parseCalls()).toHaveLength(4)
  })

  it("links every processed poster to its source for review", async () => {
    await render()
    await choose(poster("a.png"))
    await click(button("Obradi sve"), "Obradi sve")

    const link = [...container.querySelectorAll("a")].find(anchor => anchor.getAttribute("href") === "/admin/sources/31")
    expect(link).toBeTruthy()
    expect([...container.querySelectorAll("a")].some(anchor => anchor.getAttribute("href") === "/admin/sources")).toBe(true)
  })

  it("refuses a file that is not an image the parser accepts", async () => {
    await render()
    await choose(new File(["x"], "plan.pdf", { type: "application/pdf" }))

    expect((button("Obradi sve") as HTMLButtonElement).disabled).toBe(true)
    expect(container.querySelectorAll("li")).toHaveLength(0)
  })

  it("takes the same poster once, however often it is chosen", async () => {
    await render()
    const file = poster("a.png")
    await choose(file)
    await choose(file)

    expect(container.querySelectorAll("li")).toHaveLength(1)
  })

  it("publishes nothing on its own", async () => {
    await render()
    await choose(poster("a.png"))
    await click(button("Obradi sve"), "Obradi sve")

    expect(api.mock.calls.map(call => String(call[0])).some(url => url.includes("publish") || url.includes("create-event"))).toBe(false)
  })
})
