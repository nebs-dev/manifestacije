/**
 * Editorial preview of an unpublished event.
 *
 * The token itself is issued and verified by the API (EventPreviewService):
 * it is scoped to one slug, carries no user identity and lives 30 minutes.
 * Nothing here validates it — /api/preview asks the API, which stays the only
 * authority, exactly as the old `?preview=<token>` query parameter did.
 *
 * The token moved out of the URL and into an httpOnly cookie because a query
 * parameter cannot survive caching: on Vercel a prerendered route ignores the
 * query string in its cache key, so `/eventi/<slug>?preview=<token>` would
 * have been served the cached public page. Draft Mode's own cookie makes the
 * CDN bypass the cache for that one browser; this cookie carries the token
 * the page then forwards to the API.
 */
export const PREVIEW_TOKEN_COOKIE = "event_preview_token"

/**
 * The slug the token in PREVIEW_TOKEN_COOKIE was issued for, URL-encoded
 * because a slug may hold characters a cookie value cannot.
 *
 * Draft Mode's cookie is per-browser, not per-event, so without this the
 * session would treat every event page as a preview for as long as it lasts:
 * an unrelated published event would render with the editorial banner, a
 * "Pregled:" title and robots noindex, and would forward one event's token on
 * requests for another. The API already refuses to serve a draft to a token
 * issued for a different slug, so this is not what keeps drafts shut — it is
 * what keeps the preview session from spilling onto pages it has nothing to
 * do with.
 */
export const PREVIEW_SLUG_COOKIE = "event_preview_slug"

/** Matches EventPreviewService.expiresInMinutes, so the cookie cannot outlive
 *  the token it holds. */
export const PREVIEW_TOKEN_MAX_AGE_SECONDS = 30 * 60
