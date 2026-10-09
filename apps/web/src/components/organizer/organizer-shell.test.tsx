// @vitest-environment jsdom
import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { OrganizerShell } from "./organizer-shell"
import { resetSessionCheckCache } from "@/lib/session-check"
import { memoryStorage } from "@/test-utils/memory-storage"
import { orgFetch } from "@/lib/organizer/api"

const nav = vi.hoisted(() => ({ pathname: "/organizer/events", replace: vi.fn(), push: vi.fn() }))
vi.mock("next/navigation", () => ({ useRouter: () => nav, usePathname: () => nav.pathname }))

const b64 = (o: object) => btoa(JSON.stringify(o)).replace(/=+$/, "")
const jwt = (exp: number) => `${b64({ alg: "HS256" })}.${b64({ id: 1, exp: Math.floor(Date.now() / 1000) + exp })}.sig`
const organizer = { id: 1, email: "org@example.hr", role: "ORGANIZER", organizerId: 5 }

let container: HTMLDivElement, root: Root, fetchMock: ReturnType<typeof vi.fn>
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true)
  vi.stubGlobal("localStorage", memoryStorage())
  vi.stubGlobal("sessionStorage", memoryStorage())
  fetchMock = vi.fn()
  vi.stubGlobal("fetch", fetchMock)
  localStorage.clear()
  resetSessionCheckCache()
  nav.replace.mockReset()
  container = document.createElement("div"); document.body.append(container); root = createRoot(container)
})
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals() })

const mount = async (key = 0) => {
  await act(async () => root.render(<OrganizerShell key={key}><p>Sadržaj stranice</p></OrganizerShell>))
  await act(async () => { await new Promise((r) => setTimeout(r, 0)) })
}
const res = (status: number, body: unknown = {}) => ({ ok: status < 300, status, json: async () => body })

describe("organizer session handling (AUTH-01)", () => {
  it.each([
    ["429 rate limit", () => fetchMock.mockResolvedValue(res(429))],
    ["500 server error", () => fetchMock.mockResolvedValue(res(500))],
    ["network failure", () => fetchMock.mockRejectedValue(new TypeError("Failed to fetch"))],
  ])("%s keeps a valid session and shows a Croatian retry banner", async (_name, setup) => {
    localStorage.setItem("orgToken", jwt(3600))
    localStorage.setItem("orgUser", JSON.stringify(organizer))
    setup()
    await mount()
    expect(localStorage.getItem("orgToken")).not.toBeNull()
    expect(nav.replace).not.toHaveBeenCalled()
    expect(container.textContent).toContain("Provjera prijave trenutno nije uspjela. Ostajete prijavljeni")
    expect(container.textContent).toContain("Sadržaj stranice")
    expect(container.textContent).toContain("org@example.hr")
  })

  it("retry after a transient failure restores the session without re-login", async () => {
    localStorage.setItem("orgToken", jwt(3600))
    fetchMock.mockResolvedValueOnce(res(429)).mockResolvedValueOnce(res(200, organizer))
    await mount()
    const retry = [...container.querySelectorAll("button")].find((b) => b.textContent === "Pokušaj ponovno")!
    await act(async () => { retry.click() })
    await act(async () => { await new Promise((r) => setTimeout(r, 0)) })
    expect(container.textContent).not.toContain("Provjera prijave trenutno nije uspjela")
    expect(nav.replace).not.toHaveBeenCalled()
  })

  it("401 clears the session and sends the organizer to login with an expiry notice", async () => {
    localStorage.setItem("orgToken", jwt(3600))
    fetchMock.mockResolvedValue(res(401))
    await mount()
    expect(localStorage.getItem("orgToken")).toBeNull()
    expect(nav.replace).toHaveBeenCalledWith("/organizer/login?sesija=istekla")
    expect(container.textContent).not.toContain("Sadržaj stranice")
  })

  it("an expired token is cleared without an API call", async () => {
    localStorage.setItem("orgToken", jwt(-60))
    await mount()
    expect(fetchMock).not.toHaveBeenCalled()
    expect(localStorage.getItem("orgToken")).toBeNull()
    expect(nav.replace).toHaveBeenCalledWith("/organizer/login?sesija=istekla")
  })

  it("a non-organizer token is signed out", async () => {
    localStorage.setItem("orgToken", jwt(3600))
    fetchMock.mockResolvedValue(res(200, { id: 2, role: "ADMIN", organizerId: null }))
    await mount()
    expect(localStorage.getItem("orgToken")).toBeNull()
    expect(nav.replace).toHaveBeenCalledWith("/organizer/login")
  })

  it("more than 10 page navigations validate the session once", async () => {
    localStorage.setItem("orgToken", jwt(3600))
    fetchMock.mockResolvedValue(res(200, organizer))
    for (let i = 0; i < 12; i++) await mount(i)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(nav.replace).not.toHaveBeenCalled()
    expect(localStorage.getItem("orgToken")).not.toBeNull()
  })
})

describe("orgFetch", () => {
  it("ends the session only on 401", async () => {
    const assign = vi.fn()
    vi.stubGlobal("location", { ...window.location, assign })
    localStorage.setItem("orgToken", jwt(3600))
    fetchMock.mockResolvedValueOnce(res(429)).mockResolvedValueOnce(res(500)).mockResolvedValueOnce(res(403))
    for (let i = 0; i < 3; i++) await orgFetch("/api/organizer/events")
    expect(localStorage.getItem("orgToken")).not.toBeNull()
    expect(assign).not.toHaveBeenCalled()
    fetchMock.mockResolvedValueOnce(res(401))
    await orgFetch("/api/organizer/events")
    expect(localStorage.getItem("orgToken")).toBeNull()
    expect(assign).toHaveBeenCalledWith("/organizer/login?sesija=istekla")
  })
})
