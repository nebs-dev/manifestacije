import { BadRequestException } from "@nestjs/common";
import { AdminService } from "../src/admin/admin.service";

function makeService(prisma: object, events: object = {}) {
  return new AdminService(
    prisma as never,
    events as never,
    {} as never,
    {} as never,
    { revalidate: jest.fn() } as never,
    {} as never,
    {} as never,
  );
}

describe("admin occurrence operations", () => {
  it("bulk-shifts parent summaries and child rows by Zagreb calendar day", async () => {
    const prisma = {
      event: {
        findMany: jest.fn().mockResolvedValue([{
          id: 7,
          startsAt: new Date("2026-03-28T17:30:00.000Z"),
          endsAt: new Date("2026-03-28T19:30:00.000Z"),
          occurrences: [{
            id: 10,
            startsAt: new Date("2026-03-28T17:30:00.000Z"),
            endsAt: new Date("2026-03-28T19:30:00.000Z"),
          }],
        }]),
        update: jest.fn().mockResolvedValue({}),
      },
      eventOccurrence: { update: jest.fn().mockResolvedValue({}) },
      $transaction: jest.fn().mockImplementation((operations: Promise<unknown>[]) => Promise.all(operations)),
    };

    await makeService(prisma).bulkShiftDates([7], 1);

    expect(prisma.event.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ startsAt: new Date("2026-03-29T16:30:00.000Z") }),
    }));
    expect(prisma.eventOccurrence.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 10 },
      data: expect.objectContaining({ startsAt: new Date("2026-03-29T16:30:00.000Z") }),
    }));
  });

  it("duplicates occurrence children without reusing their IDs", async () => {
    const current = {
      id: 7,
      title: "Festival",
      description: "Opis",
      organizerId: null,
      venueId: null,
      cityId: 1,
      countyId: 2,
      regionId: 3,
      categoryId: 4,
      startsAt: new Date("2026-08-14T06:00:00.000Z"),
      endsAt: new Date("2026-08-16T20:00:00.000Z"),
      isAllDay: false,
      isFree: true,
      priceText: null,
      ticketUrl: null,
      sourceUrl: null,
      imageUrl: null,
      address: null,
      lat: null,
      lng: null,
      sourceType: "MANUAL",
      extractionConfidence: null,
      categories: [{ categoryId: 4, source: "MANUAL", confidence: null }],
      occurrences: [{
        id: 10,
        eventId: 7,
        startsAt: new Date("2026-08-14T06:00:00.000Z"),
        endsAt: new Date("2026-08-14T20:00:00.000Z"),
        isAllDay: false,
      }],
    };
    const prisma = {
      event: {
        findUnique: jest.fn().mockImplementation(({ where }: { where: { id?: number } }) => Promise.resolve(where.id ? current : null)),
        create: jest.fn().mockResolvedValue({ id: 8 }),
      },
      eventCategory: { create: jest.fn().mockResolvedValue({}) },
    };

    await makeService(prisma).duplicateEvent(7);

    expect(prisma.event.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        occurrences: {
          create: [{
            startsAt: current.occurrences[0].startsAt,
            endsAt: current.occurrences[0].endsAt,
            isAllDay: false,
          }],
        },
      }),
    }));
  });

  it("rejects combining weekly parent-event recurrence with occurrence rows", async () => {
    await expect(makeService({}).createEvent({
      startsAt: "2026-08-14T18:00:00+02:00",
      repeatWeeklyUntil: "2026-09-14",
      occurrences: [{ startsAt: "2026-08-14T18:00:00+02:00" }],
    })).rejects.toBeInstanceOf(BadRequestException);
  });
});
