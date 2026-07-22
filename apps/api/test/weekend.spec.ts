import { currentWeekendRange, eventOverlapsRange, eventOverlapsDay, zagrebLocalToUtc } from "../src/common/weekend";

describe("Europe/Zagreb weekend range", () => {
  it("starts on Friday 00:00 and ends Sunday 23:59:59.999 for a normal weekend", () => {
    const range = currentWeekendRange(new Date("2026-07-01T10:00:00.000Z"));

    expect(range.start.toISOString()).toBe("2026-07-02T22:00:00.000Z");
    expect(range.end.toISOString()).toBe("2026-07-05T21:59:59.999Z");
    expect(range.longLabel).toBe("od petka 3. srpnja do nedjelje 5. srpnja");
  });

  it("handles month boundary", () => {
    const range = currentWeekendRange(new Date("2026-05-27T10:00:00.000Z"));

    expect(range.start.toISOString()).toBe("2026-05-28T22:00:00.000Z");
    expect(range.end.toISOString()).toBe("2026-05-31T21:59:59.999Z");
  });

  it("handles year boundary", () => {
    const range = currentWeekendRange(new Date("2026-12-30T10:00:00.000Z"));

    expect(range.start.toISOString()).toBe("2026-12-31T23:00:00.000Z");
    expect(range.end.toISOString()).toBe("2027-01-03T22:59:59.999Z");
  });

  it("handles daylight-saving transition inside the weekend", () => {
    const range = currentWeekendRange(new Date("2026-03-25T10:00:00.000Z"));

    expect(range.start.toISOString()).toBe("2026-03-26T23:00:00.000Z");
    expect(range.end.toISOString()).toBe("2026-03-29T21:59:59.999Z");
  });

  it("preserves overlap behavior for single and multi-day events", () => {
    const range = currentWeekendRange(new Date("2026-07-01T10:00:00.000Z"));

    expect(eventOverlapsRange(zagrebLocalToUtc(2026, 7, 3, 18), null, range)).toBe(true);
    expect(eventOverlapsRange(zagrebLocalToUtc(2026, 7, 5, 20), null, range)).toBe(true);
    expect(eventOverlapsRange(zagrebLocalToUtc(2026, 7, 2, 18), zagrebLocalToUtc(2026, 7, 2, 22), range)).toBe(false);
    expect(eventOverlapsRange(zagrebLocalToUtc(2026, 7, 6, 0, 1), null, range)).toBe(false);
    expect(eventOverlapsRange(zagrebLocalToUtc(2026, 7, 1, 18), zagrebLocalToUtc(2026, 7, 3, 10), range)).toBe(true);
    expect(eventOverlapsRange(zagrebLocalToUtc(2026, 7, 5, 20), zagrebLocalToUtc(2026, 7, 6, 10), range)).toBe(true);
  });

  it("detects day-level overlap for multi-day events", () => {
    const range = currentWeekendRange(new Date("2026-07-01T10:00:00.000Z"));
    const start = zagrebLocalToUtc(2026, 7, 3, 18);
    const end = zagrebLocalToUtc(2026, 7, 5, 10);

    expect(eventOverlapsDay(start, end, range.friday)).toBe(true);
    expect(eventOverlapsDay(start, end, range.saturday)).toBe(true);
    expect(eventOverlapsDay(start, end, range.sunday)).toBe(true);
  });
});

