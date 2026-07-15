"use client"

import { useEffect, useState, type ReactNode } from "react"
import { usePathname, useRouter } from "next/navigation"

import { authedFetch, getToken, clearToken } from "@/lib/admin/api"
import { AdminSidebar } from "@/components/admin/admin-sidebar"
import { AdminTopbar } from "@/components/admin/admin-topbar"

export type AdminUser = { id: number; email: string; name: string; role: string }

const USER_CACHE_KEY = "adminUser"

function getCachedUser(): AdminUser | null {
  try { return JSON.parse(sessionStorage.getItem(USER_CACHE_KEY) || "null") }
  catch { return null }
}

function setCachedUser(user: AdminUser | null) {
  if (user) sessionStorage.setItem(USER_CACHE_KEY, JSON.stringify(user))
  else sessionStorage.removeItem(USER_CACHE_KEY)
}

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [user, setUser] = useState<AdminUser | null>(null)
  const [checking, setChecking] = useState(true)

  const isLogin = pathname === "/admin/login"

  useEffect(() => {
    if (isLogin) {
      setChecking(false)
      return
    }

    // Show cached user immediately to avoid flash on hot reload / server restart
    const cached = getCachedUser()
    if (cached) {
      setUser(cached)
      setChecking(false)
    }

    let alive = true

    async function checkAuth() {
      const token = getToken()
      if (!token) {
        setCachedUser(null)
        router.replace("/admin/login")
        return
      }
      try {
        const res = await authedFetch("/api/auth/me")
        if (!alive) return
        if (res.status === 401 || res.status === 403) {
          clearToken()
          setCachedUser(null)
          router.replace("/admin/login")
          return
        }
        if (!res.ok) {
          // Server error or restarting — keep cached user, don't logout
          if (alive) setChecking(false)
          return
        }
        const data = (await res.json()) as AdminUser
        if (data.role !== "ADMIN") {
          clearToken()
          setCachedUser(null)
          router.replace("/admin/login")
          return
        }
        if (alive) {
          setUser(data)
          setCachedUser(data)
        }
      } catch {
        // Network error (API server restarting) — keep cached user if we have one
        if (alive && !cached) {
          clearToken()
          setCachedUser(null)
          router.replace("/admin/login")
        }
      } finally {
        if (alive) setChecking(false)
      }
    }

    checkAuth()
    return () => { alive = false }
  }, [isLogin, router])

  if (isLogin) {
    return <>{children}</>
  }

  if (checking) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <div className="size-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
          <span className="text-sm">Provjera pristupa…</span>
        </div>
      </div>
    )
  }

  if (!user) return null

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background text-foreground">
      <AdminSidebar className="hidden md:flex" />
      <div className="flex min-w-0 flex-1 flex-col">
        <AdminTopbar user={user} />
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[1600px] px-4 py-6 md:px-6 md:py-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
