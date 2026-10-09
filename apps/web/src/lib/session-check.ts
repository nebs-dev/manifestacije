import { API_URL } from "@/lib/api"

export type SessionUser = { id: number; email: string; name?: string; role: string; organizerId: number | null }

/**
 * Outcome of validating a stored token against GET /api/auth/me.
 *
 * Only "invalid" (missing/expired/revoked token, HTTP 401/403) may end a
 * session. Rate limiting (429), server errors and network failures say
 * nothing about the token, so they are "unavailable" and the caller must keep
 * the session — previously any non-2xx logged organizers out (AUTH-01).
 */
export type SessionCheck =
  | { kind: "valid"; user: SessionUser }
  | { kind: "invalid"; reason: "missing" | "expired" | "rejected" }
  | { kind: "unavailable"; reason: "rate-limited" | "server" | "network" }

/** Reads the JWT `exp` claim without verifying it (the API verifies). */
export function tokenExpiresAt(token: string): number | null {
  try {
    const payload = token.split(".")[1]
    if (!payload) return null
    const json = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(payload.length / 4) * 4, "=")))
    return typeof json.exp === "number" ? json.exp * 1000 : null
  } catch {
    return null
  }
}

export function isTokenExpired(token: string, now = Date.now()) {
  const exp = tokenExpiresAt(token)
  return exp !== null && exp <= now
}

export function classifySessionStatus(status: number): SessionCheck["kind"] | "unavailable-rate-limited" | "unavailable-server" {
  if (status >= 200 && status < 300) return "valid"
  if (status === 401 || status === 403) return "invalid"
  if (status === 429) return "unavailable-rate-limited"
  return "unavailable-server"
}

async function requestSession(token: string, fetchImpl: typeof fetch): Promise<SessionCheck> {
  let res: Response
  try {
    res = await fetchImpl(`${API_URL}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
  } catch {
    return { kind: "unavailable", reason: "network" }
  }
  const kind = classifySessionStatus(res.status)
  if (kind === "invalid") return { kind: "invalid", reason: "rejected" }
  if (kind === "unavailable-rate-limited") return { kind: "unavailable", reason: "rate-limited" }
  if (kind === "unavailable-server") return { kind: "unavailable", reason: "server" }
  try {
    return { kind: "valid", user: (await res.json()) as SessionUser }
  } catch {
    return { kind: "unavailable", reason: "server" }
  }
}

// The organizer shell and each page both check the session on mount. Share
// one in-flight/recent request per token so a page load costs one call and
// quick navigation does not re-check at all.
const REUSE_MS = 30_000
let recent: { token: string; at: number; promise: Promise<SessionCheck> } | null = null

export function checkSession(token: string | null, options: { fetchImpl?: typeof fetch; now?: number } = {}): Promise<SessionCheck> {
  const now = options.now ?? Date.now()
  if (!token) return Promise.resolve({ kind: "invalid", reason: "missing" })
  if (isTokenExpired(token, now)) return Promise.resolve({ kind: "invalid", reason: "expired" })
  if (recent && recent.token === token && now - recent.at < REUSE_MS) return recent.promise
  const promise = requestSession(token, options.fetchImpl ?? fetch)
  const entry = { token, at: now, promise }
  recent = entry
  // Only a definitive answer is worth reusing; retry soon after a failure.
  promise.then((result) => { if (result.kind !== "valid" && recent === entry) recent = null })
  return promise
}

export function resetSessionCheckCache() {
  recent = null
}

export const SESSION_UNAVAILABLE_MESSAGE = "Provjera prijave trenutno nije uspjela. Ostajete prijavljeni — pokušajte ponovno za nekoliko trenutaka."
export const SESSION_EXPIRED_MESSAGE = "Sesija je istekla ili više nije valjana. Prijavite se ponovno."

/** Croatian message for a failed POST /api/auth/login. */
export function loginErrorMessage(status: number, body: { message?: unknown } | null): string {
  if (status === 429) return "Previše pokušaja prijave. Pričekajte minutu pa pokušajte ponovno."
  if (status === 401) return "Pogrešan email ili lozinka."
  if (status === 400) return "Unesite ispravan email i lozinku."
  if (status >= 500) return "Prijava trenutno nije moguća. Pokušajte ponovno za nekoliko trenutaka."
  const message = typeof body?.message === "string" ? body.message : ""
  return message || "Prijava nije uspjela. Pokušajte ponovno."
}
