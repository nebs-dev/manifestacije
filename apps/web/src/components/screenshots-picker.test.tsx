// @vitest-environment jsdom
import React, { act, useState } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { ScreenshotsPicker, screenshotsPayload, type ScreenshotInput } from "./screenshots-picker"
import { ProposalPanel } from "@/components/admin/parsed-candidate-card"
import { adaptEventSource, adaptEventSourceCandidates } from "@/lib/admin/adapters"

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }))

let container: HTMLDivElement, root: Root
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true)
  let n = 0
  vi.stubGlobal("createImageBitmap", vi.fn(async () => ({ width: 100, height: 100 })))
  vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: vi.fn(() => `blob:preview-${++n}`), revokeObjectURL: vi.fn() }))
  HTMLCanvasElement.prototype.getContext = vi.fn(() => ({ drawImage: vi.fn() })) as never
  HTMLCanvasElement.prototype.toDataURL = vi.fn(function (this: HTMLCanvasElement) { return `data:image/jpeg;base64,QUJD${++n}` }) as never
  container = document.createElement("div"); document.body.append(container); root = createRoot(container)
})
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals() })

function Harness({ upload, max = 4, onValue }: { upload?: (file: File) => Promise<string | undefined>; max?: number; onValue: (v: ScreenshotInput[]) => void }) {
  const [value, setValue] = useState<ScreenshotInput[]>([])
  return <ScreenshotsPicker value={value} max={max} upload={upload} onChange={(next) => { setValue(next); onValue(next) }} />
}
const file = (name: string, type = "image/png", size = 10) => new File([new Uint8Array(size)], name, { type })
async function choose(files: File[]) {
  const input = container.querySelector<HTMLInputElement>('input[type="file"]')!
  Object.defineProperty(input, "files", { value: files, configurable: true })
  await act(async () => { input.dispatchEvent(new Event("change", { bubbles: true })) })
  await act(async () => { await new Promise((r) => setTimeout(r, 0)) })
}

describe("ScreenshotsPicker (EVT-07)", () => {
  it("adds several images with previews, uploads them and builds the API payload", async () => {
    let value: ScreenshotInput[] = []
    const upload = vi.fn(async (f: File) => (f.name === "a.png" ? "https://res.cloudinary.com/demo/a.png" : undefined))
    await act(async () => root.render(<Harness upload={upload} onValue={(v) => { value = v }} />))
    await choose([file("a.png"), file("b.jpg", "image/jpeg")])
    expect(value).toHaveLength(2)
    expect(container.querySelectorAll("li img")).toHaveLength(2)
    expect(container.textContent).toContain("Spremljeno")
    expect(container.textContent).toContain("Samo za obradu")
    expect(screenshotsPayload(value)).toEqual([
      { base64: expect.stringMatching(/^QUJD/), mediaType: "image/png", imageUrl: "https://res.cloudinary.com/demo/a.png" },
      { base64: expect.stringMatching(/^QUJD/), mediaType: "image/jpeg" },
    ])
    await act(async () => { container.querySelector<HTMLButtonElement>('[aria-label="Ukloni sliku 1"]')!.click() })
    expect(value).toHaveLength(1)
  })

  it("rejects unsupported and oversized files and respects the limit", async () => {
    let value: ScreenshotInput[] = []
    await act(async () => root.render(<Harness max={2} onValue={(v) => { value = v }} />))
    await choose([file("x.svg", "image/svg+xml")])
    expect(value).toHaveLength(0)
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("JPEG, PNG, WebP i GIF")
    await choose([file("big.png", "image/png", 16 * 1024 * 1024)])
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("prevelika")
    await choose([file("1.png"), file("2.png"), file("3.png")])
    expect(value).toHaveLength(2)
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("Najviše 2")
    expect(container.querySelector('input[type="file"]')).toBeNull()
  })
})

describe("proposal review (EVT-08)", () => {
  it("shows current and proposed values and applies only ticked fields", async () => {
    const onApply = vi.fn()
    await act(async () => root.render(<ProposalPanel proposal={{ startsAt: "2099-11-20T20:00:00+01:00", priceText: "10 EUR", isFree: false }}
      current={{ startsAt: null, priceText: "", isFree: true }} onApply={onApply} onDismiss={vi.fn()} />))
    expect(container.textContent).toContain("Prijedlog izmjena iz dopune")
    expect(container.textContent).toContain("Sada: Besplatno")
    expect(container.textContent).toContain("Prijedlog: Naplata")
    const boxes = container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')
    expect(boxes).toHaveLength(3)
    const priceBox = [...container.querySelectorAll("label")].find((l) => l.textContent?.startsWith("Cijena"))!.querySelector("input")!
    await act(async () => { priceBox.click() })
    await act(async () => { [...container.querySelectorAll("button")].find((b) => b.textContent?.startsWith("Primijeni"))!.click() })
    expect(onApply).toHaveBeenCalledWith(expect.arrayContaining(["startsAt", "isFree"]))
    expect(onApply.mock.calls[0][0]).not.toContain("priceText")
  })

  it("adapts multi-image evidence, supplements and proposals from the API", () => {
    const source = adaptEventSource({ id: 3, updatedAt: "2026-10-12T10:00:00.000Z", parsedJson: {
      sourceImageUrl: "https://res.cloudinary.com/demo/a.png", sourceImageUrls: ["https://res.cloudinary.com/demo/a.png", "javascript:alert(1)"],
      pendingScreenshots: [{ mediaType: "image/png", base64: "QUJD" }],
      supplements: [{ id: "s1", at: "2026-10-12T09:00:00.000Z", text: "U 20 h", imageUrls: ["https://res.cloudinary.com/demo/c.png"], inlineImageCount: 1 }],
      candidates: [{ title: "A", _status: "pending", _proposal: { priceText: "10 EUR" } }, { title: "B", _fromSupplement: true }],
    } })
    expect(source.sourceImageSrcs).toEqual(["https://res.cloudinary.com/demo/a.png", "data:image/png;base64,QUJD", "https://res.cloudinary.com/demo/c.png"])
    expect(source.supplements).toEqual([{ id: "s1", at: "2026-10-12T09:00:00.000Z", text: "U 20 h", imageCount: 2 }])
    expect(source.updatedAt).toBe("2026-10-12T10:00:00.000Z")
    const candidates = adaptEventSourceCandidates({ id: 3, parsedJson: { candidates: [{ title: "A", _proposal: { priceText: "10 EUR" } }, { title: "B", _fromSupplement: true }] } })
    expect(candidates[0]._proposal).toEqual({ priceText: "10 EUR" })
    expect(candidates[1]._fromSupplement).toBe(true)
  })
})
