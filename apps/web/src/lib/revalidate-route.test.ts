import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import { revalidateTag } from "next/cache"
import { POST } from "../../app/api/revalidate/route"

vi.mock("next/cache", () => ({ revalidateTag: vi.fn() }))
const request = (secret = "test-secret", body = JSON.stringify({ tag: "events" })) =>
  new NextRequest("http://localhost/api/revalidate", { method: "POST", headers: { "x-revalidate-secret": secret }, body })
beforeEach(() => {
  vi.stubEnv("REVALIDATE_SECRET", "test-secret")
  vi.spyOn(console, "info").mockImplementation(() => {})
  vi.spyOn(console, "error").mockImplementation(() => {})
})
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); vi.mocked(revalidateTag).mockReset() })
describe("revalidation endpoint", () => {
  it.each(["", "wrong", "same-length"])("rejects bad secret %s", async secret => {
    expect((await POST(request(secret))).status).toBe(401)
    expect(revalidateTag).not.toHaveBeenCalled()
  })
  it("fails closed when unconfigured", async () => {
    vi.stubEnv("REVALIDATE_SECRET", "")
    expect((await POST(request(""))).status).toBe(503)
    expect(revalidateTag).not.toHaveBeenCalled()
  })
  it.each(["not json", "null", "{}", "[]", '{"tag":"unknown"}', '{"tag":[]}'])("rejects invalid body %s", async body => {
    expect((await POST(request("test-secret", body))).status).toBe(400)
    expect(revalidateTag).not.toHaveBeenCalled()
  })
  it.each(["events", "partners", "taxonomy", "organizers"])("invalidates approved tag %s before success", async tag => {
    const result = await POST(request("test-secret", JSON.stringify({ tag })))
    expect(result.status).toBe(200)
    expect(revalidateTag).toHaveBeenCalledWith(tag)
    expect(await result.json()).toEqual({ revalidated: true, tag })
    if (tag === "events") expect(revalidateTag).toHaveBeenCalledWith("organizers")
    else expect(revalidateTag).toHaveBeenCalledTimes(1)
  })
  it("surfaces invalidation errors as 500", async () => {
    vi.mocked(revalidateTag).mockImplementation(() => { throw new Error("failed") })
    expect((await POST(request())).status).toBe(500)
  })
})
