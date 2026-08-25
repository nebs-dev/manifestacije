import { eventImagePrimaryUrl, eventImageSrcSet } from "@/lib/event-image-variants"

const DETAIL_SIZES = "(max-width: 1023px) 100vw, 768px"
const prefetchedUrls = new Set<string>()
const inFlightImages = new Map<string, HTMLImageElement>()

export function claimEventImagePrefetch(url: string | undefined, saveData: boolean, seen: Set<string>) {
  if (!url || saveData || seen.has(url)) return false
  seen.add(url)
  return true
}

export function prefetchEventImage(url?: string) {
  if (typeof window === "undefined") return false
  const connection = (window.navigator as Navigator & { connection?: { saveData?: boolean } }).connection
  if (!claimEventImagePrefetch(url, connection?.saveData === true, prefetchedUrls) || !url) return false

  const image = new window.Image()
  const primaryUrl = eventImagePrimaryUrl(url, "detail")
  const srcSet = eventImageSrcSet(url, "detail")
  image.decoding = "async"
  image.fetchPriority = "high"
  image.sizes = DETAIL_SIZES
  if (srcSet) image.srcset = srcSet
  image.onload = image.onerror = () => inFlightImages.delete(url)
  inFlightImages.set(url, image)
  image.src = primaryUrl
  return true
}
