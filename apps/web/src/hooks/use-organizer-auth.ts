"use client"

import { useCallback, useEffect, useState, useSyncExternalStore } from "react"
import { useRouter } from "next/navigation"
import { clearOrganizerSession, getOrganizerToken, subscribeOrganizerSession, ORG_USER_KEY } from "@/lib/organizer/auth"
import { checkSession, resetSessionCheckCache } from "@/lib/session-check"

export type OrganizerUser = {
  id: number
  email: string
  role: string
  organizerId: number | null
}

export type OrganizerAuthStatus = "checking" | "authenticated" | "unavailable" | "signed-out"

export const ORGANIZER_LOGIN_EXPIRED = "/organizer/login?sesija=istekla"

function cachedUser(): OrganizerUser | null {
  try {
    const user = JSON.parse(localStorage.getItem(ORG_USER_KEY) || "null") as OrganizerUser | null
    return user?.role === "ORGANIZER" && user.organizerId ? user : null
  } catch {
    return null
  }
}

/**
 * Validates on mount, session changes and entry to protected routes. The
 * persistent Next.js layout must observe login without needing a remount.
 * The session is cleared only when
 * the API says the token is invalid (401/403), the token has expired, or it
 * belongs to a non-organizer account. A 429, server error or network failure
 * keeps the session and reports status "unavailable" (AUTH-01).
 */
export function useOrganizerAuth(options?: { require?: boolean }) {
  const require = options?.require ?? true
  const router = useRouter()
  const token = useSyncExternalStore(subscribeOrganizerSession, getOrganizerToken, () => null)
  const [session, setSession] = useState<{
    token: string | null; user: OrganizerUser | null; status: OrganizerAuthStatus; expired?: boolean
  }>({ token: null, user: null, status: "checking" })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let alive = true
    if (!token) {
      // Retain the invalid-session notice after clearing an expired token.
      setSession((previous) => previous.token === null && previous.status === "signed-out"
        ? previous : { token: null, user: null, status: "signed-out" })
      return
    }
    setSession({ token, user: null, status: "checking" })
    const signOut = (expired: boolean) => {
      clearOrganizerSession()
      setSession({ token: null, user: null, status: "signed-out", expired })
    }
    checkSession(token).then((result) => {
      // An older request must never overwrite or clear a later login/logout,
      // including a storage change before React has run effect cleanup.
      if (!alive || getOrganizerToken() !== token) return
      if (result.kind === "invalid") return signOut(result.reason !== "missing")
      if (result.kind === "unavailable") {
        setSession({ token, user: cachedUser(), status: "unavailable" })
        return
      }
      if (result.user.role !== "ORGANIZER" || !result.user.organizerId) return signOut(false)
      localStorage.setItem(ORG_USER_KEY, JSON.stringify(result.user))
      setSession({ token, user: result.user, status: "authenticated" })
    })
    return () => { alive = false }
  }, [token, require, attempt])

  useEffect(() => {
    if (require && session.token === token && session.status === "signed-out") {
      router.replace(session.expired ? ORGANIZER_LOGIN_EXPIRED : "/organizer/login")
    }
  }, [require, router, session, token])

  const retry = useCallback(() => {
    resetSessionCheckCache()
    setAttempt((value) => value + 1)
  }, [])

  function logout() {
    clearOrganizerSession()
    router.push("/organizer/login")
  }

  const status = session.token === token ? session.status : "checking"
  return { user: session.token === token ? session.user : null, status, loading: status === "checking", retry, logout }
}
