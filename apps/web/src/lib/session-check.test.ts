import { afterEach, describe, expect, it, vi } from "vitest"
import { checkSession, classifySessionStatus, isTokenExpired, loginErrorMessage, resetSessionCheckCache } from "./session-check"

const b64 = (o: object) => btoa(JSON.stringify(o)).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_")
export const fakeJwt = (expSecondsFromNow: number) => `${b64({ alg: "HS256" })}.${b64({ id: 1, exp: Math.floor(Date.now() / 1000) + expSecondsFromNow })}.sig`
const response = (status: number, body: unknown = {}) => ({ status, json: async () => body }) as Response

afterEach(() => resetSessionCheckCache())

describe("session check classification (AUTH-01)", () => {
  it("only 401/403 invalidate; 429 and 5xx are transient", () => {
    expect(classifySessionStatus(200)).toBe("valid")
    expect(classifySessionStatus(401)).toBe("invalid")
    expect(classifySessionStatus(403)).toBe("invalid")
    expect(classifySessionStatus(429)).toBe("unavailable-rate-limited")
    expect(classifySessionStatus(500)).toBe("unavailable-server")
    expect(classifySessionStatus(503)).toBe("unavailable-server")
  })

  it.each([
    [401, { kind: "invalid", reason: "rejected" }],
    [429, { kind: "unavailable", reason: "rate-limited" }],
    [502, { kind: "unavailable", reason: "server" }],
  ])("maps HTTP %i from /auth/me", async (status, expected) => {
    expect(await checkSession(fakeJwt(3600), { fetchImpl: vi.fn().mockResolvedValue(response(status)) })).toEqual(expected)
  })

  it("treats a network failure as unavailable, not as logged out", async () => {
    expect(await checkSession(fakeJwt(3600), { fetchImpl: vi.fn().mockRejectedValue(new TypeError("Failed to fetch")) }))
      .toEqual({ kind: "unavailable", reason: "network" })
  })

  it("detects an expired token locally without calling the API", async () => {
    const fetchImpl = vi.fn()
    const expired = fakeJwt(-10)
    expect(isTokenExpired(expired)).toBe(true)
    expect(isTokenExpired(fakeJwt(60))).toBe(false)
    expect(await checkSession(expired, { fetchImpl })).toEqual({ kind: "invalid", reason: "expired" })
    expect(await checkSession(null, { fetchImpl })).toEqual({ kind: "invalid", reason: "missing" })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it("shares one /auth/me request across shell + page and quick navigation", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(response(200, { id: 1, role: "ORGANIZER", organizerId: 5 }))
    const token = fakeJwt(3600)
    const now = Date.now()
    // 12 page navigations within 25 seconds, each mounting shell + page.
    for (let i = 0; i < 12; i++) {
      await Promise.all([checkSession(token, { fetchImpl, now: now + i * 2000 }), checkSession(token, { fetchImpl, now: now + i * 2000 })])
    }
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    await checkSession(token, { fetchImpl, now: now + 31_000 })
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it("does not reuse a failed check", async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(response(429)).mockResolvedValueOnce(response(200, { id: 1, role: "ORGANIZER", organizerId: 5 }))
    const token = fakeJwt(3600)
    expect((await checkSession(token, { fetchImpl })).kind).toBe("unavailable")
    expect((await checkSession(token, { fetchImpl })).kind).toBe("valid")
  })
})

describe("login error messages are Croatian", () => {
  it.each([
    [401, { message: "Invalid credentials" }, "Pogrešan email ili lozinka."],
    [429, { message: "ThrottlerException: Too Many Requests" }, "Previše pokušaja prijave. Pričekajte minutu pa pokušajte ponovno."],
    [400, { message: ["email must be an email"] }, "Unesite ispravan email i lozinku."],
    [503, null, "Prijava trenutno nije moguća. Pokušajte ponovno za nekoliko trenutaka."],
    [403, { message: "Ovaj organizator još nema postavljenu lozinku." }, "Ovaj organizator još nema postavljenu lozinku."],
  ])("HTTP %i", (status, body, expected) => {
    expect(loginErrorMessage(status, body)).toBe(expected)
  })
})
