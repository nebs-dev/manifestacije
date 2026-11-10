/**
 * Which day the calendar opens on when the URL names none.
 *
 * Today, unless everything on the feed is still ahead — then the first day
 * that has something on it. A multi-day event that started last week must not
 * pull the view back into a week that is already over.
 */
export function calendarInitialDate(eventDates: string[], today: string): string {
  if (!eventDates.length) return today
  const earliest = eventDates.reduce((a, b) => (a <= b ? a : b))
  return earliest > today ? earliest : today
}
