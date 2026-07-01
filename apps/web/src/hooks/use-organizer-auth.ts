"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { API_URL } from "@/lib/api"

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
    const token = localStorage.getItem("orgToken")
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
          localStorage.removeItem("orgToken")
          if (require) router.replace("/organizer/login")
          return
        }
        setUser(await r.json())
      })
      .catch(() => {
        if (require) router.replace("/organizer/login")
      })
      .finally(() => setLoading(false))
  }, [])

  function logout() {
    localStorage.removeItem("orgToken")
    router.push("/organizer/login")
  }

  return { user, loading, logout }
}
