import { draftMode } from "next/headers"
import { NextRequest, NextResponse } from "next/server"
import { API_URL } from "@/lib/api"
import { PREVIEW_SLUG_COOKIE, PREVIEW_TOKEN_COOKIE, PREVIEW_TOKEN_MAX_AGE_SECONDS } from "@/lib/event-preview"

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
 *
 * Proving the token means proving it changed the answer. Asking the API once,
 * with the token, is not enough: a published event comes back for any token
 * at all, so that alone handed a Draft Mode session — and with it
 * `__prerender_bypass`, which makes the CDN skip the cache for every page
 * that browser then loads — to anyone who named a public slug. No draft was
 * ever exposed (the API keeps its status filter), but the bypass undid the
 * caching this route exists to protect, for free and without signing in.
 *
 * So the public answer is fetched first. If the event is already public there
 * is nothing to preview: the redirect goes to the ordinary page and no
 * session starts. Only an event the public cannot see goes on to the second
 * call, and only the token that lifts the status filter can produce it.
 */
export async function GET(req: NextRequest) {
  const requested = req.nextUrl.searchParams.get("slug")
  const token = req.nextUrl.searchParams.get("token")
  if (!requested || !token) {
    return NextResponse.json({ error: "Nedostaje slug ili token" }, { status: 400 })
  }
  const slug: string = requested

  // Only the slug the API echoes back is ever used to build the destination,
  // and only when it is the slug that was asked for. The path is assembled
  // here rather than taken from the request, so no caller-supplied value can
  // steer the redirect off /eventi/<slug>.
  const isThisEvent = (event: { slug?: string } | null) =>
    !!event && typeof event.slug === "string" && event.slug === slug

  async function askApi(previewToken?: string) {
    const query = previewToken ? `?preview=${encodeURIComponent(previewToken)}` : ""
    try {
      const res = await fetch(`${API_URL}/api/public/events/${encodeURIComponent(slug)}${query}`, {
        cache: "no-store",
      })
      return res.ok ? ((await res.json()) as { slug?: string } | null) : null
    } catch {
      return null
    }
  }

  // Already public: the page needs no session, and starting one would hand
  // out a cache bypass for nothing.
  if (isThisEvent(await askApi())) {
    return new NextResponse(null, {
      status: 307,
      headers: { Location: `/eventi/${encodeURIComponent(slug)}` },
    })
  }

  // Not public. Only a token that passes every check in EventPreviewService
  // can make the API answer with it at all.
  const event = await askApi(token)
  if (!isThisEvent(event)) {
    return NextResponse.json({ error: "Pregled nije dostupan" }, { status: 404 })
  }

  draftMode().enable()
  // A relative Location, not NextResponse.redirect(): that needs an absolute
  // URL, and req.nextUrl.origin is not always the host the browser is on
  // (localhost vs 127.0.0.1 behind a proxy). Landing on a different host would
  // leave both cookies behind in the old jar and serve the cached public page.
  const response = new NextResponse(null, {
    status: 307,
    headers: { Location: `/eventi/${encodeURIComponent(slug)}` },
  })
  const cookieOptions = {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: PREVIEW_TOKEN_MAX_AGE_SECONDS,
  } as const
  response.cookies.set(PREVIEW_TOKEN_COOKIE, token, cookieOptions)
  // Which event this session is for. Draft Mode's own cookie says only that a
  // session exists, so without this every event page would render as a
  // preview for its whole lifetime.
  response.cookies.set(PREVIEW_SLUG_COOKIE, encodeURIComponent(slug), cookieOptions)
  return response
}
