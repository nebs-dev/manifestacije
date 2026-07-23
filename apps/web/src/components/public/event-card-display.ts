import { dateParts } from "@/lib/data"

export function eventCardDateDisplay(eventDate: string, displayDate?: string) {
  const date = displayDate ?? eventDate
  return {
    date,
    weekday: dateParts(date).weekday,
  }
}
