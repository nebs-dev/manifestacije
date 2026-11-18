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

/** Matches EventPreviewService.expiresInMinutes, so the cookie cannot outlive
 *  the token it holds. */
export const PREVIEW_TOKEN_MAX_AGE_SECONDS = 30 * 60
