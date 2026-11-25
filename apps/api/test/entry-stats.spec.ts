import {
  buildContentStats, buildEntryStats, buildTimeline, buildTrends, daysInRange, monthRange, presetRange, previousRange, rangeFromDays, startOfWeek,
  type ContentRow,
} from "../src/admin/entry-stats";

/** Entry statistics are read by an editor in Osijek, so every day boundary is
 *  a Zagreb one. Several of these would pass by accident on a UTC server and
 *  fail in production, which is why the clock is pinned. */
describe("entry statistics windows", () => {
  const originalZone = process.env.TZ;
  afterEach(() => { process.env.TZ = originalZone; jest.useRealTimers(); });

  const at = (iso: string) => { jest.useFakeTimers().setSystemTime(new Date(iso)); };

  it.each(["UTC", "America/Los_Angeles", "Asia/Tokyo", "Europe/Zagreb"])("reads today in Zagreb on a %s server", zone => {
    process.env.TZ = zone;
    // 23:30 UTC on 30 November is already 1 December in Zagreb.
    at("2026-11-30T23:30:00Z");
    expect(presetRange("today")).toEqual(rangeFromDays("2026-12-01", "2026-12-01"));
  });

  it("starts the week on Monday", () => {
    // 2026-11-25 is a Wednesday.
    expect(startOfWeek("2026-11-25")).toBe("2026-11-23");
    expect(startOfWeek("2026-11-23")).toBe("2026-11-23");
    expect(startOfWeek("2026-11-29")).toBe("2026-11-23");
  });

  it.each([
    ["today", "2026-11-25", "2026-11-26"],
    ["yesterday", "2026-11-24", "2026-11-25"],
    ["this-week", "2026-11-23", "2026-11-26"],
    ["last-week", "2026-11-16", "2026-11-23"],
    ["last-7", "2026-11-19", "2026-11-26"],
    ["this-month", "2026-11-01", "2026-11-26"],
    ["last-month", "2026-10-01", "2026-11-01"],
    ["last-30", "2026-10-27", "2026-11-26"],
    ["this-year", "2026-01-01", "2026-11-26"],
  ])("resolves the %s preset", (preset, firstDay, exclusiveEnd) => {
    at("2026-11-25T10:00:00Z");
    const range = presetRange(preset as never);
    expect(range.from).toBe(rangeFromDays(firstDay, firstDay).from);
    expect(range.to).toBe(rangeFromDays(exclusiveEnd, exclusiveEnd).from);
  });

  it("stops the current month at today, so the daily average is not diluted by days that have not happened", () => {
    at("2026-11-25T10:00:00Z");
    expect(daysInRange(monthRange("2026-11"))).toHaveLength(25);
    expect(daysInRange(monthRange("2026-10"))).toHaveLength(31);
  });

  it("compares against the same number of days immediately before the range", () => {
    at("2026-11-25T10:00:00Z");
    const range = presetRange("this-month");
    const previous = previousRange(range);
    expect(daysInRange(previous)).toHaveLength(daysInRange(range).length);
    expect(previous.to).toBe(range.from);
  });

  it("lists every day of the range, including the empty ones", () => {
    expect(daysInRange(rangeFromDays("2026-11-01", "2026-11-03"))).toEqual(["2026-11-01", "2026-11-02", "2026-11-03"]);
  });

  it("keeps whole days across the October DST change", () => {
    // Croatia turns the clock back on 2026-10-25; that day has 25 hours.
    const range = rangeFromDays("2026-10-24", "2026-10-26");
    expect(daysInRange(range)).toEqual(["2026-10-24", "2026-10-25", "2026-10-26"]);
    expect(new Date(range.to).getTime() - new Date(range.from).getTime()).toBe((72 + 1) * 3600_000);
  });
});

describe("entry statistics", () => {
  const users = [
    { id: 1, name: "Vanesa", role: "ADMIN" },
    { id: 2, name: "Andrijana", role: "ADMIN" },
    { id: 3, name: "Klub Oxygene", role: "ORGANIZER", organizerName: "Oxygene" },
    { id: 4, name: "Neaktivna", role: "ADMIN" },
  ];
  const row = (userId: number | null, iso: string) => ({ createdByUserId: userId, createdAt: new Date(iso) });
  const range = rangeFromDays("2026-11-01", "2026-11-30");
  const stats = (rows: ReturnType<typeof row>[], extra: Partial<Parameters<typeof buildEntryStats>[0]> = {}) =>
    buildEntryStats({ rows, currentRows: rows, previousTotal: 0, users, range, now: new Date("2026-11-25T10:00:00Z"), ...extra });

  it("splits the total by role and never hides entries with no known author", () => {
    const result = stats([
      row(1, "2026-11-02T09:00:00Z"), row(2, "2026-11-02T10:00:00Z"),
      row(3, "2026-11-03T10:00:00Z"), row(null, "2026-11-04T10:00:00Z"),
    ]);
    expect(result.totals).toEqual(expect.objectContaining({ total: 4, admin: 2, organizer: 1, unknown: 1 }));
  });

  it("counts active days and the average per active day, not per calendar day", () => {
    const result = stats([
      row(1, "2026-11-02T09:00:00Z"), row(1, "2026-11-02T10:00:00Z"), row(1, "2026-11-02T11:00:00Z"),
      row(1, "2026-11-05T09:00:00Z"),
    ]);
    const vanesa = result.users.find(user => user.userId === 1)!;
    expect(vanesa).toEqual(expect.objectContaining({ total: 4, activeDays: 2, averagePerActiveDay: 2 }));
  });

  it("groups entries by the Zagreb day, not the UTC one", () => {
    // 23:30 UTC on 1 November is 00:30 on 2 November in Zagreb.
    const result = stats([row(1, "2026-11-01T23:30:00Z")]);
    expect(result.daily.find(day => day.date === "2026-11-02")!.total).toBe(1);
    expect(result.daily.find(day => day.date === "2026-11-01")!.total).toBe(0);
    expect(result.users.find(user => user.userId === 1)!.activeDays).toBe(1);
  });

  it("reports each admin's share of the admin entries, not of everything", () => {
    const result = stats([
      row(1, "2026-11-02T09:00:00Z"), row(1, "2026-11-02T10:00:00Z"),
      row(2, "2026-11-02T11:00:00Z"),
      row(3, "2026-11-02T12:00:00Z"), row(3, "2026-11-02T13:00:00Z"), row(3, "2026-11-02T14:00:00Z"),
    ]);
    expect(result.users.find(user => user.userId === 1)!.sharePercent).toBe(66.7);
    expect(result.users.find(user => user.userId === 2)!.sharePercent).toBe(33.3);
    expect(result.users.find(user => user.userId === 3)!.sharePercent).toBe(100);
  });

  it("keeps accounts with no activity in the list, at zero", () => {
    const result = stats([row(1, "2026-11-02T09:00:00Z")]);
    const idle = result.users.find(user => user.userId === 4)!;
    expect(idle).toEqual(expect.objectContaining({ total: 0, activeDays: 0, averagePerActiveDay: 0, lastEntryAt: null, sharePercent: 0 }));
  });

  it("identifies an account without a name by its id, never by an email address", () => {
    const result = buildEntryStats({ rows: [], currentRows: [], previousTotal: 0, range,
      users: [{ id: 7, name: "  ", role: "ADMIN" }], now: new Date("2026-11-25T10:00:00Z") });
    expect(result.users[0].name).toBe("Korisnik #7");
    expect(JSON.stringify(result)).not.toContain("@");
  });

  it("reports the last entry time per author", () => {
    const result = stats([row(1, "2026-11-02T09:00:00Z"), row(1, "2026-11-07T18:45:00Z"), row(1, "2026-11-05T09:00:00Z")]);
    expect(result.users.find(user => user.userId === 1)!.lastEntryAt).toBe("2026-11-07T18:45:00.000Z");
  });

  it("keeps today's and this week's cards meaningful while another range is selected", () => {
    const november = [row(1, "2026-11-02T09:00:00Z")];
    const current = [row(1, "2026-11-25T09:00:00Z"), row(2, "2026-11-24T09:00:00Z"), row(1, "2026-11-23T09:00:00Z")];
    const result = buildEntryStats({ rows: november, currentRows: current, previousTotal: 0, users, range,
      now: new Date("2026-11-25T10:00:00Z") });
    expect(result.totals).toEqual(expect.objectContaining({ total: 1, today: 1, yesterday: 1, thisWeek: 3, thisMonth: 3 }));
    expect(result.users.find(user => user.userId === 1)!.today).toBe(1);
  });

  it("averages over every day of the range, empty ones included", () => {
    const result = buildEntryStats({ rows: [row(1, "2026-11-02T09:00:00Z"), row(1, "2026-11-02T10:00:00Z")],
      currentRows: [], previousTotal: 0, users, range: rangeFromDays("2026-11-01", "2026-11-04"),
      now: new Date("2026-11-25T10:00:00Z") });
    expect(result.totals.averagePerDay).toBe(0.5);
  });

  it("carries the previous period's total and its range for the comparison card", () => {
    const result = stats([row(1, "2026-11-02T09:00:00Z")], { previousTotal: 9 });
    expect(result.totals.previousTotal).toBe(9);
    expect(result.totals.previousRange.to).toBe(range.from);
  });
});

describe("entry timeline", () => {
  const entry = (id: number, iso: string) => ({ id, title: `Događaj ${id}`, createdAt: new Date(iso) });
  const day = (entries: ReturnType<typeof entry>[], gapCapMinutes?: number | null) =>
    buildTimeline({ date: "2026-11-25", userId: 1, entries, gapCapMinutes });

  it("orders the entries and measures the gaps between them", () => {
    const result = day([entry(2, "2026-11-25T09:10:00Z"), entry(1, "2026-11-25T09:00:00Z"), entry(3, "2026-11-25T09:40:00Z")]);
    expect(result.entries.map(e => e.id)).toEqual([1, 2, 3]);
    expect(result.gapsMinutes).toEqual([10, 30]);
    expect(result.averageGapMinutes).toBe(20);
    expect(result.medianGapMinutes).toBe(20);
    expect(result.shortestGapMinutes).toBe(10);
    expect(result.longestGapMinutes).toBe(30);
    expect(result.spanMinutes).toBe(40);
  });

  it("leaves long pauses out of the average but still reports them", () => {
    const result = day([
      entry(1, "2026-11-25T09:00:00Z"), entry(2, "2026-11-25T09:05:00Z"),
      entry(3, "2026-11-25T11:05:00Z"), entry(4, "2026-11-25T11:10:00Z"),
    ], 30);
    expect(result.gapsMinutes).toEqual([5, 120, 5]);
    expect(result.averageGapMinutes).toBe(5);
    expect(result.excludedGaps).toBe(1);
    expect(result.longestGapMinutes).toBe(120);
  });

  it("counts entries by the Zagreb hour", () => {
    // 23:30 UTC in November is 00:30 Zagreb.
    const result = day([entry(1, "2026-11-25T08:00:00Z"), entry(2, "2026-11-25T08:30:00Z"), entry(3, "2026-11-25T23:30:00Z")]);
    expect(result.perHour).toEqual({ 9: 2, 0: 1 });
  });

  it("says nothing rather than zero when a day holds one entry or none", () => {
    expect(day([entry(1, "2026-11-25T09:00:00Z")])).toEqual(expect.objectContaining({
      gapsMinutes: [], averageGapMinutes: null, medianGapMinutes: null, shortestGapMinutes: null, longestGapMinutes: null, spanMinutes: 0,
    }));
    expect(day([])).toEqual(expect.objectContaining({ firstAt: null, lastAt: null, spanMinutes: null, averageGapMinutes: null }));
  });

  it("takes the median of an even number of gaps as the middle pair's mean", () => {
    const result = day([
      entry(1, "2026-11-25T09:00:00Z"), entry(2, "2026-11-25T09:10:00Z"),
      entry(3, "2026-11-25T09:30:00Z"), entry(4, "2026-11-25T10:00:00Z"),
    ]);
    expect(result.gapsMinutes).toEqual([10, 20, 30]);
    expect(result.medianGapMinutes).toBe(20);
  });
});

describe("entry trends", () => {
  const originalZone = process.env.TZ;
  afterEach(() => { process.env.TZ = originalZone; jest.useRealTimers(); });
  const row = (userId: number | null, iso: string) => ({ createdByUserId: userId, createdAt: new Date(iso) });

  it("gives one bucket per month, oldest first, empty months included", () => {
    const trends = buildTrends({ rows: [row(1, "2026-11-02T09:00:00Z")], months: 3, now: new Date("2026-11-25T10:00:00Z") });
    expect(trends.months.map(month => month.month)).toEqual(["2026-09", "2026-10", "2026-11"]);
    expect(trends.months.at(-1)).toEqual({ month: "2026-11", total: 1, byUser: { 1: 1 } });
    expect(trends.months[0].total).toBe(0);
  });

  it("totals whole years inside the window", () => {
    const trends = buildTrends({ rows: [row(1, "2026-01-02T09:00:00Z"), row(1, "2025-12-28T09:00:00Z")], months: 14, now: new Date("2026-11-25T10:00:00Z") });
    expect(trends.years).toEqual([{ year: "2025", total: 1 }, { year: "2026", total: 1 }]);
  });

  it("starts all time at the oldest entry rather than inventing a decade", () => {
    const today = "2026-11-25T10:00:00Z";
    expect(daysInRange(presetRange("all-time", new Date(today), "2026-11-20"))).toHaveLength(6);
    // Without a first entry day it falls back to the last year, never to 2000.
    expect(daysInRange(presetRange("all-time", new Date(today))).length).toBeLessThanOrEqual(366);
  });

  it("buckets by weekday Monday-first and by the Zagreb hour", () => {
    // 2026-11-02 is a Monday; 23:30 UTC is 00:30 the next day in Zagreb.
    const trends = buildTrends({ rows: [row(1, "2026-11-02T09:00:00Z"), row(1, "2026-11-02T23:30:00Z")], months: 1, now: new Date("2026-11-25T10:00:00Z") });
    expect(trends.weekdays).toHaveLength(7);
    expect(trends.weekdays[0]).toEqual({ weekday: 0, total: 1 });
    expect(trends.weekdays[1]).toEqual({ weekday: 1, total: 1 });
    expect(trends.hours).toHaveLength(24);
    expect(trends.hours[10]).toEqual({ hour: 10, total: 1 });
    expect(trends.hours[0]).toEqual({ hour: 0, total: 1 });
  });

  it("compares the month so far with the same stretch of the previous month", () => {
    const trends = buildTrends({
      rows: [
        row(1, "2026-11-02T09:00:00Z"), row(1, "2026-11-20T09:00:00Z"),
        row(1, "2026-10-02T09:00:00Z"), row(1, "2026-10-28T09:00:00Z"),
      ],
      months: 2,
      now: new Date("2026-11-25T10:00:00Z"),
    });
    // 28 October is past the 25th and is left out of the comparison.
    expect(trends.monthToDate).toEqual({ month: "2026-11", total: 2, previousMonth: "2026-10", previousTotal: 1, throughDay: 25 });
  });
});

describe("portal content statistics", () => {
  const base: ContentRow = {
    id: 1, title: "Koncert", status: "PUBLISHED", startsAt: new Date("2026-12-01T19:00:00Z"),
    createdAt: new Date("2026-11-02T09:00:00Z"), publishedAt: new Date("2026-11-02T10:00:00Z"),
    cityId: 1, cityName: "Osijek", countyId: 2, categoryId: 3,
    description: "x".repeat(80), imageUrl: "https://cdn.example/a.jpg", address: "Trg 1", venueId: 4,
  };
  const content = (rows: Partial<ContentRow>[], pendingDuplicates = 0) => buildContentStats({
    rows: rows.map((row, index) => ({ ...base, id: index + 1, ...row })),
    range: rangeFromDays("2026-11-01", "2026-11-30"),
    names: { cities: new Map([[1, "Osijek"], [5, "Zagreb"]]), counties: new Map([[2, "Osječko-baranjska"]]), categories: new Map([[3, "Glazba"]]) },
    pendingDuplicates,
    now: new Date("2026-11-25T10:00:00Z"),
  });

  it("groups by city, county and category, busiest first", () => {
    const stats = content([{ cityId: 1 }, { cityId: 1 }, { cityId: 5 }]);
    expect(stats.byCity).toEqual([
      { id: 1, name: "Osijek", total: 2 },
      { id: 5, name: "Zagreb", total: 1 },
    ]);
    expect(stats.byCounty[0]).toEqual({ id: 2, name: "Osječko-baranjska", total: 3 });
    expect(stats.byCategory[0]).toEqual({ id: 3, name: "Glazba", total: 3 });
  });

  it("names what it cannot resolve rather than dropping it", () => {
    const stats = content([{ cityId: null }, { categoryId: null }]);
    expect(stats.byCity.map(entry => entry.name)).toContain("Nepoznat grad");
    expect(stats.byCategory.map(entry => entry.name)).toContain("Bez kategorije");
  });

  it("counts published, unpublished and still upcoming events", () => {
    const stats = content([
      { status: "PUBLISHED" }, { status: "PENDING_REVIEW" },
      { status: "PUBLISHED", startsAt: new Date("2026-11-01T19:00:00Z") },
    ]);
    expect(stats).toEqual(expect.objectContaining({ published: 2, unpublished: 1, upcoming: 2 }));
  });

  it("counts events entered on the day they happen, in Zagreb days", () => {
    const stats = content([
      { createdAt: new Date("2026-12-01T08:00:00Z"), startsAt: new Date("2026-12-01T19:00:00Z") },
      { createdAt: new Date("2026-11-30T23:30:00Z"), startsAt: new Date("2026-12-01T19:00:00Z") },
    ]);
    // 23:30 UTC on 30 November is already 1 December in Zagreb: both count.
    expect(stats.enteredOnEventDay).toBe(2);
  });

  it("reports the lead time as a mean and a median", () => {
    const stats = content([
      { createdAt: new Date("2026-11-01T00:00:00Z"), startsAt: new Date("2026-11-03T00:00:00Z") },
      { createdAt: new Date("2026-11-01T00:00:00Z"), startsAt: new Date("2026-11-05T00:00:00Z") },
      { createdAt: new Date("2026-11-01T00:00:00Z"), startsAt: new Date("2027-11-01T00:00:00Z") },
    ]);
    expect(stats.medianLeadDays).toBe(4);
    expect(stats.averageLeadDays).toBeGreaterThan(100);
  });

  it("lists what makes an event incomplete, and counts each kind", () => {
    const stats = content([
      { imageUrl: null },
      { venueId: null, address: null },
      { description: "prekratko" },
      {},
    ]);
    expect(stats.incomplete.total).toBe(3);
    expect(stats.incomplete).toEqual(expect.objectContaining({ withoutImage: 1, withoutLocation: 1, withoutDescription: 1 }));
    expect(stats.incomplete.items[0].missing).toEqual(["slika"]);
  });

  it("passes the pending duplicate count through", () => {
    expect(content([{}], 7).pendingDuplicates).toBe(7);
  });
});
