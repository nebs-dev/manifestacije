import { EventStatus } from "@prisma/client";
import { AdminService } from "../src/admin/admin.service";
import { OrganizerService } from "../src/organizers/organizer.service";

/**
 * Who published an event, and which events were deleted (STAT-09).
 *
 * Neither was recorded before: publishing left a timestamp with no author,
 * and a delete left nothing at all, so the statistics had no honest way to
 * show either. Deletion stays a real delete — the record is written as the
 * event goes, and it is a record, not a recycle bin.
 */
const event = (overrides: Record<string, unknown> = {}) => ({
  id: 5, title: "Koncert u Tvrđi", slug: "koncert-u-tvrdi", startsAt: new Date("2099-07-04T18:00:00Z"),
  cityName: "Osijek", status: EventStatus.PUBLISHED, createdAt: new Date("2026-11-02T08:00:00Z"),
  createdByUserId: 7, publishedAt: new Date("2026-11-03T09:00:00Z"), organizerId: null, ...overrides,
});

function adminService(overrides: Record<string, unknown> = {}) {
  const prisma = {
    event: {
      findUnique: jest.fn().mockResolvedValue(event()),
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockImplementation(async ({ data }) => ({ ...event(), ...data })),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      delete: jest.fn().mockResolvedValue(event()),
      count: jest.fn().mockResolvedValue(0),
    },
    eventSource: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
    eventDuplicateCandidate: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
    eventDeletion: { create: jest.fn().mockResolvedValue({ id: 1 }) },
    $transaction: jest.fn().mockImplementation((work: unknown) =>
      typeof work === "function" ? (work as (tx: unknown) => unknown)(prisma) : Promise.all(work as unknown[])),
    ...overrides,
  };
  const admin = new AdminService(prisma as never, {} as never, {} as never, {} as never,
    { revalidate: jest.fn().mockResolvedValue(true) } as never, { sendEventPublished: jest.fn() } as never, {} as never);
  return { prisma, admin };
}

describe("publication authorship", () => {
  it("records who published an event", async () => {
    const { prisma, admin } = adminService();

    await admin.setEventStatus(5, EventStatus.PUBLISHED, 91);

    expect(prisma.event.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: EventStatus.PUBLISHED, publishedByUserId: 91 }),
    }));
  });

  it("leaves the publisher alone when an event is moved to another status", async () => {
    const { prisma, admin } = adminService();

    await admin.setEventStatus(5, EventStatus.DRAFT, 91);

    expect(prisma.event.update.mock.calls[0][0].data.publishedByUserId).toBeUndefined();
  });

  it("records the publisher on a bulk publish too", async () => {
    const { prisma, admin } = adminService();

    await admin.bulkSetStatus([5, 6], EventStatus.PUBLISHED, 91);

    expect(prisma.event.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ publishedByUserId: 91 }),
    }));
  });
});

describe("deletion record", () => {
  it("writes what was deleted, by whom, before the event goes", async () => {
    const { prisma, admin } = adminService();

    await admin.deleteEvent(5, 91);

    expect(prisma.eventDeletion.create).toHaveBeenCalledWith({
      data: {
        eventId: 5,
        title: "Koncert u Tvrđi",
        slug: "koncert-u-tvrdi",
        startsAt: new Date("2099-07-04T18:00:00Z"),
        cityName: "Osijek",
        status: EventStatus.PUBLISHED,
        eventCreatedAt: new Date("2026-11-02T08:00:00Z"),
        createdByUserId: 7,
        deletedByUserId: 91,
      },
    });
    expect(prisma.event.delete).toHaveBeenCalledWith({ where: { id: 5 } });
  });

  it("records the deletion and the delete in the same transaction", async () => {
    const { prisma, admin } = adminService();

    await admin.deleteEvent(5, 91);

    // Both ran through the transaction callback: a crash between them must not
    // leave a record of a deletion that did not happen, or the other way round.
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it("still deletes when nobody is named — the record says the author is unknown", async () => {
    const { prisma, admin } = adminService();

    await admin.deleteEvent(5);

    expect(prisma.eventDeletion.create.mock.calls[0][0].data.deletedByUserId).toBeNull();
    expect(prisma.event.delete).toHaveBeenCalled();
  });

  it("records an organizer deleting their own event", async () => {
    const prisma = {
      event: {
        findFirst: jest.fn().mockResolvedValue(event({ status: EventStatus.PENDING_REVIEW, organizerId: 3 })),
        findUnique: jest.fn().mockResolvedValue(event({ status: EventStatus.PENDING_REVIEW, organizerId: 3 })),
        delete: jest.fn().mockResolvedValue(event()),
      },
      eventSource: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
      eventDeletion: { create: jest.fn().mockResolvedValue({ id: 1 }) },
      $transaction: jest.fn().mockImplementation((work: unknown) =>
        typeof work === "function" ? (work as (tx: unknown) => unknown)(prisma) : Promise.all(work as unknown[])),
    };
    const organizer = new OrganizerService(prisma as never, {} as never, {} as never, {} as never, {} as never, {} as never, { revalidate: jest.fn() } as never);

    await organizer.deleteEvent(3, 5, 44);

    expect(prisma.eventDeletion.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ eventId: 5, deletedByUserId: 44, status: EventStatus.PENDING_REVIEW }),
    }));
    expect(prisma.event.delete).toHaveBeenCalledWith({ where: { id: 5 } });
  });
});
