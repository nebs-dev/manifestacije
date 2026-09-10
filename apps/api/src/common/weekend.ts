const TZ = "Europe/Zagreb";

const weekdayIndex: Record<string, number> = {
  Mon: 0,
  Tue: 1,
  Wed: 2,
  Thu: 3,
  Fri: 4,
  Sat: 5,
  Sun: 6,
};

function partsInZagreb(date: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).formatToParts(date);
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return {
    year: Number(part("year")),
    month: Number(part("month")),
    day: Number(part("day")),
    weekday: weekdayIndex[part("weekday")] ?? 0,
  };
}

function offsetMinutesAt(utc: Date): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    timeZoneName: "shortOffset",
    hour: "2-digit",
  }).formatToParts(utc);
  const name = parts.find((p) => p.type === "timeZoneName")?.value ?? "GMT+0";
  const match = name.match(/GMT([+-])(\d{1,2})(?::?(\d{2}))?/);
  if (!match) return 0;
  const minutes = Number(match[2]) * 60 + Number(match[3] ?? 0);
  return match[1] === "-" ? -minutes : minutes;
}

export function zagrebLocalToUtc(year: number, month: number, day: number, hour = 0, minute = 0, second = 0, ms = 0): Date {
  const rough = new Date(Date.UTC(year, month - 1, day, hour, minute, second, ms));
  const offset = offsetMinutesAt(rough);
  const adjusted = new Date(rough.getTime() - offset * 60_000);
  const adjustedOffset = offsetMinutesAt(adjusted);
  return adjustedOffset === offset ? adjusted : new Date(rough.getTime() - adjustedOffset * 60_000);
}

export function shiftZagrebCalendarDays(date: Date, days: number): Date {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const value = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  const target = new Date(Date.UTC(value("year"), value("month") - 1, value("day") + days, 12));
  return zagrebLocalToUtc(
    target.getUTCFullYear(),
    target.getUTCMonth() + 1,
    target.getUTCDate(),
    value("hour"),
    value("minute"),
    value("second"),
    date.getUTCMilliseconds(),
  );
}

function addLocalDays(parts: { year: number; month: number; day: number }, days: number) {
  const utc = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days, 12, 0, 0, 0));
  return partsInZagreb(utc);
}

export type WeekendRange = {
  start: Date;
  end: Date;
  friday: Date;
  saturday: Date;
  sunday: Date;
  label: string;
  longLabel: string;
};

export function currentWeekendRange(now = new Date()): WeekendRange {
  const local = partsInZagreb(now);
  const daysToFriday = local.weekday <= 4 ? 4 - local.weekday : -(local.weekday - 4);
  const fridayParts = addLocalDays(local, daysToFriday);
  const saturdayParts = addLocalDays(fridayParts, 1);
  const sundayParts = addLocalDays(fridayParts, 2);
  const start = zagrebLocalToUtc(fridayParts.year, fridayParts.month, fridayParts.day, 0, 0, 0, 0);
  const end = zagrebLocalToUtc(sundayParts.year, sundayParts.month, sundayParts.day, 23, 59, 59, 999);
  const friday = start;
  const saturday = zagrebLocalToUtc(saturdayParts.year, saturdayParts.month, saturdayParts.day, 0, 0, 0, 0);
  const sunday = zagrebLocalToUtc(sundayParts.year, sundayParts.month, sundayParts.day, 0, 0, 0, 0);
  const label = weekendLabel(start, end);
  return {
    start,
    end,
    friday,
    saturday,
    sunday,
    label,
    longLabel: `od petka ${formatDayMonth(start)} do nedjelje ${formatDayMonth(end)}`,
  };
}

export function eventOverlapsRange(startsAt: Date, endsAt: Date | null | undefined, range: Pick<WeekendRange, "start" | "end">): boolean {
  // The ending instant belongs to the following interval, not this event.
  return startsAt <= range.end && (endsAt ? endsAt > range.start : startsAt >= range.start);
}

export function eventOverlapsDay(startsAt: Date, endsAt: Date | null | undefined, dayStart: Date): boolean {
  const endParts = partsInZagreb(dayStart);
  const dayEnd = zagrebLocalToUtc(endParts.year, endParts.month, endParts.day, 23, 59, 59, 999);
  return eventOverlapsRange(startsAt, endsAt, { start: dayStart, end: dayEnd });
}

export function normalizeWeekendStart(input?: string | Date): Date {
  if (!input) return currentWeekendRange().start;
  const date = typeof input === "string" ? new Date(input) : input;
  return currentWeekendRange(date).start;
}

function formatDayMonth(date: Date) {
  return new Intl.DateTimeFormat("hr-HR", { timeZone: TZ, day: "numeric", month: "long" }).format(date);
}

function weekendLabel(start: Date, end: Date) {
  const startParts = partsInZagreb(start);
  const endParts = partsInZagreb(end);
  const month = new Intl.DateTimeFormat("hr-HR", { timeZone: TZ, month: "long" }).format(end);
  if (startParts.month === endParts.month) return `${startParts.day}. – ${endParts.day}. ${month}`;
  return `${formatDayMonth(start)} – ${formatDayMonth(end)}`;
}
