import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

class MemoryStorage {
  private values = new Map<string, string>()
  getItem(key: string) { return this.values.get(key) ?? null }
  setItem(key: string, value: string) { this.values.set(key, value) }
  removeItem(key: string) { this.values.delete(key) }
  clear() { this.values.clear() }
}

describe("admin API helper", () => {
  let storage: MemoryStorage
  let locationState: { href: string }

  beforeEach(() => {
    vi.resetModules()
    storage = new MemoryStorage()
    locationState = { href: "" }
    vi.stubGlobal("localStorage", storage)
    vi.stubGlobal("window", { location: locationState })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it("sends JSON content-type and bearer token for normal requests", async () => {
    storage.setItem("adminToken", "jwt-token")
    const fetchMock = vi.fn().mockResolvedValue({ status: 200 })
    vi.stubGlobal("fetch", fetchMock)
    const { authedFetch } = await import("./api")

    await authedFetch("/api/admin/events", { method: "POST", body: JSON.stringify({ title: "Event" }) })

    expect(fetchMock).toHaveBeenCalledWith("http://localhost:3001/api/admin/events", expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({
        "Content-Type": "application/json",
        Authorization: "Bearer jwt-token",
      }),
    }))
  })

  it("does not force JSON content-type for FormData uploads", async () => {
    storage.setItem("adminToken", "jwt-token")
    const fetchMock = vi.fn().mockResolvedValue({ status: 200 })
    vi.stubGlobal("fetch", fetchMock)
    const { authedFetch } = await import("./api")

    await authedFetch("/api/admin/uploads/event-image", { method: "POST", body: new FormData() })

    const headers = fetchMock.mock.calls[0][1].headers
    expect(headers.Authorization).toBe("Bearer jwt-token")
    expect(headers["Content-Type"]).toBeUndefined()
  })

  it("clears tokens and redirects on 401 or 403", async () => {
    storage.setItem("adminToken", "jwt-token")
    storage.setItem("token", "legacy-token")
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ status: 403 }))
    const { authedFetch } = await import("./api")

    await authedFetch("/api/admin/events")

    expect(storage.getItem("adminToken")).toBeNull()
    expect(storage.getItem("token")).toBeNull()
    expect(locationState.href).toBe("/admin/login")
  })
})
