// @vitest-environment jsdom
import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { ManualSourceForm } from "./source-forms"
import SubmitLinkPage from "../../../app/organizer/submit-link/page"

const authedFetch = vi.hoisted(() => vi.fn())
const orgFetch = vi.hoisted(() => vi.fn())
const toastError = vi.hoisted(() => vi.fn())
vi.mock("@/lib/admin/api", () => ({ authedFetch }))
vi.mock("@/lib/organizer/api", () => ({ orgFetch }))
vi.mock("@/hooks/use-organizer-auth", () => ({ useOrganizerAuth: vi.fn() }))
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }))
vi.mock("sonner", () => ({ toast: { error: toastError, warning: vi.fn(), success: vi.fn() } }))

let container: HTMLDivElement, root: Root
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true)
  // Image decoding/canvas and network are mocks; these are UI flow tests,
  // not visual browser QA or a successful real-provider OCR test.
  vi.stubGlobal("Image", class {
    width = 1000; height = 650; onload?: () => void
    set src(_value: string) { queueMicrotask(() => this.onload?.()) }
  })
  vi.stubGlobal("createImageBitmap", vi.fn().mockResolvedValue({ width: 1000, height: 650 }))
  vi.stubGlobal("URL", class extends URL {
    static createObjectURL() { return "blob:fixture" }
    static revokeObjectURL() {}
  })
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ drawImage: vi.fn() } as never)
  vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue("data:image/png;base64,fixture-image")
  authedFetch.mockReset().mockResolvedValue({ ok: true, json: async () => ({ id: 1 }) })
  orgFetch.mockReset().mockResolvedValue({ ok: true, json: async () => ({ imageUrl: "https://cdn.example/evidence.png" }) })
  toastError.mockReset()
  container = document.createElement("div"); document.body.append(container); root = createRoot(container)
})
afterEach(async () => {
  await act(async () => root.unmount()); container.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals()
})

async function attachPoster() {
  const input = container.querySelector('input[type="file"]') as HTMLInputElement
  Object.defineProperty(input, "files", { value: [new File(["fixture"], "poster.png", { type: "image/png" })], configurable: true })
  await act(async () => { input.dispatchEvent(new Event("change", { bubbles: true })) })
}
async function submit() {
  await act(async () => { container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })) })
}

describe("poster submission forms", () => {
  it("admin keeps image parsing enabled and sends the image bytes", async () => {
    await act(async () => root.render(<ManualSourceForm />))
    await attachPoster()
    const ai = container.querySelector('input[type="checkbox"]') as HTMLInputElement
    expect(ai.checked).toBe(true)
    expect(ai.disabled).toBe(true)
    await submit()
    expect(authedFetch).toHaveBeenCalledWith("/api/admin/event-sources/manual-email", expect.objectContaining({ method: "POST" }))
    expect(JSON.parse(authedFetch.mock.calls[0][1].body)).toMatchObject({ screenshotBase64: "fixture-image", screenshotMediaType: "image/jpeg", useLlm: true })
  })

  it("admin retains the poster and shows a failed provider response for retry", async () => {
    authedFetch.mockResolvedValue({ ok: false, text: async () => "AI parsiranje nije dostupno zbog postavki pristupa." })
    await act(async () => root.render(<ManualSourceForm />))
    await attachPoster(); await submit()
    expect(container.textContent).toContain("poster.png")
    expect(toastError).toHaveBeenCalledWith("Kreiranje neuspješno", expect.objectContaining({ description: expect.stringContaining("postavki pristupa") }))
  })

  it("organizer uploads evidence and sends image bytes plus its evidence URL for review", async () => {
    await act(async () => root.render(<SubmitLinkPage />))
    await attachPoster(); await submit()
    const upload = orgFetch.mock.calls.find(([path]) => path === "/api/organizer/uploads/event-image")!
    expect(upload[1].body).toBeInstanceOf(FormData)
    const submission = orgFetch.mock.calls.find(([path]) => path === "/api/organizer/events/submit-url")!
    expect(JSON.parse(submission[1].body)).toMatchObject({ screenshotBase64: "fixture-image", screenshotMediaType: "image/png", sourceImageUrl: "https://cdn.example/evidence.png", useLlm: true })
  })
})
