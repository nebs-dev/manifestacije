"use client"

import { useCallback, useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react"
import { usePathname, useRouter } from "next/navigation"

import { getToken, clearToken } from "@/lib/admin/api"
import { checkSession, resetSessionCheckCache, SESSION_UNAVAILABLE_MESSAGE } from "@/lib/session-check"
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
  // Mobile navigation drawer (below md the sidebar is hidden).
  const [menuOpen, setMenuOpen] = useState(false)
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const drawerRef = useRef<HTMLDivElement>(null)
  const closeMenu = useCallback(() => {
    setMenuOpen(false)
    menuButtonRef.current?.focus()
  }, [])
  useEffect(() => { setMenuOpen(false) }, [pathname])
  useEffect(() => {
    if (menuOpen) drawerRef.current?.querySelector<HTMLElement>('[aria-label="Zatvori izbornik"]')?.focus()
  }, [menuOpen])
  function onDrawerKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") { event.preventDefault(); closeMenu(); return }
    if (event.key !== "Tab") return
    // Keep keyboard focus inside the open drawer.
    const focusable = [...(drawerRef.current?.querySelectorAll<HTMLElement>("aside a, aside button") ?? [])]
    if (!focusable.length) return
    const first = focusable[0], last = focusable[focusable.length - 1]
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
  }
  const [checking, setChecking] = useState(true)
  const [unavailable, setUnavailable] = useState(false)
  const [attempt, setAttempt] = useState(0)

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
      const result = await checkSession(getToken())
      if (!alive) return
      const signOut = () => {
        clearToken()
        resetSessionCheckCache()
        setCachedUser(null)
        router.replace("/admin/login")
      }
      if (result.kind === "invalid") return signOut()
      if (result.kind === "unavailable") {
        // 429 / server error / network failure: the token may be perfectly
        // valid, so keep it (and the cached user, if any) and offer a retry.
        setUnavailable(true)
        setChecking(false)
        return
      }
      if (result.user.role !== "ADMIN") return signOut()
      const data = result.user as AdminUser
      setUnavailable(false)
      setUser(data)
      setCachedUser(data)
      setChecking(false)
    }

    checkAuth()
    return () => { alive = false }
  }, [isLogin, router, attempt])

  const retry = () => {
    resetSessionCheckCache()
    setChecking(true)
    setAttempt((value) => value + 1)
  }

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

  if (!user) {
    if (!unavailable) return null
    return (
      <div className="flex h-screen items-center justify-center bg-background px-4">
        <div role="status" className="flex max-w-sm flex-col items-center gap-3 text-center text-sm text-muted-foreground">
          <p>{SESSION_UNAVAILABLE_MESSAGE}</p>
          <button type="button" onClick={retry} className="rounded-md border border-border px-3 py-1.5 text-foreground hover:bg-muted">
            Pokušaj ponovno
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background text-foreground">
      <AdminSidebar className="hidden md:flex" />
      {menuOpen && (
        <div ref={drawerRef} className="fixed inset-0 z-50 flex md:hidden" role="dialog" aria-modal="true" aria-label="Administracijski izbornik" onKeyDown={onDrawerKeyDown}>
          <button type="button" tabIndex={-1} aria-hidden className="absolute inset-0 bg-black/40" onClick={closeMenu} />
          <AdminSidebar id="admin-mobile-nav" className="relative max-w-[85vw] shadow-xl" onNavigate={closeMenu} onClose={closeMenu} />
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <AdminTopbar user={user} menuOpen={menuOpen} onOpenMenu={() => setMenuOpen(true)} menuButtonRef={menuButtonRef} />
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[1600px] px-4 py-6 md:px-6 md:py-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
