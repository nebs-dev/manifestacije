import { BadRequestException } from "@nestjs/common";
import { EventsService } from "../src/events/events.service";

describe("event occurrence schedules", () => {
  const service = new EventsService({} as never, {} as never, { revalidate: jest.fn().mockResolvedValue(true) } as never);
  const normalize = (rows: Array<{ id?: number; startsAt: string; endsAt?: string | null; isAllDay?: boolean }>) =>
    (service as never as { normalizeOccurrences(input: typeof rows): Array<{ id?: number; startsAt: Date; endsAt: Date | null; isAllDay: boolean }> }).normalizeOccurrences(rows);
  const summarize = (rows: ReturnType<typeof normalize>) =>
    (service as never as { summarizeOccurrences(input: ReturnType<typeof normalize>): { startsAt: Date; endsAt: Date | null; isAllDay: boolean } }).summarizeOccurrences(rows);

  it("supports a normal single timed occurrence", () => {
    const rows = normalize([{ startsAt: "2026-08-14T08:00:00+02:00", endsAt: "2026-08-14T22:00:00+02:00" }]);
    expect(summarize(rows)).toEqual({
      startsAt: new Date("2026-08-14T08:00:00+02:00"),
      endsAt: new Date("2026-08-14T22:00:00+02:00"),
      isAllDay: false,
    });
  });

  it("derives overall bounds from three equal daily schedules", () => {
    const rows = normalize([14, 15, 16].map((day) => ({
      startsAt: `2026-08-${day}T08:00:00+02:00`,
      endsAt: `2026-08-${day}T22:00:00+02:00`,
    })));
    expect(summarize(rows)).toEqual({
      startsAt: new Date("2026-08-14T08:00:00+02:00"),
      endsAt: new Date("2026-08-16T22:00:00+02:00"),
      isAllDay: false,
    });
  });

  it("supports different hours and two occurrences on one day", () => {
    const rows = normalize([
      { startsAt: "2026-08-15T18:00:00+02:00", endsAt: "2026-08-15T23:00:00+02:00" },
      { startsAt: "2026-08-14T18:00:00+02:00", endsAt: "2026-08-14T23:00:00+02:00" },
      { startsAt: "2026-08-15T10:00:00+02:00", endsAt: "2026-08-15T14:00:00+02:00" },
      { startsAt: "2026-08-16T09:00:00+02:00", endsAt: "2026-08-16T17:00:00+02:00" },
    ]);
    expect(rows.map((row) => row.startsAt.toISOString())).toEqual([
      "2026-08-14T16:00:00.000Z",
      "2026-08-15T08:00:00.000Z",
      "2026-08-15T16:00:00.000Z",
      "2026-08-16T07:00:00.000Z",
    ]);
  });

  it("normalizes all-day rows to Zagreb day boundaries", () => {
    const [row] = normalize([{ startsAt: "2026-08-14T12:00:00Z", isAllDay: true }]);
    expect(row.startsAt.toISOString()).toBe("2026-08-13T22:00:00.000Z");
    expect(row.endsAt?.toISOString()).toBe("2026-08-14T21:59:59.999Z");
  });

  it("rejects invalid ranges and occurrence IDs owned by another event", () => {
    expect(() => normalize([{ startsAt: "2026-08-14T22:00:00+02:00", endsAt: "2026-08-14T08:00:00+02:00" }])).toThrow(BadRequestException);
    const rows = normalize([{ id: 99, startsAt: "2026-08-14T08:00:00+02:00" }]);
    expect(() => (service as never as { assertOccurrenceOwnership(ids: number[], input: typeof rows): void }).assertOccurrenceOwnership([1], rows)).toThrow("Termin ne pripada ovom događaju");
  });

  it("updates retained rows, creates new rows, and deletes removed rows transactionally", async () => {
    const current = {
      id: 7,
      slug: "raspored",
      cityId: null,
      cityName: null,
      regionId: null,
      status: "DRAFT",
      occurrences: [{ id: 10 }, { id: 11 }],
    };
    const tx = {
      eventOccurrence: {
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
        update: jest.fn().mockResolvedValue({}),
        create: jest.fn().mockResolvedValue({}),
      },
      event: { update: jest.fn().mockResolvedValue({ id: 7 }) },
    };
    const prisma = {
      event: { findUnique: jest.fn().mockResolvedValue(current) },
      eventCategory: { deleteMany: jest.fn(), upsert: jest.fn() },
      $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    const duplicates = { detectForEvent: jest.fn().mockResolvedValue(undefined) };
    const updateService = new EventsService(prisma as never, duplicates as never, { revalidate: jest.fn().mockResolvedValue(true) } as never);

    await updateService.updateEvent(7, {
      occurrences: [
        { id: 10, startsAt: "2026-08-14T08:00:00+02:00", endsAt: "2026-08-14T12:00:00+02:00" },
        { startsAt: "2026-08-16T09:00:00+02:00", endsAt: "2026-08-16T17:00:00+02:00" },
      ],
    });

    expect(tx.eventOccurrence.deleteMany).toHaveBeenCalledWith({ where: { eventId: 7, id: { notIn: [10] } } });
    expect(tx.eventOccurrence.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 10 } }));
    expect(tx.eventOccurrence.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ eventId: 7 }) }));
    expect(tx.event.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 7 },
      data: expect.objectContaining({
        startsAt: new Date("2026-08-14T08:00:00+02:00"),
        endsAt: new Date("2026-08-16T17:00:00+02:00"),
        isAllDay: false,
      }),
    }));
  });

  it("rejects top-level schedule edits for occurrence-backed events", async () => {
    const prisma = {
      event: {
        findUnique: jest.fn().mockResolvedValue({
          id: 7,
          slug: "raspored",
          cityId: null,
          cityName: null,
          regionId: null,
          status: "DRAFT",
          occurrences: [{ id: 10 }],
        }),
      },
    };
    const updateService = new EventsService(prisma as never, {} as never, { revalidate: jest.fn().mockResolvedValue(true) } as never);
    await expect(updateService.updateEvent(7, { startsAt: "2026-08-15T10:00:00Z" })).rejects.toThrow(
      "Događaj koristi raspored termina",
    );
  });
});
