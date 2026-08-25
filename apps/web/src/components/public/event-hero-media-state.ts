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
