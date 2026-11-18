import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import { PREVIEW_TOKEN_COOKIE } from "./event-preview"

const draft = { enable: vi.fn() }
vi.mock("next/headers", () => ({ draftMode: () => draft }))

const call = async (query: string) => {
  const { GET } = await import("../../app/api/preview/route")
  return GET(new NextRequest(`https://manifestacije.hr/api/preview${query}`))
}

beforeEach(() => { draft.enable.mockClear() })
afterEach(() => { vi.unstubAllGlobals(); vi.resetModules() })

describe("/api/preview", () => {
  it("asks the API — the only authority on the token — and starts draft mode for a valid one", async () => {
    const spy = vi.fn(async () => ({ ok: true, json: async () => ({ slug: "skica đ", title: "Skica" }) }))
    vi.stubGlobal("fetch", spy)

    const res = await call(`?slug=${encodeURIComponent("skica đ")}&token=tok.en`)

    const url = String((spy.mock.calls as unknown[][])[0]?.[0])
    expect(url).toContain("/api/public/events/skica%20%C4%91")
    expect(url).toContain("preview=tok.en")
    expect((spy.mock.calls[0]?.[1] as { cache?: string })?.cache).toBe("no-store")
    expect(draft.enable).toHaveBeenCalledOnce()
    expect(res.status).toBe(307)
    // Relative on purpose: an absolute URL built from the request could name a
    // different host than the browser is on, and the cookies would be stranded.
    expect(res.headers.get("location")).toBe("/eventi/skica%20%C4%91")
    expect(res.cookies.get(PREVIEW_TOKEN_COOKIE)?.value).toBe("tok.en")
  })

  it("sets no cookie and redirects nowhere when the API refuses the token", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => null })))

    const res = await call("?slug=skica&token=krivi")

    expect(res.status).toBe(404)
    expect(draft.enable).not.toHaveBeenCalled()
    expect(res.cookies.get(PREVIEW_TOKEN_COOKIE)).toBeUndefined()
  })

  it("refuses a slug the API did not echo back, so nothing caller-supplied steers the redirect", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ slug: "neki-drugi-event" }) })))

    const res = await call("?slug=%2F%2Fevil.example.com&token=tok.en")

    expect(res.status).toBe(404)
    expect(draft.enable).not.toHaveBeenCalled()
  })

  it("rejects a request with no token", async () => {
    const spy = vi.fn()
    vi.stubGlobal("fetch", spy)

    expect((await call("?slug=skica")).status).toBe(400)
    expect(spy).not.toHaveBeenCalled()
  })

  it("treats an unreachable API as a refusal", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("ECONNREFUSED") }))

    expect((await call("?slug=skica&token=tok.en")).status).toBe(404)
    expect(draft.enable).not.toHaveBeenCalled()
  })
})
