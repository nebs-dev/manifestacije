export function normalizeOrganizerSearch(value: string) {
  return value.trim().toLocaleLowerCase("hr-HR").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d")
}

export function searchOrganizers<T extends { name: string }>(organizers: T[], query: string): T[] {
  const normalized = normalizeOrganizerSearch(query)
  return normalized ? organizers.filter(organizer => normalizeOrganizerSearch(organizer.name).includes(normalized)) : organizers
}
