/** Last occupied instant for date grouping; preserve the actual endpoint for exports. */
export function eventDisplayEnd(start: Date, end: Date, allDay = false): Date {
  return !allDay && end > start ? new Date(end.getTime() - 1) : end
}
