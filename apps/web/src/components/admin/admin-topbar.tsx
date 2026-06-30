"use client"

import { LogOut, Search, Bell } from "lucide-react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import { clearToken } from "@/lib/admin/api"
import type { AdminUser } from "@/components/admin/admin-shell"

export function AdminTopbar({ user }: { user?: AdminUser | null }) {
  const router = useRouter()

  function logout() {
    clearToken()
    router.push("/admin/login")
  }

  const initial = user?.name?.[0]?.toUpperCase() ?? user?.email?.[0]?.toUpperCase() ?? "A"
  const displayName = user?.name || user?.email || "Admin"

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
        <Button variant="ghost" size="icon" aria-label="Obavijesti">
          <Bell />
        </Button>

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
