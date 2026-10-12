/** Public event URL and share targets; mirrors the publication email (NOT-03). */
export function publicEventUrl(slug: string, origin = process.env.NEXT_PUBLIC_WEB_URL || "https://manifestacije.hr") {
  return new URL(`/eventi/${encodeURIComponent(slug)}`, origin).toString()
}

export function eventShareLinks(title: string, url: string) {
  return {
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
    whatsapp: `https://wa.me/?text=${encodeURIComponent(`${title} — ${url}`)}`,
  }
}
