"use client"

import { Search, Bell } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"

export function AdminTopbar() {
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
        <div className="flex items-center gap-2 rounded-md border border-border bg-card px-2 py-1">
          <div className="flex size-6 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
            A
          </div>
          <span className="hidden text-sm font-medium sm:inline">Admin</span>
        </div>
      </div>
    </header>
  )
}
