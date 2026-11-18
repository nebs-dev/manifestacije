"use client"

import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Suspense } from "react"
import { ArrowLeft } from "lucide-react"
import { armCalendarReturn } from "@/lib/calendar-return"

const BACK_LINKS = {
  kalendar: { href: "/kalendar", label: "Natrag na kalendar" },
  mapa: { href: "/mapa", label: "Natrag na kartu" },
  eventi: { href: "/eventi", label: "Natrag" },
} as const

export type BackLink = { href: string; label: string }

export function safeReturnTo(value: string | null | undefined): string | null {
  if (!value) return null
  if (value.startsWith("//")) return null
  if (value === "/eventi" || value.startsWith("/eventi?")) return value
  if (value === "/kalendar" || value.startsWith("/kalendar?")) return value
  if (value === "/mapa" || value.startsWith("/mapa?")) return value
  return null
}

/** Unchanged from the server-rendered version this replaced; only the source
 *  of the parameters moved from `searchParams` to the client router. */
export function backLinkFrom(params: URLSearchParams | null): BackLink {
  const returnTo = safeReturnTo(params?.get("returnTo"))
  if (returnTo?.startsWith("/kalendar")) return { href: returnTo, label: "Natrag na kalendar" }
  if (returnTo?.startsWith("/mapa")) return { href: returnTo, label: "Natrag na kartu" }
  if (returnTo) return { href: returnTo, label: "Natrag na rezultate" }
  const source = params?.get("from")
  if (source === "kalendar" || source === "mapa") return BACK_LINKS[source]
  return BACK_LINKS.eventi
}

function BackLinkShell({ href, label, className }: BackLink & { className?: string }) {
  return (
    <Link
      href={href}
      className={className}
      onClick={() => {
        if (href.startsWith("/kalendar")) armCalendarReturn(href)
      }}
    >
      <ArrowLeft className="size-4" aria-hidden /> {label}
    </Link>
  )
}

function ResolvedBackLink({ className }: { className?: string }) {
  const { href, label } = backLinkFrom(useSearchParams())
  return <BackLinkShell href={href} label={label} className={className} />
}

/**
 * The destination comes from `?returnTo=` / `?from=`, which used to be read on
 * the server from `searchParams`. Reading searchParams in a page opts the whole
 * route out of static rendering in Next 14, which is what kept
 * /eventi/[eventSlug] uncached (PERF-02). Reading them here instead — behind
 * the Suspense boundary Next requires for useSearchParams in a prerendered
 * route — leaves the page cacheable. The prerendered shell shows the plain
 * "Natrag" link, which is exactly what a visit with no parameters gets today,
 * and the client swaps in the real destination on hydration.
 */
export function EventBackLink({ className }: { className?: string }) {
  return (
    <Suspense fallback={<BackLinkShell {...BACK_LINKS.eventi} className={className} />}>
      <ResolvedBackLink className={className} />
    </Suspense>
  )
}
