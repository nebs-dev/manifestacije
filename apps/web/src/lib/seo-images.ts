/**
 * Default social sharing artwork (SEO-14).
 *
 * Listing pages (cities, regions, categories, weekend, today) carry no artwork
 * of their own, and because a page that declares `openGraph` replaces the root
 * metadata's whole `openGraph` object, they ended up with no og:image at all —
 * so Facebook, the paid traffic source, had nothing to render. This PNG is the
 * fallback; Facebook and X ignore SVG, so the brand icon is used in its raster
 * form. Paths stay relative: `metadataBase` in app/layout.tsx makes them
 * absolute.
 */
export const DEFAULT_OG_IMAGE = "/brand/icon-512x512-v2.png"

export const DEFAULT_OG_IMAGE_META = {
  url: DEFAULT_OG_IMAGE,
  width: 512,
  height: 512,
  alt: "Manifestacije",
} as const
