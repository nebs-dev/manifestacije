"use client"

import { useEffect, useId, useLayoutEffect, useRef, useState, type RefObject } from "react"
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
  const [active, setActive] = useState(-1)
  const listId = useId()
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

  // Options in display order (remembered venues first) for keyboard selection.
  const options = [
    ...saved.map((v) => ({ key: `s-${v.label}-${v.lat}-${v.lng}`, label: compactLocationLabel(v.label), saved: true,
      choose: () => pick(v.label, v.lat, v.lng, v.cityName, v.countyName, v.regionSlug) })),
    ...results.map((r) => ({ key: `r-${r.place_id}`, label: label(r), saved: false,
      choose: () => pick(label(r), parseFloat(r.lat), parseFloat(r.lon), r.address.city ?? r.address.town ?? r.address.village, r.address.state ?? r.address.county, r.address.regionSlug) })),
  ]
  const listOpen = open && options.length > 0
  const anchor = useDropdownAnchor(inputRef, listOpen)
  useEffect(() => { setActive(-1) }, [results, saved, open])

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape" && listOpen) { event.preventDefault(); setOpen(false); return }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (!options.length) return
      event.preventDefault()
      setOpen(true)
      setActive((index) => event.key === "ArrowDown" ? (index + 1) % options.length : (index <= 0 ? options.length - 1 : index - 1))
      return
    }
    if (event.key === "Enter" && listOpen && active >= 0) { event.preventDefault(); options[active]?.choose() }
  }

  return (
    <div className={cn("relative", className)}>
      <div className="relative flex items-center">
        <MapPin className="pointer-events-none absolute left-3 size-4 text-muted-foreground" />
        <input
          ref={inputRef}
          value={query}
          disabled={disabled}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={listOpen}
          aria-controls={listId}
          aria-activedescendant={listOpen && active >= 0 ? `${listId}-${active}` : undefined}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={onKeyDown}
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

      {listOpen && anchor && (
        // Fixed so the list is not clipped by overflow-hidden cards; the anchor
        // follows the input through window/container scroll and viewport changes.
        <ul id={listId} role="listbox" aria-label="Prijedlozi lokacija" style={{ position: "fixed", left: anchor.left, width: anchor.width, maxHeight: anchor.maxHeight, zIndex: 9999,
          ...(anchor.above ? { bottom: anchor.bottom } : { top: anchor.top }) }}
          className="overflow-y-auto rounded-lg border border-border bg-card shadow-lg"
        >
          {options.map((option, index) => (
            <li key={option.key} role="presentation">
              {index === 0 && option.saved && <p className="px-3 py-1 text-xs font-medium text-muted-foreground">Zapamćene lokacije</p>}
              {!option.saved && index > 0 && options[index - 1].saved && (
                <p className="mt-1 border-t border-border px-3 pb-1 pt-2 text-xs font-medium text-muted-foreground">Ostale lokacije</p>
              )}
              <button type="button" id={`${listId}-${index}`} role="option" aria-selected={index === active} tabIndex={-1}
                onMouseDown={(e) => e.preventDefault()}
                onClick={option.choose}
                className={cn("flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-muted", index === active && "bg-muted")}>
                <MapPin className={cn("mt-0.5 size-3.5 shrink-0", option.saved ? "text-primary" : "text-primary/70")} />
                <span className="truncate">{option.label}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

type DropdownAnchor = { left: number; width: number; top: number; bottom: number; maxHeight: number; above: boolean }

/**
 * Viewport position for a fixed dropdown under (or above) an input. Re-measured
 * on any scroll (capture phase, so inner scroll containers such as the admin
 * <main> count), resize and mobile visual-viewport changes. Opens upward when
 * there is more room above, caps its height to the visible space, and returns
 * null while the input itself is scrolled out of view.
 */
export function dropdownAnchor(rect: Pick<DOMRect, "top" | "bottom" | "left" | "width">, view: { top: number; bottom: number; layoutHeight: number }): DropdownAnchor | null {
  if (rect.bottom < view.top || rect.top > view.bottom) return null
  const gap = 4, margin = 8, preferred = 288, minimum = 120
  const below = view.bottom - rect.bottom - gap - margin
  const aboveSpace = rect.top - view.top - gap - margin
  const above = below < Math.min(preferred, minimum + 80) && aboveSpace > below
  return {
    left: rect.left,
    width: rect.width,
    top: rect.bottom + gap,
    bottom: view.layoutHeight - rect.top + gap,
    maxHeight: Math.max(minimum, Math.min(preferred, above ? aboveSpace : below)),
    above,
  }
}

function useDropdownAnchor(inputRef: RefObject<HTMLInputElement | null>, open: boolean) {
  const [anchor, setAnchor] = useState<DropdownAnchor | null>(null)
  useLayoutEffect(() => {
    if (!open) { setAnchor(null); return }
    let frame = 0
    const measure = () => {
      const input = inputRef.current
      if (!input) return
      const vv = window.visualViewport
      setAnchor(dropdownAnchor(input.getBoundingClientRect(), {
        top: vv?.offsetTop ?? 0,
        bottom: vv ? vv.offsetTop + vv.height : window.innerHeight,
        layoutHeight: window.innerHeight,
      }))
    }
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(measure) }
    measure()
    window.addEventListener("scroll", schedule, true)
    window.addEventListener("resize", schedule)
    window.visualViewport?.addEventListener("resize", schedule)
    window.visualViewport?.addEventListener("scroll", schedule)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener("scroll", schedule, true)
      window.removeEventListener("resize", schedule)
      window.visualViewport?.removeEventListener("resize", schedule)
      window.visualViewport?.removeEventListener("scroll", schedule)
    }
  }, [inputRef, open])
  return anchor
}
