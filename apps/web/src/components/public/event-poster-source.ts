export type PosterSource = "image" | "fallback" | "placeholder"

/**
 * Decides which of the three image tiers to render: the event's own image,
 * the category fallback image, or the gradient placeholder — falling through
 * in order as each tier's onError fires.
 */
export function resolvePosterSource(params: {
  hasImage: boolean
  imageFailed: boolean
  fallbackFailed: boolean
}): PosterSource {
  if (params.hasImage && !params.imageFailed) return "image"
  if (!params.fallbackFailed) return "fallback"
  return "placeholder"
}

