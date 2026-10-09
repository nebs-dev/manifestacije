// @vitest-environment jsdom
import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { ForgotPasswordForm } from "./forgot-password-form"
import { ResetPasswordForm } from "./reset-password-form"
import { RegisterForm } from "../organizer/register-form"
import LoginPage from "../../../app/organizer/login/page"
import AdminLoginPage from "../../../app/admin/login/page"
import EmailDeliveriesPage from "../../../app/admin/email-deliveries/page"
import { PublicAnalytics } from "./public-analytics"

const fetchMock = vi.hoisted(() => vi.fn())
const adminFetch = vi.hoisted(() => vi.fn())
const nav = vi.hoisted(() => ({ push: vi.fn(), path: "/reset-password" }))
vi.mock("next/navigation", () => ({ useRouter: () => nav, usePathname: () => nav.path }))
vi.mock("next/link", () => ({ default: ({ children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props}>{children}</a> }))
vi.mock("@/lib/admin/api", () => ({ authedFetch: adminFetch, clearToken: vi.fn() }))
vi.mock("@next/third-parties/google", () => ({ GoogleAnalytics: () => <div data-analytics /> }))

let container: HTMLDivElement, root: Root
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true)
  vi.stubGlobal("fetch", fetchMock); fetchMock.mockReset(); adminFetch.mockReset()
  window.history.replaceState(null, "", "/reset-password")
  nav.path = "/reset-password"
  container = document.createElement("div"); document.body.append(container); root = createRoot(container)
})
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals() })
const render = async (node: React.ReactNode) => { await act(async () => root.render(node)) }
const submit = async () => { await act(async () => container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }))) }
const input = async (selector: string, value: string) => {
  const field = container.querySelector(selector) as HTMLInputElement
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(field, value)
    field.dispatchEvent(new Event("input", { bubbles: true }))
  })
}
const help = () => expect(container.querySelector('a[href="mailto:info@manifestacije.hr"]')).not.toBeNull()

it.each([<ForgotPasswordForm key="forgot" />, <ResetPasswordForm key="reset" />, <RegisterForm key="register" />, <LoginPage key="login" />, <AdminLoginPage key="admin" />])("provides Croatian contact help on each auth screen", async node => { await render(node); help() })

it("keeps reset-request confirmation generic and offers missing-email help", async () => {
  fetchMock.mockResolvedValue({ ok: true }); await render(<ForgotPasswordForm />)
  await input("#email", "synthetic@example.test"); await submit()
  expect(container.querySelector('[role="status"]')?.textContent).toContain("Ako račun s tom adresom postoji")
  expect(container.textContent).toContain("neželjenu poštu"); help()
})
it.each([503, 429])("shows a temporary reset-request failure without account details (%s)", async status => {
  fetchMock.mockResolvedValue({ ok: false, status }); await render(<ForgotPasswordForm />); await submit()
  expect(container.querySelector('[role="alert"]')?.textContent).toContain("privremeno nedostupna"); help()
})
it.each(["#token=synthetic-reset-secret", "?token=legacy-reset-secret"])("supports reset links and removes the secret from history (%s)", async suffix => {
  window.history.replaceState(null, "", `/reset-password${suffix}`)
  fetchMock.mockResolvedValue({ ok: true }); await render(<ResetPasswordForm />)
  expect(window.location.search + window.location.hash).toBe("")
  await input("#password", "Synthetic-password-42!"); await input("#confirmPassword", "Synthetic-password-42!"); await submit()
  expect(JSON.parse(fetchMock.mock.calls[0][1].body).token).toBe(suffix.split("=")[1])
  expect(container.querySelector('[role="status"]')?.textContent).toContain("uspješno promijenjena"); help()
})
it("offers a new link when the reset link is missing", async () => {
  await render(<ResetPasswordForm />)
  expect(container.querySelector('[role="alert"]')?.textContent).toContain("istekla")
  expect(container.querySelector('a[href="/forgot-password"]')).not.toBeNull()
  expect(fetchMock).not.toHaveBeenCalled()
})
it.each([400, 503])("shows useful errors for rejected or temporarily unavailable reset (%s)", async status => {
  window.history.replaceState(null, "", "/reset-password#token=synthetic-reset-secret")
  fetchMock.mockResolvedValue({ ok: false, status }); await render(<ResetPasswordForm />)
  await input("#password", "Synthetic-password-42!"); await input("#confirmPassword", "Synthetic-password-42!"); await submit()
  expect(container.querySelector('[role="alert"]')?.textContent).toContain(status === 400 ? "istekla" : "trenutačno nije moguće"); help()
})
it("localizes registration errors without displaying provider/internal messages", async () => {
  fetchMock.mockResolvedValue({ ok: false, status: 400, json: async () => ({ message: "SECRET INTERNAL ERROR" }) })
  await render(<RegisterForm />); await input('[name="password"]', "Synthetic-password-42!"); await submit()
  expect(container.textContent).toContain("Ako već imate račun")
  expect(container.textContent).not.toContain("SECRET")
  expect(container.querySelector('a[href="/forgot-password"]')).not.toBeNull()
})
it("shows transport status distinctions and no secrets in the admin delivery view", async () => {
  adminFetch.mockResolvedValue({ ok: true, json: async () => ({ items: ["accepted", "delivered", "submission_unknown", "bounced", "suppressed", "logged"].map((status, index) => ({ id: `attempt-${index}`, messageId: `message-${index}`, template: "password_reset", userId: 42, provider: "resend", status, createdAt: "2026-10-09T12:00:00Z" })) }) })
  await render(<EmailDeliveriesPage />)
  expect(container.textContent).toContain("Resend prihvatio zahtjev")
  expect(container.textContent).toContain("Poslužitelj primatelja prihvatio poruku")
  expect(container.textContent).toContain("Ishod slanja nije poznat")
  expect(container.textContent).toContain("Resend blokirao dostavu")
  expect(container.querySelectorAll("li")).toHaveLength(6)
  expect(adminFetch).toHaveBeenCalledTimes(1)
})
it("handles loading, empty and failure states in the admin delivery view", async () => {
  adminFetch.mockReturnValue(new Promise(() => {})); await render(<EmailDeliveriesPage />)
  expect(container.querySelector('[role="status"]')?.textContent).toContain("Učitavanje")
  await act(async () => root.unmount()); root = createRoot(container)
  adminFetch.mockResolvedValue({ ok: true, json: async () => ({ items: [] }) }); await render(<EmailDeliveriesPage />)
  expect(container.textContent).toContain("Nema zapisa")
  adminFetch.mockRejectedValue(new Error("network")); await act(async () => [...container.querySelectorAll("button")].find(x => x.textContent === "Osvježi")!.click())
  expect(container.querySelector('[role="alert"]')?.textContent).toContain("nije moguće učitati")
})
it.each(["/reset-password", "/forgot-password", "/organizer/register", "/admin/login", "/preuzmi-profil", "/organizatori/test/preuzmi"])("does not mount analytics on %s", async path => {
  nav.path = path; await render(<PublicAnalytics gaId="G-SYNTHETIC" />)
  expect(container.querySelector("[data-analytics]")).toBeNull()
})
it("retains analytics on public discovery pages", async () => {
  nav.path = "/eventi"; await render(<PublicAnalytics gaId="G-SYNTHETIC" />)
  expect(container.querySelector("[data-analytics]")).not.toBeNull()
})
