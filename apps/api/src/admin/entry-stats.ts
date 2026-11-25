import { parseZagrebWallTime, zagrebDateKey } from "../common/zagreb-time";

/**
 * Entry statistics (STAT-01…STAT-07): who entered how many events, when.
 *
 * Everything here is pure and works on Zagreb calendar days. A day is the day
 * an editor in Osijek would call it, not a UTC day — an event entered at
 * 00:30 on 1 December belongs to 1 December, which the UTC reading would put
 * in November. All windows are half-open [from, to): the day, week, month or
 * year ends at the next one's first instant, so nothing is counted twice and
 * no second falls outside every bucket.
 */

export type EntryRow = { createdByUserId: number | null; createdAt: Date };

export type StatsUser = {
  id: number;
  name: string | null;
  role: string;
  organizerName?: string | null;
};

export type EntryRange = { from: string; to: string };

export const ENTRY_PRESETS = [
  "today", "yesterday", "this-week", "last-week", "last-7",
  "this-month", "last-month", "last-30", "this-year", "all-time",
] as const;
export type EntryPreset = (typeof ENTRY_PRESETS)[number];

/** The first instant Manifestacije could possibly hold an entry for. Kept as a
 *  real date rather than `undefined` so every range is a closed interval and
 *  the "previous comparable period" arithmetic has something to subtract. */
const ALL_TIME_START = "2000-01-01";

const shiftDays = (dateKey: string, days: number): string => {
  const date = new Date(`${dateKey}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

const shiftMonths = (dateKey: string, months: number): string => {
  const [year, month] = dateKey.split("-").map(Number);
  const target = new Date(Date.UTC(year, month - 1 + months, 1, 12));
  return target.toISOString().slice(0, 10);
};

const firstOfMonth = (dateKey: string) => `${dateKey.slice(0, 7)}-01`;

/** Monday, as the week is read in Croatia. */
export const startOfWeek = (dateKey: string): string => {
  const weekday = new Date(`${dateKey}T12:00:00Z`).getUTCDay();
  return shiftDays(dateKey, -((weekday + 6) % 7));
};

/** The instant a Zagreb calendar day begins. DST never removes midnight in
 *  this zone, but if it ever did, the day would start an hour later rather
 *  than silently become an invalid date. */
export const startOfZagrebDay = (dateKey: string): Date => {
  for (const time of ["00:00", "01:00", "02:00", "03:00"]) {
    const instant = parseZagrebWallTime(dateKey, time);
    if (instant) return new Date(instant);
  }
  return new Date(`${dateKey}T00:00:00Z`);
};

/** Half-open [from, to) over whole Zagreb days. */
export const rangeFromDays = (firstDay: string, lastDay: string): EntryRange => ({
  from: startOfZagrebDay(firstDay).toISOString(),
  to: startOfZagrebDay(shiftDays(lastDay, 1)).toISOString(),
});

export function presetRange(preset: EntryPreset, now = new Date()): EntryRange {
  const today = zagrebDateKey(now);
  switch (preset) {
    case "today": return rangeFromDays(today, today);
    case "yesterday": return rangeFromDays(shiftDays(today, -1), shiftDays(today, -1));
    case "this-week": return rangeFromDays(startOfWeek(today), today);
    case "last-week": return rangeFromDays(shiftDays(startOfWeek(today), -7), shiftDays(startOfWeek(today), -1));
    case "last-7": return rangeFromDays(shiftDays(today, -6), today);
    case "this-month": return rangeFromDays(firstOfMonth(today), today);
    case "last-month": {
      const previous = shiftMonths(firstOfMonth(today), -1);
      return rangeFromDays(previous, shiftDays(firstOfMonth(today), -1));
    }
    case "last-30": return rangeFromDays(shiftDays(today, -29), today);
    case "this-year": return rangeFromDays(`${today.slice(0, 4)}-01-01`, today);
    case "all-time": return rangeFromDays(ALL_TIME_START, today);
  }
}

/** One month, for the arrows that step through months. */
export const monthRange = (month: string, now = new Date()): EntryRange => {
  const first = `${month}-01`;
  const today = zagrebDateKey(now);
  const lastOfMonth = shiftDays(shiftMonths(first, 1), -1);
  // The current month stops at today: future days hold nothing and would
  // drag the daily average down.
  return rangeFromDays(first, lastOfMonth > today && first.slice(0, 7) === today.slice(0, 7) ? today : lastOfMonth);
};

/** The same number of days immediately before the range, which is what
 *  "compared with the previous comparable period" has to mean for a range of
 *  any length — including a half-finished month, where comparing against a
 *  whole previous month would always look like a collapse. */
export function previousRange(range: EntryRange): EntryRange {
  const span = new Date(range.to).getTime() - new Date(range.from).getTime();
  return { from: new Date(new Date(range.from).getTime() - span).toISOString(), to: range.from };
}

/** Every Zagreb day the range touches, including the ones with no entries —
 *  a gap in the table is information. */
export function daysInRange(range: EntryRange): string[] {
  const first = zagrebDateKey(new Date(range.from));
  // `to` is exclusive, so a range ending at midnight ends on the day before.
  const last = zagrebDateKey(new Date(new Date(range.to).getTime() - 1));
  const days: string[] = [];
  for (let day = first; day <= last; day = shiftDays(day, 1)) {
    days.push(day);
    if (days.length > 3700) break; // ~10 years, guards a corrupt range
  }
  return days;
}

const inRange = (row: EntryRow, range: EntryRange) => {
  const time = row.createdAt.getTime();
  return time >= Date.parse(range.from) && time < Date.parse(range.to);
};

export type UserEntryStats = {
  userId: number;
  name: string;
  role: string;
  organizerName: string | null;
  total: number;
  today: number;
  thisWeek: number;
  thisMonth: number;
  activeDays: number;
  averagePerActiveDay: number;
  lastEntryAt: string | null;
  /** Share of the entries made by accounts with this one's role, in percent. */
  sharePercent: number;
};

export type EntryStats = {
  range: EntryRange;
  totals: {
    total: number;
    admin: number;
    organizer: number;
    unknown: number;
    today: number;
    yesterday: number;
    thisWeek: number;
    thisMonth: number;
    averagePerDay: number;
    /** Events published in the range, and events deleted in it. Deletions are
     *  only recorded from the day the record was introduced; earlier ones
     *  cannot be counted and the page says so. */
    published: number;
    deleted: number;
    previousTotal: number;
    previousRange: EntryRange;
  };
  users: UserEntryStats[];
  daily: { date: string; total: number; byUser: Record<number, number> }[];
};

const round1 = (value: number) => Math.round(value * 10) / 10;

/**
 * `rows` are the entries inside the selected range; `currentRows` cover today,
 * this week and this month so those cards stay meaningful whatever range is
 * selected; `previousTotal` is the count for the comparable period before it.
 *
 * `users` is the full account list: an account with no entries in the range
 * still gets a row with zeros, so the page can offer to show or hide it
 * rather than pretending it does not exist.
 */
export function buildEntryStats(input: {
  rows: EntryRow[];
  currentRows: EntryRow[];
  previousTotal: number;
  publishedTotal?: number;
  deletedTotal?: number;
  users: StatsUser[];
  range: EntryRange;
  now?: Date;
}): EntryStats {
  const { rows, currentRows, previousTotal, users, range } = input;
  const now = input.now ?? new Date();
  const today = zagrebDateKey(now);
  const windows = {
    today: rangeFromDays(today, today),
    yesterday: rangeFromDays(shiftDays(today, -1), shiftDays(today, -1)),
    week: rangeFromDays(startOfWeek(today), today),
    month: rangeFromDays(firstOfMonth(today), today),
  };
  const countIn = (source: EntryRow[], window: EntryRange, userId?: number) =>
    source.filter(row => inRange(row, window) && (userId === undefined || row.createdByUserId === userId)).length;

  const byRole = new Map(users.map(user => [user.id, user.role]));
  const total = rows.length;
  const known = rows.filter(row => row.createdByUserId !== null);
  const roleTotal = (role: string) => known.filter(row => byRole.get(row.createdByUserId!) === role).length;
  const adminTotal = roleTotal("ADMIN");
  const organizerTotal = roleTotal("ORGANIZER");

  const days = daysInRange(range);
  const userStats = users.map((user): UserEntryStats => {
    const mine = rows.filter(row => row.createdByUserId === user.id);
    const activeDays = new Set(mine.map(row => zagrebDateKey(row.createdAt))).size;
    const last = mine.reduce<Date | null>((latest, row) => (!latest || row.createdAt > latest ? row.createdAt : latest), null);
    const roleShareBase = user.role === "ADMIN" ? adminTotal : user.role === "ORGANIZER" ? organizerTotal : total;
    return {
      userId: user.id,
      // Email addresses stay out of this view entirely (STAT-RISK-03): an
      // account with no name is identified by its id, not by its address.
      name: user.name?.trim() || `Korisnik #${user.id}`,
      role: user.role,
      organizerName: user.organizerName ?? null,
      total: mine.length,
      today: countIn(currentRows, windows.today, user.id),
      thisWeek: countIn(currentRows, windows.week, user.id),
      thisMonth: countIn(currentRows, windows.month, user.id),
      activeDays,
      averagePerActiveDay: activeDays ? round1(mine.length / activeDays) : 0,
      lastEntryAt: last ? last.toISOString() : null,
      sharePercent: roleShareBase ? round1((mine.length / roleShareBase) * 100) : 0,
    };
  }).sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, "hr"));

  const daily = days.map(date => {
    const ofDay = rows.filter(row => zagrebDateKey(row.createdAt) === date);
    const byUser: Record<number, number> = {};
    for (const row of ofDay) {
      if (row.createdByUserId === null) continue;
      byUser[row.createdByUserId] = (byUser[row.createdByUserId] ?? 0) + 1;
    }
    return { date, total: ofDay.length, byUser };
  });

  return {
    range,
    totals: {
      total,
      admin: adminTotal,
      organizer: organizerTotal,
      // Events whose author is unknown: imported before attribution existed,
      // or entered by an account that has since been deleted. Never silently
      // folded into anyone's count.
      unknown: total - known.length,
      today: countIn(currentRows, windows.today),
      yesterday: countIn(currentRows, windows.yesterday),
      thisWeek: countIn(currentRows, windows.week),
      thisMonth: countIn(currentRows, windows.month),
      averagePerDay: days.length ? round1(total / days.length) : 0,
      published: input.publishedTotal ?? 0,
      deleted: input.deletedTotal ?? 0,
      previousTotal,
      previousRange: previousRange(range),
    },
    users: userStats,
    daily,
  };
}

export type TimelineEntry = { id: number; title: string; createdAt: string; status?: string; slug?: string };

export type EntryTimeline = {
  date: string;
  userId: number | null;
  entries: TimelineEntry[];
  firstAt: string | null;
  lastAt: string | null;
  /** Minutes between consecutive entries, in order. */
  gapsMinutes: number[];
  averageGapMinutes: number | null;
  medianGapMinutes: number | null;
  shortestGapMinutes: number | null;
  longestGapMinutes: number | null;
  /** Gaps left out of the average because they exceed the cap. */
  excludedGaps: number;
  spanMinutes: number | null;
  perHour: Record<number, number>;
};

const median = (values: number[]): number | null => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return round1(sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2);
};

/**
 * One editor's entries on one Zagreb day (STAT-07).
 *
 * `gapCapMinutes` drops the long pauses from the average and the median —
 * a lunch break otherwise swallows the rhythm of the entries around it. The
 * long gaps are still counted and reported, never hidden.
 *
 * This describes the pace of data entry, not the hours anyone worked; the
 * page says so, and nothing here should be read as a timesheet.
 */
export function buildTimeline(input: {
  date: string;
  userId: number | null;
  entries: { id: number; title: string; createdAt: Date; status?: string; slug?: string }[];
  gapCapMinutes?: number | null;
}): EntryTimeline {
  const entries = [...input.entries].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const gaps: number[] = [];
  for (let index = 1; index < entries.length; index++) {
    gaps.push(round1((entries[index].createdAt.getTime() - entries[index - 1].createdAt.getTime()) / 60000));
  }
  const cap = input.gapCapMinutes ?? null;
  const counted = cap === null ? gaps : gaps.filter(gap => gap <= cap);
  const perHour: Record<number, number> = {};
  for (const entry of entries) {
    const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Zagreb", hour: "2-digit", hourCycle: "h23" }).format(entry.createdAt));
    perHour[hour] = (perHour[hour] ?? 0) + 1;
  }
  const first = entries[0]?.createdAt ?? null;
  const last = entries.at(-1)?.createdAt ?? null;
  return {
    date: input.date,
    userId: input.userId,
    entries: entries.map(entry => ({ ...entry, createdAt: entry.createdAt.toISOString() })),
    firstAt: first ? first.toISOString() : null,
    lastAt: last ? last.toISOString() : null,
    gapsMinutes: gaps,
    averageGapMinutes: counted.length ? round1(counted.reduce((sum, gap) => sum + gap, 0) / counted.length) : null,
    medianGapMinutes: median(counted),
    shortestGapMinutes: gaps.length ? Math.min(...gaps) : null,
    longestGapMinutes: gaps.length ? Math.max(...gaps) : null,
    excludedGaps: gaps.length - counted.length,
    spanMinutes: first && last ? round1((last.getTime() - first.getTime()) / 60000) : null,
    perHour,
  };
}


/* ------------------------------------------------------------------ *
 * Trends (STAT-08) and portal content statistics (STAT-09).
 * ------------------------------------------------------------------ */

const zagrebHour = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Zagreb", hour: "2-digit", hourCycle: "h23" });
const zagrebWeekday = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Zagreb", weekday: "short" });
const WEEKDAY_ORDER = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export type EntryTrends = {
  /** Oldest month first, so a chart reads left to right. */
  months: { month: string; total: number; byUser: Record<number, number> }[];
  /** Monday-first; always seven entries, a quiet day included. */
  weekdays: { weekday: number; total: number }[];
  /** Always 24 entries: an empty hour is part of the shape. */
  hours: { hour: number; total: number }[];
  /** The current month against the same number of days of the one before. */
  monthToDate: { month: string; total: number; previousMonth: string; previousTotal: number; throughDay: number };
};

export function buildTrends(input: { rows: EntryRow[]; months: number; now?: Date }): EntryTrends {
  const now = input.now ?? new Date();
  const today = zagrebDateKey(now);
  const monthKeys: string[] = [];
  for (let back = input.months - 1; back >= 0; back--) monthKeys.push(shiftMonths(firstOfMonth(today), -back).slice(0, 7));

  const months = monthKeys.map(month => {
    const ofMonth = input.rows.filter(row => zagrebDateKey(row.createdAt).startsWith(month));
    const byUser: Record<number, number> = {};
    for (const row of ofMonth) {
      if (row.createdByUserId === null) continue;
      byUser[row.createdByUserId] = (byUser[row.createdByUserId] ?? 0) + 1;
    }
    return { month, total: ofMonth.length, byUser };
  });

  const weekdays = WEEKDAY_ORDER.map((name, index) => ({
    weekday: index,
    total: input.rows.filter(row => zagrebWeekday.format(row.createdAt).startsWith(name)).length,
  }));

  const hours = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    total: input.rows.filter(row => Number(zagrebHour.format(row.createdAt)) === hour).length,
  }));

  // Comparing a half-finished month with a whole one always reads as a
  // collapse, so the previous month is cut at the same day of the month.
  const throughDay = Number(today.slice(8));
  const month = today.slice(0, 7);
  const previousMonth = shiftMonths(`${month}-01`, -1).slice(0, 7);
  const inMonthThroughDay = (key: string) => input.rows.filter(row => {
    const date = zagrebDateKey(row.createdAt);
    return date.startsWith(key) && Number(date.slice(8)) <= throughDay;
  }).length;

  return {
    months,
    weekdays,
    hours,
    monthToDate: { month, total: inMonthThroughDay(month), previousMonth, previousTotal: inMonthThroughDay(previousMonth), throughDay },
  };
}

export type ContentRow = {
  id: number;
  title: string;
  status: string;
  startsAt: Date;
  createdAt: Date;
  publishedAt: Date | null;
  cityId: number | null;
  cityName: string | null;
  countyId: number | null;
  categoryId: number | null;
  description: string | null;
  imageUrl: string | null;
  address: string | null;
  venueId: number | null;
};

export type ContentStats = {
  range: EntryRange;
  byCity: { id: number | null; name: string; total: number }[];
  byCounty: { id: number | null; name: string; total: number }[];
  byCategory: { id: number | null; name: string; total: number }[];
  published: number;
  unpublished: number;
  upcoming: number;
  enteredOnEventDay: number;
  /** Days between entering an event and the event itself; the median is
   *  reported beside the mean because a single event booked two years out
   *  drags the mean somewhere nobody recognises. */
  averageLeadDays: number | null;
  medianLeadDays: number | null;
  pendingDuplicates: number;
  incomplete: { total: number; withoutImage: number; withoutLocation: number; withoutDescription: number; items: { id: number; title: string; missing: string[] }[] };
};

/** Short enough that nobody would call it a description. */
const MIN_DESCRIPTION = 60;

export function buildContentStats(input: {
  rows: ContentRow[];
  range: EntryRange;
  names: { cities: Map<number, string>; counties: Map<number, string>; categories: Map<number, string> };
  pendingDuplicates: number;
  now?: Date;
}): ContentStats {
  const now = input.now ?? new Date();
  const group = (key: (row: ContentRow) => number | null, names: Map<number, string>, unknown: string) => {
    const counts = new Map<number | null, number>();
    for (const row of input.rows) {
      const id = key(row);
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([id, total]) => ({ id, name: id === null ? unknown : names.get(id) ?? `#${id}`, total }))
      .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, "hr"));
  };

  const leadDays = input.rows
    .map(row => (row.startsAt.getTime() - row.createdAt.getTime()) / 86_400_000)
    .filter(days => Number.isFinite(days) && days >= 0);
  const sortedLead = [...leadDays].sort((a, b) => a - b);
  const middle = Math.floor(sortedLead.length / 2);

  const missingOf = (row: ContentRow) => {
    const missing: string[] = [];
    if (!row.imageUrl) missing.push("slika");
    if (!row.venueId && !row.address) missing.push("lokacija");
    if (!row.description || row.description.trim().length < MIN_DESCRIPTION) missing.push("opis");
    return missing;
  };
  const incompleteRows = input.rows.map(row => ({ row, missing: missingOf(row) })).filter(entry => entry.missing.length > 0);

  return {
    range: input.range,
    byCity: group(row => row.cityId, input.names.cities, "Nepoznat grad"),
    byCounty: group(row => row.countyId, input.names.counties, "Nepoznata županija"),
    byCategory: group(row => row.categoryId, input.names.categories, "Bez kategorije"),
    published: input.rows.filter(row => row.status === "PUBLISHED").length,
    unpublished: input.rows.filter(row => row.status !== "PUBLISHED").length,
    upcoming: input.rows.filter(row => row.startsAt.getTime() >= now.getTime()).length,
    // Entered the same Zagreb day the event takes place: too late to be of
    // much use to a visitor planning ahead, which is why it is counted.
    enteredOnEventDay: input.rows.filter(row => zagrebDateKey(row.createdAt) === zagrebDateKey(row.startsAt)).length,
    averageLeadDays: leadDays.length ? round1(leadDays.reduce((sum, days) => sum + days, 0) / leadDays.length) : null,
    medianLeadDays: sortedLead.length
      ? round1(sortedLead.length % 2 ? sortedLead[middle] : (sortedLead[middle - 1] + sortedLead[middle]) / 2)
      : null,
    pendingDuplicates: input.pendingDuplicates,
    incomplete: {
      total: incompleteRows.length,
      withoutImage: incompleteRows.filter(entry => entry.missing.includes("slika")).length,
      withoutLocation: incompleteRows.filter(entry => entry.missing.includes("lokacija")).length,
      withoutDescription: incompleteRows.filter(entry => entry.missing.includes("opis")).length,
      // A list short enough to act on, not a second copy of the table.
      items: incompleteRows.slice(0, 20).map(entry => ({ id: entry.row.id, title: entry.row.title, missing: entry.missing })),
    },
  };
}
