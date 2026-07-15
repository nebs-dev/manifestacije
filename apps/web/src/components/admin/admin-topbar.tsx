"use client"

import { useEffect, useState } from "react"
import { LogOut, Search, Bell } from "lucide-react"
import { useRouter } from "next/navigation"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import { clearToken, authedFetch } from "@/lib/admin/api"
import type { AdminUser } from "@/components/admin/admin-shell"

type PendingCounts = { sources: number; events: number }

export function AdminTopbar({ user }: { user?: AdminUser | null }) {
  const router = useRouter()
  const [counts, setCounts] = useState<PendingCounts | null>(null)

  useEffect(() => {
    const sourcesSince = localStorage.getItem("adminLastSeenSourcesAt")
    const eventsSince = localStorage.getItem("adminLastSeenEventsAt")
    if (!sourcesSince && !eventsSince) {
      authedFetch("/api/admin/pending-counts")
        .then((r) => r.ok ? r.json() : null)
        .then((d) => d && setCounts(d))
        .catch(() => {})
      return
    }
    const params = new URLSearchParams()
    if (sourcesSince) params.set("sourcesSince", sourcesSince)
    if (eventsSince) params.set("eventsSince", eventsSince)
    authedFetch(`/api/admin/pending-counts?${params}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => d && setCounts(d))
      .catch(() => {})
  }, [])

  function logout() {
    clearToken()
    router.push("/admin/login")
  }

  const initial = user?.name?.[0]?.toUpperCase() ?? user?.email?.[0]?.toUpperCase() ?? "A"
  const displayName = user?.name || user?.email || "Admin"
  const totalPending = (counts?.sources ?? 0) + (counts?.events ?? 0)

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-background/95 px-4 backdrop-blur md:px-6">
      <div className="hidden max-w-sm flex-1 md:block">
        <InputGroup>
          <InputGroupAddon>
            <Search />
          </InputGroupAddon>
          <InputGroupInput
            type="search"
            placeholder="Pretraži događaje, izvore, organizatore…"
            aria-label="Pretraga"
          />
        </InputGroup>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <Link
          href="/admin/sources"
          onClick={() => {
            const now = new Date().toISOString()
            localStorage.setItem("adminLastSeenSourcesAt", now)
            localStorage.setItem("adminLastSeenEventsAt", now)
            setCounts({ sources: 0, events: 0 })
          }}
        >
          <Button variant="ghost" size="icon" aria-label="Obavijesti" className="relative">
            <Bell className="size-4" />
            {totalPending > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
                {totalPending > 99 ? "99+" : totalPending}
              </span>
            )}
          </Button>
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
