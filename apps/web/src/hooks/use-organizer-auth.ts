"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { clearOrganizerSession, ORG_TOKEN_KEY, ORG_USER_KEY } from "@/lib/organizer/auth"
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
 * Validates the organizer session on mount. The session is cleared only when
 * the API says the token is invalid (401/403), the token has expired, or it
 * belongs to a non-organizer account. A 429, server error or network failure
 * keeps the session and reports status "unavailable" (AUTH-01).
 */
export function useOrganizerAuth(options?: { require?: boolean }) {
  const require = options?.require ?? true
  const router = useRouter()
  const [user, setUser] = useState<OrganizerUser | null>(null)
  const [status, setStatus] = useState<OrganizerAuthStatus>("checking")
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let alive = true
    const token = localStorage.getItem(ORG_TOKEN_KEY)
    const signOut = (expired: boolean) => {
      clearOrganizerSession()
      resetSessionCheckCache()
      setUser(null)
      setStatus("signed-out")
      if (require) router.replace(expired ? ORGANIZER_LOGIN_EXPIRED : "/organizer/login")
    }
    checkSession(token).then((result) => {
      if (!alive) return
      if (result.kind === "invalid") return signOut(result.reason !== "missing")
      if (result.kind === "unavailable") {
        setUser(cachedUser())
        setStatus("unavailable")
        return
      }
      if (result.user.role !== "ORGANIZER" || !result.user.organizerId) return signOut(false)
      localStorage.setItem(ORG_USER_KEY, JSON.stringify(result.user))
      setUser(result.user)
      setStatus("authenticated")
    })
    return () => { alive = false }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt])

  const retry = useCallback(() => {
    resetSessionCheckCache()
    setStatus("checking")
    setAttempt((value) => value + 1)
  }, [])

  function logout() {
    clearOrganizerSession()
    resetSessionCheckCache()
    router.push("/organizer/login")
  }

  return { user, status, loading: status === "checking", retry, logout }
}
