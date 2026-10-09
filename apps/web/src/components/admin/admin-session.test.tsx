// @vitest-environment jsdom
import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { AdminShell } from "./admin-shell"
import { authedFetch } from "@/lib/admin/api"
import { resetSessionCheckCache } from "@/lib/session-check"
import { memoryStorage } from "@/test-utils/memory-storage"

const nav = vi.hoisted(() => ({ pathname: "/admin/events", replace: vi.fn(), push: vi.fn() }))
vi.mock("next/navigation", () => ({ useRouter: () => nav, usePathname: () => nav.pathname }))
vi.mock("@/components/admin/admin-sidebar", () => ({ AdminSidebar: () => null }))
vi.mock("@/components/admin/admin-topbar", () => ({ AdminTopbar: ({ user }: { user: { email: string } }) => <span>{user.email}</span> }))

const b64 = (o: object) => btoa(JSON.stringify(o)).replace(/=+$/, "")
const jwt = (exp: number) => `${b64({ alg: "HS256" })}.${b64({ id: 2, exp: Math.floor(Date.now() / 1000) + exp })}.sig`
const admin = { id: 2, email: "admin@example.hr", name: "Admin", role: "ADMIN" }
const res = (status: number, body: unknown = {}) => ({ ok: status < 300, status, json: async () => body })

let container: HTMLDivElement, root: Root, fetchMock: ReturnType<typeof vi.fn>
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true)
  vi.stubGlobal("localStorage", memoryStorage())
  vi.stubGlobal("sessionStorage", memoryStorage())
  fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock)
  localStorage.clear(); sessionStorage.clear(); resetSessionCheckCache(); nav.replace.mockReset()
  container = document.createElement("div"); document.body.append(container); root = createRoot(container)
})
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals() })
const mount = async () => {
  await act(async () => root.render(<AdminShell><p>Admin sadržaj</p></AdminShell>))
  await act(async () => { await new Promise((r) => setTimeout(r, 0)) })
}

describe("admin session handling (AUTH-01 regression)", () => {
  it("valid admin session renders", async () => {
    localStorage.setItem("adminToken", jwt(3600))
    fetchMock.mockResolvedValue(res(200, admin))
    await mount()
    expect(container.textContent).toContain("Admin sadržaj")
  })

  it.each([
    ["429", () => fetchMock.mockResolvedValue(res(429))],
    ["network failure", () => fetchMock.mockRejectedValue(new TypeError("Failed to fetch"))],
  ])("%s without a cached user keeps the token and offers a retry", async (_n, setup) => {
    localStorage.setItem("adminToken", jwt(3600))
    setup()
    await mount()
    expect(localStorage.getItem("adminToken")).not.toBeNull()
    expect(nav.replace).not.toHaveBeenCalled()
    expect(container.textContent).toContain("Provjera prijave trenutno nije uspjela")
  })

  it("429 with a cached user keeps working", async () => {
    localStorage.setItem("adminToken", jwt(3600))
    sessionStorage.setItem("adminUser", JSON.stringify(admin))
    fetchMock.mockResolvedValue(res(429))
    await mount()
    expect(container.textContent).toContain("Admin sadržaj")
    expect(localStorage.getItem("adminToken")).not.toBeNull()
  })

  it("401 or an expired token logs the admin out", async () => {
    localStorage.setItem("adminToken", jwt(3600))
    fetchMock.mockResolvedValue(res(401))
    await mount()
    expect(localStorage.getItem("adminToken")).toBeNull()
    expect(nav.replace).toHaveBeenCalledWith("/admin/login")
  })

  it("a non-admin token is rejected", async () => {
    localStorage.setItem("adminToken", jwt(3600))
    fetchMock.mockResolvedValue(res(200, { id: 1, role: "ORGANIZER", organizerId: 5 }))
    await mount()
    expect(localStorage.getItem("adminToken")).toBeNull()
  })

  it("authedFetch keeps the session on 403/429 and drops it on 401", async () => {
    localStorage.setItem("adminToken", jwt(3600))
    fetchMock.mockResolvedValueOnce(res(403)).mockResolvedValueOnce(res(429))
    await authedFetch("/api/admin/events/1", { method: "DELETE" })
    await authedFetch("/api/admin/events")
    expect(localStorage.getItem("adminToken")).not.toBeNull()
    fetchMock.mockResolvedValueOnce(res(401))
    await authedFetch("/api/admin/events")
    expect(localStorage.getItem("adminToken")).toBeNull()
  })
})
