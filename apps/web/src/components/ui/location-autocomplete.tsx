"use client"

import { useEffect, useRef, useState } from "react"
import { MapPin, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { compactLocationLabel, compactLocationParts } from "@/lib/location-display"

export type LocationValue = {
  address: string
  lat: number
  lng: number
  cityName?: string
  countyName?: string
  regionSlug?: string
}

// Nominatim result shape
type NomResult = {
  place_id: number
  lat: string
  lon: string
  display_name: string
  address: {
    name?: string
    road?: string
    house_number?: string
    city?: string
    town?: string
    village?: string
    city_district?: string
    county?: string
    state?: string
    regionSlug?: string
  }
}

type SavedVenue = { label: string; lat: number; lng: number; cityName?: string; countyName?: string; regionSlug?: string }

function label(r: NomResult): string {
  const a = r.address
  const road = a.road ? (a.house_number ? `${a.road} ${a.house_number}` : a.road) : null
  const city = a.city ?? a.town ?? a.village ?? a.city_district ?? null
  const parts = compactLocationParts([a.name, road, city])
  // fallback: take first 3 comma-parts of display_name
  return parts.length ? parts.join(", ") : compactLocationLabel(r.display_name.split(",").slice(0, 3).join(",").trim())
}

export function LocationAutocomplete({
  value,
  onChange,
  disabled,
  placeholder = "Pretraži lokaciju…",
  className,
  localSuggest,
}: {
  value?: LocationValue | null
  onChange: (v: LocationValue | null) => void
  disabled?: boolean
  placeholder?: string
  className?: string
  localSuggest?: (q: string) => Promise<SavedVenue[]>
}) {
  const [query, setQuery] = useState(value?.address ?? "")
  const [results, setResults] = useState<NomResult[]>([])
  const [saved, setSaved] = useState<SavedVenue[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setQuery(value?.address ? compactLocationLabel(value.address) : "")
  }, [value?.address, value?.cityName])

  function handleChange(q: string) {
    setQuery(q)
    setOpen(false)
    if (timerRef.current) clearTimeout(timerRef.current)
    if (q.length < 3) { setResults([]); setSaved([]); return }
    timerRef.current = setTimeout(() => search(q), 400)
  }

  async function search(q: string) {
    setLoading(true)
    try {
      const [nom, sv] = await Promise.all([
        fetch(`/api/geocode?q=${encodeURIComponent(q)}`)
          .then((r) => r.ok ? r.json() as Promise<NomResult[]> : [])
          .catch(() => []),
        localSuggest ? localSuggest(q).catch(() => []) : Promise.resolve([] as SavedVenue[]),
      ])
      setResults(nom)
      setSaved(sv)
      setOpen(nom.length > 0 || sv.length > 0)
    } finally {
      setLoading(false)
    }
  }

  function pick(lbl: string, lat: number, lng: number, cityName?: string, countyName?: string, regionSlug?: string) {
    const cleanLabel = compactLocationLabel(lbl)
    onChange({ address: cleanLabel, lat, lng, cityName, countyName, regionSlug })
    setQuery(cleanLabel)
    setOpen(false)
  }

  function clear() {
    onChange(null)
    setQuery("")
    setResults([])
    setSaved([])
    setOpen(false)
  }

  // Calculate dropdown position at render time (always fresh, no stale state)
  const inputRect = open && inputRef.current ? inputRef.current.getBoundingClientRect() : null

  return (
    <div className={cn("relative", className)}>
      <div className="relative flex items-center">
        <MapPin className="pointer-events-none absolute left-3 size-4 text-muted-foreground" />
        <input
          ref={inputRef}
          value={query}
          disabled={disabled}
          onChange={(e) => handleChange(e.target.value)}
          onBlur={() => setTimeout(() => setOpen(false), 200)}
          onFocus={() => {
            if (results.length > 0 || saved.length > 0) setOpen(true)
          }}
          placeholder={placeholder}
          className="w-full rounded-lg border border-input bg-card py-2 pl-9 pr-8 text-sm outline-none ring-ring/40 placeholder:text-muted-foreground focus:ring-2 disabled:opacity-60"
        />
        {query && !disabled && !loading && (
          <button type="button" onClick={clear} tabIndex={-1}
            className="absolute right-2 cursor-pointer text-muted-foreground hover:text-foreground">
            <X className="size-3.5" />
          </button>
        )}
        {loading && (
          <span className="absolute right-2 size-3.5 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
        )}
      </div>

      {open && inputRect && (results.length > 0 || saved.length > 0) && (
        <ul style={{
          position: "fixed",
          top: inputRect.bottom + 4,
          left: inputRect.left,
          width: inputRect.width,
          zIndex: 9999,
        }}
          className="max-h-72 overflow-y-auto rounded-lg border border-border bg-card shadow-lg"
        >
          {saved.length > 0 && (
            <>
              <li className="px-3 py-1 text-xs font-medium text-muted-foreground">Zapamćene lokacije</li>
              {saved.map((v, i) => (
                <li key={`s${i}`}>
                  <button type="button" onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pick(v.label, v.lat, v.lng, v.cityName, v.countyName, v.regionSlug)}
                    className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-muted">
                    <MapPin className="mt-0.5 size-3.5 shrink-0 text-primary" />
                    <span className="truncate">{compactLocationLabel(v.label)}</span>
                  </button>
                </li>
              ))}
              {results.length > 0 && (
                <li className="mt-1 border-t border-border px-3 pb-1 pt-2 text-xs font-medium text-muted-foreground">Ostale lokacije</li>
              )}
            </>
          )}
          {results.map((r) => (
            <li key={r.place_id}>
              <button type="button" onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(
                  label(r),
                  parseFloat(r.lat),
                  parseFloat(r.lon),
                  r.address.city ?? r.address.town ?? r.address.village,
                  r.address.state ?? r.address.county,
                  r.address.regionSlug,
                )}
                className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-muted">
                <MapPin className="mt-0.5 size-3.5 shrink-0 text-primary/70" />
                <span className="truncate">{label(r)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
