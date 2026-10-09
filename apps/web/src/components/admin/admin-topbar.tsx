"use client"

import { useEffect, useState } from "react"
import { LogOut, Bell } from "lucide-react"
import { useRouter } from "next/navigation"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import { clearToken, authedFetch } from "@/lib/admin/api"
import type { AdminUser } from "@/components/admin/admin-shell"

type PendingCounts = { sources: number; events: number; organizers: number; revisions?: number; unread?: number; pending?: number }

export function AdminTopbar({ user }: { user?: AdminUser | null }) {
  const router = useRouter()
  const [counts, setCounts] = useState<PendingCounts | null>(null)

  useEffect(() => {
    let active = true
    let inFlight = false, queued = false
    function refresh() {
      if (!active || document.visibilityState === "hidden") return
      if (inFlight) { queued = true; return }
      inFlight = true
      authedFetch("/api/admin/pending-counts", { signal: AbortSignal.timeout(15000) })
        .then((r) => r.ok ? r.json() : null)
        .then((d) => { if (active && d) setCounts(d) })
        .catch(() => {}).finally(() => { inFlight = false; if (queued) { queued = false; refresh() } })
    }
    refresh()
    const interval = window.setInterval(refresh, 60000)
    window.addEventListener("event-revisions-changed", refresh)
    window.addEventListener("admin-notifications-changed", refresh)
    window.addEventListener("focus", refresh)
    return () => { active = false; window.clearInterval(interval); window.removeEventListener("event-revisions-changed", refresh); window.removeEventListener("admin-notifications-changed", refresh); window.removeEventListener("focus", refresh) }
  }, [])

  function logout() {
    clearToken()
    router.push("/admin/login")
  }

  const initial = user?.name?.[0]?.toUpperCase() ?? user?.email?.[0]?.toUpperCase() ?? "A"
  const displayName = user?.name || user?.email || "Admin"
  const totalPending = counts?.unread ?? ((counts?.sources ?? 0) + (counts?.events ?? 0) + (counts?.organizers ?? 0) + (counts?.revisions ?? 0))

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-background/95 px-4 backdrop-blur md:px-6">
      <div className="ml-auto flex items-center gap-2">
        <Link href="/admin/notifications" aria-label="Obavijesti" title={counts ? `${totalPending} nepročitano · ${counts.pending ?? counts.revisions ?? 0} čeka pregled` : "Obavijesti"}>
          <span aria-label="Obavijesti" className="relative inline-flex size-9 items-center justify-center rounded-md hover:bg-muted">
            <Bell className="size-4" />
            {totalPending > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
                {totalPending > 99 ? "99+" : totalPending}
              </span>
            )}
          </span>
        </Link>

        {user && (
          <div className="flex items-center gap-2 rounded-md border border-border bg-card px-2 py-1">
            <div className="flex size-6 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
              {initial}
            </div>
            <span className="hidden text-sm font-medium sm:inline">{displayName}</span>
          </div>
        )}

        <Button variant="ghost" size="icon" aria-label="Odjava" onClick={logout}>
          <LogOut className="size-4" />
        </Button>
      </div>
    </header>
  )
}
