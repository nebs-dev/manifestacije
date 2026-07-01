"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useOrganizerAuth } from "@/hooks/use-organizer-auth"
import { Button } from "@/components/ui/button"
import { CalendarPlus, List, LogOut, Link2 } from "lucide-react"

const PUBLIC_PATHS = ["/organizer/login", "/organizer/register"]

export default function OrganizerLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isPublic = PUBLIC_PATHS.includes(pathname)
  const { user, loading, logout } = useOrganizerAuth({ require: !isPublic })

  if (!isPublic && loading) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Učitavanje…</div>
  }

  if (isPublic) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        {children}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-4 py-3">
          <Link href="/organizer/events" className="font-heading text-base font-semibold">
            Organizer portal
          </Link>
          <nav className="flex items-center gap-1">
            <Link href="/organizer/events">
              <Button variant="ghost" size="sm" className="gap-1.5">
                <List className="size-4" />Moji eventi
              </Button>
            </Link>
            <Link href="/organizer/events/new">
              <Button variant="ghost" size="sm" className="gap-1.5">
                <CalendarPlus className="size-4" />Dodaj event
              </Button>
            </Link>
            <Link href="/organizer/submit-link">
              <Button variant="ghost" size="sm" className="gap-1.5">
                <Link2 className="size-4" />Pošalji link
              </Button>
            </Link>
          </nav>
          <div className="flex items-center gap-3">
            {user && <span className="hidden text-xs text-muted-foreground sm:block">{user.email}</span>}
            <Button variant="ghost" size="sm" onClick={logout} className="gap-1.5">
              <LogOut className="size-4" />Odjava
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-8">
        {children}
      </main>
    </div>
  )
}
