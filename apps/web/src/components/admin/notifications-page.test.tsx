// @vitest-environment jsdom
import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { NotificationsPage } from "./notifications-page"
import { AdminTopbar } from "./admin-topbar"
import { notificationLabels } from "@/lib/admin/notifications"
const api = vi.hoisted(() => vi.fn())
vi.mock("@/lib/admin/api", () => ({ authedFetch: api, clearToken: vi.fn() }))
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock("next/link", () => ({ default: ({ children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props}>{children}</a> }))
let container: HTMLDivElement, root: Root
const items = Object.keys(notificationLabels).map((kind, index) => ({ key: `notice:${index + 1}`, kind, entityId: index + 1, title: `Događaj ${index}`, href: `/admin/${kind === "revision" ? "event-revisions" : kind === "organizer" ? "organizers?organizerId=" : kind === "source" || kind === "discovery" ? "sources" : "events"}/${index + 1}`, createdAt: "2026-10-09T12:00:00Z", readAt: null, requiresAction: !["organizer", "autoPublished"].includes(kind) }))
const counts = { unread: 6, pending: 4, categories: Object.fromEntries(items.map(item => [item.kind, { unread: 1, pending: item.requiresAction ? 1 : 0 }])) }
const response = (data: unknown) => ({ ok: true, json: async () => data })
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true)
  api.mockReset().mockImplementation(async (url: string) => response(url.includes("counts") ? counts : { items, total: 6, pageCount: 1 }))
  container = document.createElement("div"); document.body.append(container); root = createRoot(container)
})
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals() })
const render = async () => { await act(async () => root.render(<NotificationsPage />)) }
const buttons = (text: string) => [...container.querySelectorAll("button")].filter(button => button.textContent === text)

describe("admin notification workflow", () => {
  it("labels all six categories with separate unread/workflow states and correct destinations", async () => {
    await render()
    for (const label of Object.values(notificationLabels)) expect(container.textContent).toContain(label)
    expect(container.textContent).toContain("Objavljeno — informativno")
    expect(container.textContent).toContain("Registracija — informativno")
    expect(container.textContent).toContain("Čeka pregled")
    expect(container.querySelectorAll("li a")).toHaveLength(6)
    expect(container.querySelector('a[href="/admin/event-revisions/3"]')).not.toBeNull()
    expect(container.querySelectorAll("li .font-bold")).toHaveLength(6)
    expect(api.mock.calls.every(([, options]) => !options?.method)).toBe(true)
  })
  it("marks only the selected notification and refreshes the bell after persistence", async () => {
    await render(); const changed = vi.fn(); window.addEventListener("admin-notifications-changed", changed)
    await act(async () => buttons("Označi kao pročitano")[1].click())
    expect(api).toHaveBeenCalledWith("/api/admin/notifications/read", { method: "POST", body: JSON.stringify({ key: "notice:2" }) })
    expect(changed).toHaveBeenCalledOnce(); window.removeEventListener("admin-notifications-changed", changed)
    expect(api.mock.calls.some(([url]) => /approve|reject|publish/.test(url))).toBe(false)
  })
  it("marks all through the server without sending a user ID or workflow action", async () => {
    await render(); await act(async () => buttons("Označi sve kao pročitano")[0].click())
    expect(api).toHaveBeenCalledWith("/api/admin/notifications/read-all", { method: "POST" })
  })
  it("keeps unread state on persistence failure and offers an understandable error", async () => {
    await render(); api.mockResolvedValueOnce({ ok: false })
    await act(async () => buttons("Označi kao pročitano")[0].click())
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("nije spremljeno")
    expect(container.querySelectorAll("li .font-bold")).toHaveLength(6)
  })
  it("shows an empty state and disables bulk marking when nothing is unread", async () => {
    api.mockImplementation(async (url: string) => response(url.includes("counts") ? { ...counts, unread: 0 } : { items: [], total: 0, pageCount: 1 }))
    await render(); expect(container.textContent).toContain("Nema obavijesti.")
    expect(buttons("Označi sve kao pročitano")[0].disabled).toBe(true)
  })
  it("shows loading and load failure states without marking anything read", async () => {
    api.mockReturnValue(new Promise(() => {})); await render()
    expect(container.textContent).toContain("Učitavanje obavijesti")
    await act(async () => root.unmount()); root = createRoot(container)
    api.mockResolvedValue({ ok: false }); await render()
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("nije moguće učitati")
    expect(api.mock.calls.every(([, options]) => !options?.method)).toBe(true)
  })
  it("keeps pending revisions actionable after reading and styles read entries clearly", async () => {
    api.mockImplementation(async (url: string) => response(url.includes("counts") ? { ...counts, unread: 0 } : { items: items.map(item => ({ ...item, readAt: "2026-10-09T12:01:00Z" })), total: 6, pageCount: 1 }))
    await render(); expect(container.querySelectorAll("li .font-bold")).toHaveLength(0)
    expect(container.textContent).toContain("Pročitano · Čeka pregled")
    expect(buttons("Označi kao pročitano")).toHaveLength(0)
  })
  it("bell ignores old browser timestamps and opens the complete notification center", async () => {
    localStorage.setItem("adminLastSeenEventsAt", "2999-01-01T00:00:00Z")
    api.mockResolvedValue(response({ unread: 6, revisions: 2 }))
    await act(async () => root.render(<AdminTopbar user={{ id: 1, email: "vanesa@example.test", name: "Vanesa", role: "ADMIN" }} />))
    expect(container.querySelector("a")?.getAttribute("href")).toBe("/admin/notifications")
    expect(container.textContent).toContain("6")
    expect(api.mock.calls[0][0]).toBe("/api/admin/pending-counts")
    expect(api.mock.calls).toHaveLength(1)
    expect(localStorage.getItem("adminLastSeenEventsAt")).toBe("2999-01-01T00:00:00Z")
  })
})
