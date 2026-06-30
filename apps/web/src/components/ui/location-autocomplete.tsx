"use client"

import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { MapPin, X } from "lucide-react"
import { cn } from "@/lib/utils"

export type LocationValue = {
  address: string
  lat: number
  lng: number
}

type NominatimAddress = {
  road?: string
  house_number?: string
  amenity?: string
  building?: string
  leisure?: string
  tourism?: string
  city?: string
  town?: string
  village?: string
  municipality?: string
  quarter?: string
  suburb?: string
  postcode?: string
}

type NominatimResult = {
  place_id: number
  display_name: string
  lat: string
  lon: string
  address: NominatimAddress
  name?: string
}

function extractNumber(query: string): string | undefined {
  return query.match(/\b(\d+[a-zA-Z]?)\b/)?.[1]
}

function formatLabel(r: NominatimResult, queryHint?: string): string {
  const a = r.address
  const parts: string[] = []

  const name = r.name && r.name !== a.road ? r.name : null
  if (name) parts.push(name)

  if (a.road) {
    const num = a.house_number ?? (queryHint ? extractNumber(queryHint) : undefined)
    parts.push(num ? `${a.road} ${num}` : a.road)
  }

  const city = a.city ?? a.town ?? a.village ?? a.municipality
  if (city) parts.push(city)

  return parts.length ? parts.join(", ") : r.display_name
}

export function LocationAutocomplete({
  value,
  onChange,
  disabled,
  placeholder = "Pretraži lokaciju…",
  className,
}: {
  value?: LocationValue | null
  onChange: (v: LocationValue | null) => void
  disabled?: boolean
  placeholder?: string
  className?: string
}) {
  const [query, setQuery] = useState(value?.address ?? "")
  const [results, setResults] = useState<NominatimResult[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({})
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setQuery(value?.address ?? "")
  }, [value?.address])

  function updateDropdownPosition() {
    const el = inputRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    setDropdownStyle({
      position: "fixed",
      top: rect.bottom + 4,
      left: rect.left,
      width: rect.width,
      zIndex: 9999,
    })
  }

  function handleChange(q: string) {
    setQuery(q)
    if (timerRef.current) clearTimeout(timerRef.current)
    if (q.length < 3) { setResults([]); setOpen(false); return }
    timerRef.current = setTimeout(() => search(q), 1000)
  }

  async function search(q: string) {
    setLoading(true)
    try {
      const url = new URL("https://nominatim.openstreetmap.org/search")
      url.searchParams.set("q", q)
      url.searchParams.set("format", "json")
      url.searchParams.set("countrycodes", "hr")
      url.searchParams.set("limit", "6")
      url.searchParams.set("addressdetails", "1")
      const res = await fetch(url.toString(), {
        headers: { "Accept-Language": "hr", "User-Agent": "Manifestacije/1.0" },
      })
      if (!res.ok) return
      const data = (await res.json()) as NominatimResult[]
      setResults(data)
      if (data.length > 0) {
        updateDropdownPosition()
        setOpen(true)
      }
    } catch {
      // network error — silently ignore
    } finally {
      setLoading(false)
    }
  }

  function select(r: NominatimResult) {
    const label = formatLabel(r, query)
    onChange({ address: label, lat: parseFloat(r.lat), lng: parseFloat(r.lon) })
    setQuery(label)
    setOpen(false)
  }

  function clear() {
    onChange(null)
    setQuery("")
    setResults([])
    setOpen(false)
  }

  const dropdown = open && results.length > 0 && typeof document !== "undefined"
    ? createPortal(
        <ul
          style={dropdownStyle}
          className="max-h-64 overflow-y-auto rounded-lg border border-border bg-card shadow-lg"
        >
          {results.map((r) => (
            <li key={r.place_id}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => select(r)}
                className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
              >
                <MapPin className="mt-0.5 size-3.5 shrink-0 text-primary/70" />
                <span className="line-clamp-1">{formatLabel(r, query)}</span>
              </button>
            </li>
          ))}
        </ul>,
        document.body,
      )
    : null

  return (
    <div className={cn("relative", className)}>
      <div className="relative flex items-center">
        <MapPin className="pointer-events-none absolute left-3 size-4 text-muted-foreground" />
        <input
          ref={inputRef}
          value={query}
          disabled={disabled}
          onChange={(e) => handleChange(e.target.value)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onFocus={() => {
            if (results.length > 0) {
              updateDropdownPosition()
              setOpen(true)
            }
          }}
          placeholder={placeholder}
          className="w-full rounded-lg border border-input bg-card py-2 pl-9 pr-8 text-sm outline-none ring-ring/40 placeholder:text-muted-foreground focus:ring-2 disabled:opacity-60"
        />
        {query && !disabled && !loading && (
          <button
            type="button"
            onClick={clear}
            className="absolute right-2 text-muted-foreground hover:text-foreground"
            tabIndex={-1}
          >
            <X className="size-3.5" />
          </button>
        )}
        {loading && (
          <span className="absolute right-2 size-3.5 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
        )}
      </div>
      {dropdown}
    </div>
  )
}
