"use client"

import { useEffect, useId, useRef, useState } from "react"
import { Input } from "@/components/ui/input"
import { authedFetch } from "@/lib/admin/api"
import { cn } from "@/lib/utils"

/** One row of `GET /api/admin/venues/search`. `lat`/`lng` are null for venues
 *  that were only ever given an address — still worth reusing. */
export type VenueSuggestion = {
  id: number
  name: string
  address: string | null
  cityName: string
  cityId: number
  lat: number | null
  lng: number | null
  label: string
}

/** The shortest query worth a round trip; "o" matches half the database. */
const MIN_QUERY = 2
const DEBOUNCE_MS = 300

/**
 * Venue memory in the one place an admin actually types the venue (VEN-01).
 * Typing stays free — a new venue is just typed out — but a venue entered
 * once before is offered with the address and city it was confirmed with.
 *
 * Suggestions from other cities are shown rather than hidden, with the city
 * named on the row: several towns have a "Dvorana", and the choice of which
 * one belongs to this event is the admin's, not a silent guess.
 */
export function VenueNameInput({
  id,
  value,
  cityName,
  disabled,
  placeholder,
  onChange,
  onPick,
  className,
}: {
  id?: string
  value: string
  cityName?: string
  disabled?: boolean
  placeholder?: string
  onChange: (value: string) => void
  onPick: (venue: VenueSuggestion) => void
  className?: string
}) {
  const [suggestions, setSuggestions] = useState<VenueSuggestion[]>([])
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const [query, setQuery] = useState("")
  const listId = useId()
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // A pick must not immediately re-query for the name it just filled in.
  const picked = useRef(false)

  useEffect(() => {
    if (disabled || picked.current) { picked.current = false; return }
    if (query.trim().length < MIN_QUERY) { setSuggestions([]); setOpen(false); return }
    const controller = new AbortController()
    timer.current = setTimeout(async () => {
      const params = new URLSearchParams({ q: query.trim() })
      if (cityName?.trim()) params.set("city", cityName.trim())
      try {
        const response = await authedFetch(`/api/admin/venues/search?${params}`, { signal: controller.signal })
        if (!response.ok) return
        const rows = (await response.json()) as VenueSuggestion[]
        if (controller.signal.aborted) return
        setSuggestions(rows)
        setOpen(rows.length > 0)
        setActive(-1)
      } catch { /* A failed lookup must never block typing a new venue. */ }
    }, DEBOUNCE_MS)
    return () => { controller.abort(); if (timer.current) clearTimeout(timer.current) }
  }, [query, cityName, disabled])

  function change(next: string) {
    setQuery(next)
    onChange(next)
  }

  function choose(venue: VenueSuggestion) {
    picked.current = true
    setQuery(venue.name)
    setSuggestions([])
    setOpen(false)
    onChange(venue.name)
    onPick(venue)
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || !suggestions.length) return
    if (event.key === "Escape") { event.preventDefault(); setOpen(false); return }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault()
      setActive((index) => event.key === "ArrowDown" ? (index + 1) % suggestions.length : (index <= 0 ? suggestions.length - 1 : index - 1))
      return
    }
    if (event.key === "Enter" && active >= 0) { event.preventDefault(); choose(suggestions[active]) }
  }

  return (
    <div className={cn("relative", className)}>
      <Input
        id={id}
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={listId}
        autoComplete="off"
        onChange={(event) => change(event.target.value)}
        onKeyDown={onKeyDown}
        onFocus={() => { if (suggestions.length) setOpen(true) }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && suggestions.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Spremljena mjesta"
          className="absolute z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-border bg-card shadow-lg"
        >
          {suggestions.map((venue, index) => (
            <li key={venue.id}>
              <button
                type="button"
                role="option"
                aria-selected={index === active}
                // onMouseDown: the input's blur would close the list first.
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(venue)}
                className={cn(
                  "flex w-full cursor-pointer flex-col items-start gap-0.5 px-3 py-2 text-left text-sm hover:bg-accent",
                  index === active && "bg-accent"
                )}
              >
                <span className="font-medium">{venue.name}</span>
                <span className="text-xs text-muted-foreground">
                  {[venue.address, venue.cityName].filter(Boolean).join(", ")}
                  {venue.lat === null || venue.lng === null ? " · bez koordinata" : ""}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
