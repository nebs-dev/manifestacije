import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import { PREVIEW_SLUG_COOKIE, PREVIEW_TOKEN_COOKIE } from "./event-preview"

const draft = { enable: vi.fn() }
vi.mock("next/headers", () => ({ draftMode: () => draft }))

const call = async (query: string) => {
  const { GET } = await import("../../app/api/preview/route")
  return GET(new NextRequest(`https://manifestacije.hr/api/preview${query}`))
}

/** The API answers a public event to anyone, and a non-public one only to a
 *  token that passes every check in EventPreviewService. */
const apiStub = ({ publicly, toToken }: { publicly?: unknown; toToken?: unknown }) =>
  vi.fn(async (url: string) => ({
    ok: true,
    json: async () => (String(url).includes("preview=") ? (toToken ?? null) : (publicly ?? null)),
  }))

beforeEach(() => { draft.enable.mockClear() })
afterEach(() => { vi.unstubAllGlobals(); vi.resetModules() })

describe("/api/preview", () => {
  it("asks the API — the only authority on the token — and starts draft mode for a valid one", async () => {
    const spy = apiStub({ publicly: null, toToken: { slug: "skica đ", title: "Skica" } })
    vi.stubGlobal("fetch", spy)

    const res = await call(`?slug=${encodeURIComponent("skica đ")}&token=tok.en`)

    const calls = spy.mock.calls as unknown[][]
    // Public first, then with the token: the token is proven by changing the answer.
    expect(String(calls[0]?.[0])).toContain("/api/public/events/skica%20%C4%91")
    expect(String(calls[0]?.[0])).not.toContain("preview=")
    expect(String(calls[1]?.[0])).toContain("preview=tok.en")
    expect((calls[1]?.[1] as { cache?: string })?.cache).toBe("no-store")
    expect(draft.enable).toHaveBeenCalledOnce()
    expect(res.status).toBe(307)
    // Relative on purpose: an absolute URL built from the request could name a
    // different host than the browser is on, and the cookies would be stranded.
    expect(res.headers.get("location")).toBe("/eventi/skica%20%C4%91")
    expect(res.cookies.get(PREVIEW_TOKEN_COOKIE)?.value).toBe("tok.en")
  })

  it("sets no cookie and redirects nowhere when the API refuses the token", async () => {
    vi.stubGlobal("fetch", apiStub({}))

    const res = await call("?slug=skica&token=krivi")

    expect(res.status).toBe(404)
    expect(draft.enable).not.toHaveBeenCalled()
    expect(res.cookies.get(PREVIEW_TOKEN_COOKIE)).toBeUndefined()
  })

  it("refuses a slug the API did not echo back, so nothing caller-supplied steers the redirect", async () => {
    vi.stubGlobal("fetch", apiStub({ toToken: { slug: "neki-drugi-event" } }))

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

  it("starts no session for an event the public can already see, whatever the token says", async () => {
    // Regression: any token at all used to buy a Draft Mode session on a
    // public slug, and __prerender_bypass with it — an unauthenticated CDN
    // cache bypass for every page that browser then loaded.
    const spy = apiStub({ publicly: { slug: "objavljen", title: "Objavljen" } })
    vi.stubGlobal("fetch", spy)

    const res = await call("?slug=objavljen&token=bilo-sto")

    expect(res.status).toBe(307)
    expect(res.headers.get("location")).toBe("/eventi/objavljen")
    expect(draft.enable).not.toHaveBeenCalled()
    expect(res.cookies.get(PREVIEW_TOKEN_COOKIE)).toBeUndefined()
    expect(res.cookies.get(PREVIEW_SLUG_COOKIE)).toBeUndefined()
    // The token is never even offered: the public answer settled it.
    expect(JSON.stringify(spy.mock.calls)).not.toContain("preview=")
  })

  it("treats an unreachable API as a refusal", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("ECONNREFUSED") }))

    expect((await call("?slug=skica&token=tok.en")).status).toBe(404)
    expect(draft.enable).not.toHaveBeenCalled()
  })
})
