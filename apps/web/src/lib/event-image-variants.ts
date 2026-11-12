export type EventImageVariant = "card" | "detail"

const VARIANT_WIDTHS: Record<EventImageVariant, readonly number[]> = {
  card: [360, 520, 640, 800],
  detail: [800, 1200, 1600],
}

const GENERATED_TRANSFORM = /\/upload\/(?=[^/]*c_(?:fill|limit))(?=[^/]*q_auto)(?=[^/]*w_\d+)[^/]*\//

/** Exact host, not a substring: a URL merely containing the string would
 *  otherwise have its path rewritten as if it were a Cloudinary asset. */
function isCloudinary(url: string): boolean {
  try { return new URL(url).hostname === "res.cloudinary.com" } catch { return false }
}

export function eventImageVariant(url: string, width: number, variant: EventImageVariant = "card") {
  if (!isCloudinary(url)) return url
  const replacement = variant === "card"
    ? `c_fill,g_auto,f_auto,q_auto,w_${width},h_${Math.round(width * 0.75)}`
    : `c_limit,f_auto,q_auto,w_${width}`
  return GENERATED_TRANSFORM.test(url)
    ? url.replace(GENERATED_TRANSFORM, `/upload/${replacement}/`)
    : url.replace(/\/upload\//, `/upload/${replacement}/`)
}

export function eventImageSrcSet(url: string, variant: EventImageVariant) {
  if (!isCloudinary(url)) return undefined
  return VARIANT_WIDTHS[variant]
    .map((width) => `${eventImageVariant(url, width, variant)} ${width}w`)
    .join(", ")
}

export function eventImagePrimaryUrl(url: string, variant: EventImageVariant) {
  const widths = VARIANT_WIDTHS[variant]
  return eventImageVariant(url, widths[widths.length - 1], variant)
}
