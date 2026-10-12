// @vitest-environment jsdom
import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { OrganizerShell } from "./organizer-shell"
import LoginPage from "../../../app/organizer/login/page"
import { useOrganizerAuth } from "@/hooks/use-organizer-auth"
import { clearOrganizerSession, storeOrganizerSession, ORG_TOKEN_KEY, ORG_USER_KEY } from "@/lib/organizer/auth"
import { orgFetch } from "@/lib/organizer/api"
import { resetSessionCheckCache } from "@/lib/session-check"

const nav = vi.hoisted(() => ({ pathname: "/organizer/login", push: vi.fn(), replace: vi.fn() }))
vi.mock("next/navigation", () => ({ useRouter: () => nav, usePathname: () => nav.pathname }))
vi.mock("next/link", () => ({ default: ({ children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props}>{children}</a> }))
const user = { id: 1, email: "organizer@example.test", role: "ORGANIZER", organizerId: 5 }
const other = { ...user, id: 2, email: "other@example.test", organizerId: 6 }
const jwt = (id = 1, seconds = 3600) => `header.${btoa(JSON.stringify({ id, exp: Math.floor(Date.now() / 1000) + seconds }))}.sig`
const response = (status: number, body: unknown = user) => ({ ok: status >= 200 && status < 300, status, json: async () => body }) as Response
function deferred() { let resolve!: (value: Response) => void; const promise = new Promise<Response>(r => { resolve = r }); return { promise, resolve } }
let container: HTMLDivElement, root: Root, fetchMock: ReturnType<typeof vi.fn>
function Protected() {
  const { status, user, retry } = useOrganizerAuth()
  return <div data-session={status}>{user?.email}<button onClick={retry}>Retry page</button>Zaštićeni sadržaj</div>
}
function tree() { return <OrganizerShell>{nav.pathname === "/organizer/login" ? <LoginPage /> : <Protected />}</OrganizerShell> }
const render = async () => { await act(async () => root.render(tree())) }
const navigate = async (pathname: string) => { nav.pathname = pathname; await render() }
const click = async (text: string) => { await act(async () => [...container.querySelectorAll("button")].find(x => x.textContent === text)!.click()) }
const storageEvent = (key: string | null = ORG_TOKEN_KEY, storageArea: Storage = localStorage) => window.dispatchEvent(new StorageEvent("storage", { key, storageArea }))
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true)
  // Real jsdom Storage is needed for genuine StorageEvent type checking.
  vi.stubGlobal("localStorage", window.localStorage)
  localStorage.clear(); resetSessionCheckCache()
  fetchMock = vi.fn().mockResolvedValue(response(200)); vi.stubGlobal("fetch", fetchMock)
  nav.pathname = "/organizer/login"; nav.push.mockReset(); nav.replace.mockReset()
  container = document.createElement("div"); document.body.append(container); root = createRoot(container)
})
afterEach(async () => { await act(async () => root.unmount()); container.remove(); resetSessionCheckCache(); vi.unstubAllGlobals() })

describe("persistent organizer layout session lifecycle", () => {
  it("successful login navigates and unlocks the mounted layout without a reload", async () => {
    await render()
    fetchMock.mockResolvedValueOnce(response(200, { token: jwt(), user }))
    const fields = container.querySelectorAll("input")
    fields[0].value = user.email; fields[1].value = "Synthetic-password-42!"
    await act(async () => container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })))
    expect(nav.push).toHaveBeenCalledWith("/organizer/events")
    await navigate("/organizer/events")
    expect(container.textContent).toContain("Zaštićeni sadržaj")
    expect(container.querySelector("[data-session]")?.getAttribute("data-session")).toBe("authenticated")
    expect(nav.replace).not.toHaveBeenCalled()
    expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith("/auth/me"))).toHaveLength(1)
  })

  it("returning login, rapid route changes and remount keep the session with one shared check", async () => {
    storeOrganizerSession(jwt(), user); await render()
    await navigate("/organizer/events"); await navigate("/organizer/events/new"); await navigate("/organizer/submit-link")
    await act(async () => root.unmount()); root = createRoot(container); await render()
    expect(container.textContent).toContain(user.email)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(nav.replace).not.toHaveBeenCalled()
  })

  it("entering a protected route without a session redirects even if the public layout already mounted", async () => {
    await render(); await navigate("/organizer/events")
    expect(nav.replace).toHaveBeenCalledWith("/organizer/login")
    expect(container.textContent).not.toContain("Zaštićeni sadržaj")
  })

  it("logout and a second login update all mounted consumers", async () => {
    storeOrganizerSession(jwt(), user); await navigate("/organizer/events")
    await click("Odjava"); await navigate("/organizer/login")
    fetchMock.mockResolvedValue(response(200, other))
    await act(async () => storeOrganizerSession(jwt(2), other)); await navigate("/organizer/events")
    expect(container.textContent).toContain(other.email)
    expect(container.textContent).not.toContain(user.email)
  })

  it("delayed validation stays loading and then completes without an intermediate logout", async () => {
    const pending = deferred(); fetchMock.mockReturnValue(pending.promise)
    await render(); await act(async () => storeOrganizerSession(jwt(), user)); await navigate("/organizer/events")
    expect(container.textContent).toContain("Učitavanje")
    expect(nav.replace).not.toHaveBeenCalled()
    await act(async () => pending.resolve(response(200)))
    expect(container.textContent).toContain("Zaštićeni sadržaj")
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it.each([401, 403, "expired", "wrong-role"])("%s invalidates with the appropriate redirect", async kind => {
    storeOrganizerSession(jwt(1, kind === "expired" ? -10 : 3600), user)
    fetchMock.mockResolvedValue(kind === "wrong-role" ? response(200, { ...user, role: "ADMIN" }) : response(Number(kind)))
    await navigate("/organizer/events")
    expect(localStorage.getItem(ORG_TOKEN_KEY)).toBeNull()
    expect(localStorage.getItem(ORG_USER_KEY)).toBeNull()
    expect(container.textContent).not.toContain("Zaštićeni sadržaj")
    expect(nav.replace).toHaveBeenLastCalledWith(kind === "wrong-role" ? "/organizer/login" : "/organizer/login?sesija=istekla")
    if (kind === "expired") expect(fetchMock).not.toHaveBeenCalled()
  })

  it.each([429, 503, "network"])("%s retains the session and recovers on retry", async kind => {
    const token = jwt(); storeOrganizerSession(token, user)
    if (kind === "network") fetchMock.mockRejectedValue(new TypeError("Failed to fetch"))
    else fetchMock.mockResolvedValue(response(Number(kind)))
    await navigate("/organizer/events")
    expect(localStorage.getItem(ORG_TOKEN_KEY)).toBe(token)
    expect(container.textContent).toContain("Provjera prijave trenutno nije uspjela")
    expect(nav.replace).not.toHaveBeenCalled()
    fetchMock.mockResolvedValue(response(200)); await click("Pokušaj ponovno")
    expect(container.textContent).not.toContain("Provjera prijave trenutno nije uspjela")
    expect(container.textContent).toContain("Zaštićeni sadržaj")
  })

  it.each([200, 401])("a stale %s session check cannot overwrite a later login", async status => {
    const old = deferred(); fetchMock.mockReturnValueOnce(old.promise)
    storeOrganizerSession(jwt(), user); await navigate("/organizer/events")
    fetchMock.mockResolvedValue(response(200, other))
    await act(async () => storeOrganizerSession(jwt(2), other))
    await act(async () => old.resolve(response(status)))
    expect(localStorage.getItem(ORG_TOKEN_KEY)).toBe(jwt(2))
    expect(container.textContent).toContain(other.email)
    expect(nav.replace).not.toHaveBeenCalled()
  })

  it("a response after logout cannot restore the signed-out user", async () => {
    const pending = deferred(); fetchMock.mockReturnValue(pending.promise)
    storeOrganizerSession(jwt(), user); await navigate("/organizer/events")
    await act(async () => clearOrganizerSession()); await act(async () => pending.resolve(response(200)))
    expect(localStorage.getItem(ORG_TOKEN_KEY)).toBeNull()
    expect(container.textContent).not.toContain("Zaštićeni sadržaj")
  })

  it("ignores an old result even before the storage notification is processed", async () => {
    const pending = deferred(); fetchMock.mockReturnValue(pending.promise)
    storeOrganizerSession(jwt(), user); await navigate("/organizer/events")
    localStorage.setItem(ORG_TOKEN_KEY, jwt(2)); localStorage.setItem(ORG_USER_KEY, JSON.stringify(other))
    await act(async () => pending.resolve(response(401)))
    expect(localStorage.getItem(ORG_TOKEN_KEY)).toBe(jwt(2))
    expect(nav.replace).not.toHaveBeenCalled()
  })

  it("other-tab login, account change and logout propagate via storage events", async () => {
    await render()
    localStorage.setItem(ORG_TOKEN_KEY, jwt()); localStorage.setItem(ORG_USER_KEY, JSON.stringify(user))
    await act(async () => storageEvent()); await navigate("/organizer/events")
    expect(container.textContent).toContain(user.email)
    fetchMock.mockResolvedValue(response(200, other))
    localStorage.setItem(ORG_TOKEN_KEY, jwt(2)); localStorage.setItem(ORG_USER_KEY, JSON.stringify(other))
    await act(async () => storageEvent())
    expect(container.textContent).toContain(other.email)
    localStorage.clear(); await act(async () => storageEvent(null))
    expect(nav.replace).toHaveBeenCalledWith("/organizer/login")
    expect(container.textContent).not.toContain("Zaštićeni sadržaj")
  })

  it("unrelated storage events do not cause new checks", async () => {
    storeOrganizerSession(jwt(), user); await navigate("/organizer/events")
    await act(async () => { storageEvent("unrelated"); storageEvent(ORG_TOKEN_KEY, sessionStorage) })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("a stale organizer API 401 cannot clear the next session", async () => {
    const pending = deferred(); fetchMock.mockReturnValueOnce(pending.promise)
    storeOrganizerSession(jwt(), user)
    const request = orgFetch("/api/organizer/events")
    storeOrganizerSession(jwt(2), other); pending.resolve(response(401)); await request
    expect(localStorage.getItem(ORG_TOKEN_KEY)).toBe(jwt(2))
    expect(JSON.parse(localStorage.getItem(ORG_USER_KEY)!)).toEqual(other)
  })

  it.each([403, 429, 503, "network"])("organizer API %s never ends a valid session", async kind => {
    const token = jwt(); storeOrganizerSession(token, user)
    if (kind === "network") fetchMock.mockRejectedValue(new TypeError("network"))
    else fetchMock.mockResolvedValue(response(Number(kind)))
    await orgFetch("/api/organizer/events").catch(() => {})
    expect(localStorage.getItem(ORG_TOKEN_KEY)).toBe(token)
  })
})
