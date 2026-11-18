import { draftMode } from "next/headers"
import { NextRequest, NextResponse } from "next/server"
import { API_URL } from "@/lib/api"
import { PREVIEW_TOKEN_COOKIE, PREVIEW_TOKEN_MAX_AGE_SECONDS } from "@/lib/event-preview"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * Turns an admin-issued preview token into a Draft Mode session.
 *
 * /eventi/[eventSlug] is cached (PERF-02), and a prerendered route on Vercel
 * ignores the query string in its cache key — `?preview=<token>` would be
 * answered with the cached public page. Draft Mode is the built-in way out:
 * its cookie makes the CDN bypass the cache for this browser only, and the
 * page renders dynamically for it.
 *
 * The token is not verified here. It is handed to the same API endpoint the
 * page itself calls, which is where EventPreviewService verifies the
 * signature, the `event-preview` scope and the slug the token was issued for.
 * An unpublished event comes back only for a token that passes all three, so
 * the check is neither duplicated nor weakened. A failed check sets no cookie
 * and redirects nowhere.
 */
export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug")
  const token = req.nextUrl.searchParams.get("token")
  if (!slug || !token) {
    return NextResponse.json({ error: "Nedostaje slug ili token" }, { status: 400 })
  }

  let event: { slug?: string } | null = null
  try {
    const res = await fetch(
      `${API_URL}/api/public/events/${encodeURIComponent(slug)}?preview=${encodeURIComponent(token)}`,
      { cache: "no-store" },
    )
    if (res.ok) event = (await res.json()) as { slug?: string } | null
  } catch {
    event = null
  }

  // Only the slug the API echoes back is ever used to build the destination,
  // and only when it is the slug that was asked for. The path is assembled
  // here rather than taken from the request, so no caller-supplied value can
  // steer the redirect off /eventi/<slug>.
  if (!event || typeof event.slug !== "string" || event.slug !== slug) {
    return NextResponse.json({ error: "Pregled nije dostupan" }, { status: 404 })
  }

  draftMode().enable()
  // A relative Location, not NextResponse.redirect(): that needs an absolute
  // URL, and req.nextUrl.origin is not always the host the browser is on
  // (localhost vs 127.0.0.1 behind a proxy). Landing on a different host would
  // leave both cookies behind in the old jar and serve the cached public page.
  const response = new NextResponse(null, {
    status: 307,
    headers: { Location: `/eventi/${encodeURIComponent(event.slug)}` },
  })
  response.cookies.set(PREVIEW_TOKEN_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: PREVIEW_TOKEN_MAX_AGE_SECONDS,
  })
  return response
}
