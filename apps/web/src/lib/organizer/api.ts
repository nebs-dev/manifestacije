import { API_URL } from "@/lib/api"
import { clearOrganizerSession, ORG_TOKEN_KEY } from "@/lib/organizer/auth"
import { resetSessionCheckCache } from "@/lib/session-check"

/** Authenticated organizer API call. A 401 means the token is no longer
 *  valid (expired, revoked, wrong role): the session is cleared and the user
 *  sent to log in again. Any other status — including 429 and 5xx — is
 *  returned to the caller and never ends the session (AUTH-01). */
export async function orgFetch(path: string, init?: RequestInit): Promise<Response> {
  const token = typeof window !== "undefined" ? localStorage.getItem(ORG_TOKEN_KEY) : null
  const isFormData = init?.body instanceof FormData
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      ...(!isFormData ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers as Record<string, string> | undefined),
    },
  })
  if (res.status === 401 && token && typeof window !== "undefined") {
    clearOrganizerSession()
    resetSessionCheckCache()
    window.location.assign("/organizer/login?sesija=istekla")
  }
  return res
}

export type City = { id: number; name: string; county: { name: string; region: { name: string } } }
export type Category = { id: number; name: string; slug: string }
export type OrgEvent = {
  id: number
  title: string
  status: string
  startsAt: string
  city: { name: string } | null
  category: { name: string } | null
  revisions?: Array<{ id: number; version: number; submittedAt: string }>
}

export type OrgSource = {
  id: number
  sourceUrl: string | null
  rawText: string | null
  status: string
  confidence: number | null
  createdAt: string
  parsedJson: {
    candidates?: { title?: string }[]
  } | null
}
