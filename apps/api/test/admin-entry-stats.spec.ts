import { AdminService } from "../src/admin/admin.service";
import { presetRange, rangeFromDays } from "../src/admin/entry-stats";

/** The service layer around the pure statistics: which range it asks the
 *  database for, what it selects, and what it refuses. */
function service(options: { rows?: { createdByUserId: number | null; createdAt: Date }[]; users?: unknown[]; entries?: unknown[]; previousTotal?: number; deletedTotal?: number; pendingDuplicates?: number } = {}) {
  const findMany = jest.fn().mockResolvedValue(options.rows ?? []);
  const userFindMany = jest.fn().mockResolvedValue(options.users ?? [{ id: 1, name: "Vanesa", role: "ADMIN", organizer: null }]);
  const count = jest.fn().mockResolvedValue(options.previousTotal ?? 0);
  const prisma = {
    event: { findMany, count },
    eventDeletion: { count: jest.fn().mockResolvedValue(options.deletedTotal ?? 0) },
    eventDuplicateCandidate: { count: jest.fn().mockResolvedValue(options.pendingDuplicates ?? 0) },
    city: { findMany: jest.fn().mockResolvedValue([{ id: 1, name: "Osijek" }]) },
    county: { findMany: jest.fn().mockResolvedValue([{ id: 2, name: "Osječko-baranjska" }]) },
    category: { findMany: jest.fn().mockResolvedValue([{ id: 3, name: "Glazba" }]) },
    user: { findMany: userFindMany },
    // The listing and its comparison run together; the stub resolves whatever
    // the queued promises already returned.
    $transaction: jest.fn().mockImplementation((operations: unknown[]) => Promise.all(operations)),
  };
  const admin = new AdminService(prisma as never, {} as never, {} as never, {} as never, { revalidate: jest.fn() } as never, {} as never, {} as never);
  return { admin, prisma, findMany, userFindMany, count };
}

describe("admin entry statistics endpoint", () => {
  afterEach(() => jest.useRealTimers());
  const at = (iso: string) => jest.useFakeTimers({ doNotFake: ["nextTick"] }).setSystemTime(new Date(iso));

  it("opens on the current month without anyone picking a date", async () => {
    at("2026-11-25T10:00:00Z");
    const { admin, findMany } = service();

    const stats = await admin.entryStats();

    const expected = presetRange("this-month", new Date("2026-11-25T10:00:00Z"));
    expect(stats.range).toEqual(expected);
    expect(findMany.mock.calls[0][0].where.createdAt).toEqual({ gte: new Date(expected.from), lt: new Date(expected.to) });
  });

  it("reads only the author id and the timestamp — never an email address", async () => {
    at("2026-11-25T10:00:00Z");
    const { admin, findMany, userFindMany } = service();

    await admin.entryStats();

    expect(findMany.mock.calls[0][0].select).toEqual({ createdByUserId: true, createdAt: true });
    expect(userFindMany.mock.calls[0][0].select).not.toHaveProperty("email");
  });

  it("honours an explicit range and a month", async () => {
    at("2026-11-25T10:00:00Z");
    const { admin } = service();

    expect((await admin.entryStats({ from: "2026-03-01", to: "2026-03-05" })).range).toEqual(rangeFromDays("2026-03-01", "2026-03-05"));
    expect((await admin.entryStats({ month: "2026-10" })).range).toEqual(rangeFromDays("2026-10-01", "2026-10-31"));
  });

  it.each([
    [{ preset: "prošli-vikend" }, "Nepoznato razdoblje"],
    [{ from: "01.03.2026.", to: "2026-03-05" }, "YYYY-MM-DD"],
    [{ from: "2026-03-05", to: "2026-03-01" }, "prije početka"],
    [{ month: "ožujak" }, "YYYY-MM"],
  ])("refuses %o", async (params, message) => {
    const { admin } = service();
    await expect(admin.entryStats(params)).rejects.toThrow(message);
  });

  it("counts published events and recorded deletions for the period", async () => {
    at("2026-11-25T10:00:00Z");
    const { admin, count } = service({ previousTotal: 4, deletedTotal: 2 });

    const stats = await admin.entryStats({ month: "2026-11" });

    expect(stats.totals.deleted).toBe(2);
    // The published count asks about publishedAt, not createdAt: an event
    // entered in October and published in November belongs to November.
    expect(count.mock.calls.some(call => call[0].where.publishedAt)).toBe(true);
  });

  it("counts the comparable previous period for the comparison card", async () => {
    at("2026-11-25T10:00:00Z");
    const { admin, count } = service({ previousTotal: 17 });

    const stats = await admin.entryStats({ month: "2026-11" });

    expect(stats.totals.previousTotal).toBe(17);
    expect(count.mock.calls[0][0].where.createdAt.lt).toEqual(new Date(stats.range.from));
  });

  it("asks a day's timeline for one author over that Zagreb day only", async () => {
    const { admin, findMany } = service();

    await admin.entryTimeline({ date: "2026-11-25", userId: 4 });

    const where = findMany.mock.calls[0][0].where;
    expect(where.createdByUserId).toBe(4);
    expect(where.createdAt).toEqual({ gte: new Date(rangeFromDays("2026-11-25", "2026-11-25").from), lt: new Date(rangeFromDays("2026-11-25", "2026-11-25").to) });
  });

  it("covers every author when no one is named", async () => {
    const { admin, findMany } = service();

    await admin.entryTimeline({ date: "2026-11-25" });

    expect(findMany.mock.calls[0][0].where).not.toHaveProperty("createdByUserId");
  });

  it("refuses a timeline for something that is not a date", async () => {
    const { admin } = service();
    await expect(admin.entryTimeline({ date: "jučer" })).rejects.toThrow("YYYY-MM-DD");
  });
});

describe("trends and content endpoints", () => {
  afterEach(() => jest.useRealTimers());

  it("reads a year of timestamps for the trend chart, and nothing else", async () => {
    jest.useFakeTimers({ doNotFake: ["nextTick"] }).setSystemTime(new Date("2026-11-25T10:00:00Z"));
    const { admin, findMany } = service();

    const trends = await admin.entryTrends();

    expect(trends.months).toHaveLength(12);
    expect(trends.months[0].month).toBe("2025-12");
    expect(findMany.mock.calls[0][0].select).toEqual({ createdByUserId: true, createdAt: true });
  });

  it("keeps the trend window within sane bounds", async () => {
    jest.useFakeTimers({ doNotFake: ["nextTick"] }).setSystemTime(new Date("2026-11-25T10:00:00Z"));
    const { admin } = service();

    expect((await admin.entryTrends({ months: 0 })).months).toHaveLength(1);
    expect((await admin.entryTrends({ months: 999 })).months).toHaveLength(36);
  });

  it("counts only undecided duplicate candidates for the content statistics", async () => {
    jest.useFakeTimers({ doNotFake: ["nextTick"] }).setSystemTime(new Date("2026-11-25T10:00:00Z"));
    const { admin, prisma } = service({ pendingDuplicates: 4 });

    const stats = await admin.contentStats({ month: "2026-11" });

    expect(stats.pendingDuplicates).toBe(4);
    expect(prisma.eventDuplicateCandidate.count).toHaveBeenCalledWith({ where: { status: "OPEN" } });
  });

  it("refuses a nonsense period for the content statistics too", async () => {
    const { admin } = service();
    await expect(admin.contentStats({ month: "studeni" })).rejects.toThrow("YYYY-MM");
  });
});
