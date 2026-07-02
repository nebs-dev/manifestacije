"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { API_URL } from "@/lib/api"
import { clearOrganizerSession, ORG_TOKEN_KEY, ORG_USER_KEY } from "@/lib/organizer/auth"

export type OrganizerUser = {
  id: number
  email: string
  role: string
  organizerId: number | null
}

export function useOrganizerAuth(options?: { require?: boolean }) {
  const require = options?.require ?? true
  const router = useRouter()
  const [user, setUser] = useState<OrganizerUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem(ORG_TOKEN_KEY)
    if (!token) {
      setLoading(false)
      if (require) router.replace("/organizer/login")
      return
    }
    fetch(`${API_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (r) => {
        if (!r.ok) {
          clearOrganizerSession()
          if (require) router.replace("/organizer/login")
          return
        }
        const data = await r.json()
        if (data?.role !== "ORGANIZER" || !data?.organizerId) {
          clearOrganizerSession()
          if (require) router.replace("/organizer/login")
          return
        }
        localStorage.setItem(ORG_USER_KEY, JSON.stringify(data))
        setUser(data)
      })
      .catch(() => {
        if (require) router.replace("/organizer/login")
      })
      .finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function logout() {
    clearOrganizerSession()
    router.push("/organizer/login")
  }

  return { user, loading, logout }
}
