"use client"

import { GoogleAnalytics } from "@next/third-parties/google"
import { usePathname } from "next/navigation"

// Authentication URLs may contain legacy reset/claim secrets. Never mount
// analytics on these routes, including navigation within the app.
export function PublicAnalytics({ gaId }: { gaId: string }) {
  const path = usePathname() || ""
  if (/^\/(reset-password|forgot-password|preuzmi-profil|admin|organizer)(\/|$)/.test(path) || /\/preuzmi(?:\/|$)/.test(path)) return null
  return <GoogleAnalytics gaId={gaId} />
}
