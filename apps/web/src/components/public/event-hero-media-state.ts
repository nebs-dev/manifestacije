export type EventHeroMediaMode = "landscape" | "poster" | "fallback"

export function eventHeroMediaMode({
  hasImage,
  width,
  height,
  sourceDimensions = false,
}: {
  hasImage: boolean
  width?: number
  height?: number
  sourceDimensions?: boolean
}): EventHeroMediaMode {
  if (!hasImage) return "fallback"
  if (!width || !height) return "poster"

  const ratio = width / height
  // With a responsive `w` srcset, naturalWidth is density-corrected to the
  // rendered slot and is not the original file width. Only use the low-res
  // guard for untransformed sources where these are true source dimensions.
  const isLowResolution = sourceDimensions && (width < 640 || height < 360)
  const isLandscape = ratio >= 1.25 && ratio <= 2.4
  return isLandscape && !isLowResolution ? "landscape" : "poster"
}

export function eventHeroMediaVisibility(
  previewImage: string | undefined,
  detailImage: string | undefined,
  detailReady: boolean,
) {
  const fullImage = detailImage ?? previewImage
  const hasDistinctPreview = Boolean(previewImage && previewImage !== fullImage)
  return {
    fullImage,
    previewVisible: hasDistinctPreview && !detailReady,
    detailVisible: detailReady,
  }
}
