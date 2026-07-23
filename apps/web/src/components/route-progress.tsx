"use client"

import { useEffect } from "react"
import { usePathname, useSearchParams } from "next/navigation"
import { startProgress, doneProgress } from "@/lib/route-progress"

function isInternalNavigationClick(e: MouseEvent): boolean {
  // Deliberately does NOT check e.defaultPrevented — Next's <Link> calls
  // preventDefault() itself to do a client-side transition, and by the time
  // a bubble-phase listener on document would see the click, that's already
  // happened. Listening in the capture phase (see addEventListener below)
  // means this runs before Link's own handler, so that's moot anyway.
  if (e.button !== 0) return false
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return false

  const anchor = (e.target as HTMLElement | null)?.closest("a")
  if (!anchor) return false
  if (anchor.target === "_blank" || anchor.hasAttribute("download")) return false

  const href = anchor.getAttribute("href")
  if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return false

  try {
    const url = new URL(href, window.location.href)
    if (url.origin !== window.location.origin) return false
    if (url.pathname === window.location.pathname && url.search === window.location.search) return false
    return true
  } catch {
    return false
  }
}

/** Thin top progress bar for every route transition — full page nav (Link
 *  clicks) and same-page filter/search updates (router.push with new
 *  searchParams) alike. Mounted once in the root layout. */
export function RouteProgress() {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (isInternalNavigationClick(e)) startProgress()
    }
    document.addEventListener("click", onClick, { capture: true })
    return () => document.removeEventListener("click", onClick, { capture: true })
  }, [])

  useEffect(() => {
    doneProgress()
  }, [pathname, searchParams])

  return null
}
