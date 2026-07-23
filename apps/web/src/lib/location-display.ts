export function normalizeLocationPart(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/\s+/g, " ")
}

export function compactLocationParts(parts: Array<string | null | undefined>) {
  const seen = new Set<string>()
  const compacted: string[] = []
  for (const part of parts) {
    const trimmed = part?.trim()
    if (!trimmed) continue
    const key = normalizeLocationPart(trimmed)
    if (seen.has(key)) continue
    seen.add(key)
    compacted.push(trimmed)
  }
  return compacted
}

export function compactLocationLabel(value: string) {
  const parts = compactLocationParts(value.split(","))
  return parts.length > 0 ? parts.join(", ") : value
}

export function publicAddressLine(address: string | undefined, city: string, venue: string) {
  const hidden = new Set([city, venue].filter(Boolean).map(normalizeLocationPart))
  const parts = compactLocationParts((address ?? "").split(","))
  const visibleParts = parts.filter((part) => !hidden.has(normalizeLocationPart(part)))
  return visibleParts.length > 0 ? visibleParts.join(", ") : null
}
