/**
 * Render-time guard for user-supplied links (ticket, source, image, website
 * URLs). Database rows may predate API validation, so every such value is
 * passed through here before it reaches an `href` or `src`. Only http(s) is
 * allowed; `javascript:`, `data:`, `vbscript:`, relative paths and junk text
 * yield undefined. Scheme-less hosts ("www.entrio.hr") get https:// so they
 * do not resolve relative to our own site.
 * Keep in sync with apps/api/src/common/safe-url.ts.
 */
const SAFE_PROTOCOLS = new Set(["http:", "https:"])
const EXPLICIT_SCHEME = /^[a-z][a-z0-9+.-]*:/i
// "www.entrio.hr:8080/x" looks like scheme "www.entrio.hr" to the regex above.
const HOST_WITH_PORT = /^[^\s:/?#]+:\d+(?:[/?#]|$)/
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/
// Ticket links may also be a phone number or e-mail for reservations
// (production has e.g. "tel:099-488-9294"). Neither scheme can run script.
const TEL_LINK = /^tel:\+?[0-9][0-9 ().\/-]{2,30}$/i
const MAILTO_LINK = /^mailto:[^\s<>"'@/]+@[^\s<>"'@/]+\.[^\s<>"'@/]+$/i

export function safeExternalUrl(value: unknown, options: { allowContactLinks?: boolean } = {}): string | undefined {
  if (typeof value !== "string") return undefined
  // Browsers strip tab/CR/LF anywhere in a URL; strip them first so the
  // scheme check sees what the browser will see.
  const trimmed = value.replace(/[\t\n\r]/g, "").trim()
  if (!trimmed || CONTROL_CHARS.test(trimmed) || trimmed.includes("\\")) return undefined
  if (options.allowContactLinks && (TEL_LINK.test(trimmed) || MAILTO_LINK.test(trimmed))) return trimmed

  let candidate: string
  let schemeless = false
  if (trimmed.startsWith("//")) {
    candidate = `https:${trimmed}`
  } else if (EXPLICIT_SCHEME.test(trimmed) && !HOST_WITH_PORT.test(trimmed)) {
    candidate = trimmed
  } else if (trimmed.startsWith("/")) {
    return undefined
  } else {
    candidate = `https://${trimmed}`
    schemeless = true
  }

  let url: URL
  try {
    url = new URL(candidate)
  } catch {
    return undefined
  }
  if (!SAFE_PROTOCOLS.has(url.protocol) || !url.hostname) return undefined
  if (schemeless && !url.hostname.includes(".")) return undefined
  return candidate
}
