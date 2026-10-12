// @vitest-environment jsdom
import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { renderToStaticMarkup } from "react-dom/server"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { RichText } from "./rich-text"
import { RichTextEditor } from "./rich-text-editor"
import { parseRichText, richTextSummary, richTextToPlain } from "@/lib/rich-text"
import { eventToJsonLd } from "@/lib/event-jsonld"
import { events } from "@/lib/data"

const html = (source: string) => renderToStaticMarkup(<RichText source={source} />)

describe("rich-text descriptions (EVT-03)", () => {
  it("renders bold, italic, safe links, line breaks and lists", () => {
    const out = html("**Program** i *gosti*\nDrugi red\n\n- Prvo\n- [Ulaznice](https://example.hr/u?a=1&b=2)\n\n1. Jedan\n2. Dva\n\nViše na https://manifestacije.hr/eventi.")
    expect(out).toContain('<strong class="font-semibold">Program</strong>')
    expect(out).toContain("<em>gosti</em>")
    expect(out).toContain("<br/>Drugi red")
    expect(out).toMatch(/<ul class="[^"]*list-disc[^"]*"><li[^>]*>Prvo<\/li>/)
    expect(out).toContain('href="https://example.hr/u?a=1&amp;b=2"')
    expect(out).toContain('rel="noopener noreferrer nofollow ugc"')
    expect(out).toMatch(/<ol class="[^"]*list-decimal/)
    expect(out).toMatch(/<a href="https:\/\/manifestacije\.hr\/eventi"[^>]*>https:\/\/manifestacije\.hr\/eventi<\/a>\./)
  })

  it("keeps legacy plain-text descriptions readable", () => {
    const legacy = "Koncert tamburaša.\nUlaz slobodan.\n\nDobrodošli svi!"
    expect(parseRichText(legacy)).toEqual([
      { type: "p", lines: [[{ type: "text", text: "Koncert tamburaša." }], [{ type: "text", text: "Ulaz slobodan." }]] },
      { type: "p", lines: [[{ type: "text", text: "Dobrodošli svi!" }]] },
    ])
    expect(richTextToPlain(legacy)).toBe(legacy)
    expect(html("Cijena 5 * 2 EUR i 3*4")).toContain("Cijena 5 * 2 EUR i 3*4")
  })

  it("never emits raw HTML or unsafe links", () => {
    const evil = `<script>alert(1)</script> <img src=x onerror=alert(1)> [klik](javascript:alert(1)) [data](data:text/html,x) **<b>x</b>**`
    const out = html(evil)
    expect(out).not.toMatch(/<script|<img|<b>|href="javascript|href="data/i)
    expect(out).toContain("&lt;script&gt;")
    expect(out).toContain("klik")
    expect(out).not.toContain("<a ")
  })

  it("produces clean plain text and summaries for cards, meta and JSON-LD", () => {
    const md = "**Veliki** koncert u [Osijeku](https://example.hr)\n\n- *Ulaz* besplatan"
    expect(richTextToPlain(md)).toBe("Veliki koncert u Osijeku\n\n• Ulaz besplatan")
    expect(richTextSummary(md)).toBe("Veliki koncert u Osijeku • Ulaz besplatan")
    expect(richTextSummary("a".repeat(400), 50)).toHaveLength(50)
    const jsonLd = eventToJsonLd({ ...events[0], description: md }, "https://manifestacije.hr") as { description: string }
    expect(jsonLd.description).toBe("Veliki koncert u Osijeku • Ulaz besplatan")
  })
})

const frames: FrameRequestCallback[] = []
describe("RichTextEditor", () => {
  let container: HTMLDivElement, root: Root
  beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true)
    frames.length = 0
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => { frames.push(cb); return frames.length })
    container = document.createElement("div"); document.body.append(container); root = createRoot(container)
  })
  afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals() })

  it("wraps the selection, inserts links and lists, previews, and submits the text through a form field", async () => {
    const onChange = vi.fn()
    await act(async () => root.render(<form><RichTextEditor name="description" defaultValue="Koncert u parku" onChange={onChange} /></form>))
    const textarea = container.querySelector("textarea")!
    const click = async (label: string) => {
      await act(async () => { container.querySelector<HTMLButtonElement>(`[aria-label^="${label}"]`)!.click() })
      await act(async () => { frames.splice(0).forEach((cb) => cb(0)) })
    }

    textarea.setSelectionRange(0, 7)
    await click("Podebljano")
    expect(textarea.value).toBe("**Koncert** u parku")
    textarea.setSelectionRange(14, 19)
    await click("Poveznica")
    expect(textarea.value).toBe("**Koncert** u [parku](https://)")
    expect(textarea.value.slice(textarea.selectionStart, textarea.selectionEnd)).toBe("https://")
    textarea.setSelectionRange(0, 0)
    await click("Popis")
    expect(textarea.value.startsWith("- **Koncert**")).toBe(true)
    expect(onChange).toHaveBeenLastCalledWith(textarea.value)
    expect(new FormData(container.querySelector("form")!).get("description")).toBe(textarea.value)

    await act(async () => { [...container.querySelectorAll("button")].find((b) => b.textContent?.includes("Pregled"))!.click() })
    expect(container.querySelector("strong")?.textContent).toBe("Koncert")
    expect(new FormData(container.querySelector("form")!).get("description")).toBe(textarea.value)
  })

  it("supports Ctrl+B and Ctrl+I shortcuts", async () => {
    await act(async () => root.render(<RichTextEditor defaultValue="tekst" />))
    const textarea = container.querySelector("textarea")!
    textarea.setSelectionRange(0, 5)
    await act(async () => { textarea.dispatchEvent(new KeyboardEvent("keydown", { key: "i", ctrlKey: true, bubbles: true })) })
    expect(textarea.value).toBe("*tekst*")
  })
})
