export function cartoBasemapUrl(key: string | undefined): string | undefined {
  const browserKey = key?.trim()
  if (!browserKey) return undefined
  return `https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png?key=${encodeURIComponent(browserKey)}`
}
