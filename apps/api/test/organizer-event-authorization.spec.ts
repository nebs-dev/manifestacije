import { BadRequestException, ForbiddenException, ValidationPipe } from "@nestjs/common";
import { EventStatus, UserRole } from "@prisma/client";
import { getMetadataStorage } from "class-validator";
import { EventsService } from "../src/events/events.service";
import { EventUpsertDto } from "../src/events/event.dto";
import { OrganizerService } from "../src/organizers/organizer.service";
import { OrganizerController, requireOrganizerId } from "../src/organizers/organizer.controller";
import { ORGANIZER_EVENT_FIELDS, OrganizerEventDto, pickOrganizerEventInput } from "../src/organizers/organizer.dto";

const OWN_ORGANIZER_ID = 7;
const OTHER_ORGANIZER_ID = 999;

/** Fields an organizer must never control, as an attacker would send them. */
const FORBIDDEN = {
  organizerId: OTHER_ORGANIZER_ID,
  isFeatured: true,
  slug: "hijacked-slug",
  status: "PUBLISHED",
  publishedAt: "2020-01-01T00:00:00.000Z",
  createdByUserId: 1,
  sourceType: "IMPORTED",
  extractionConfidence: 1,
  countyName: "Nova županija",
  regionSlug: "dalmacija",
  repeatWeeklyUntil: "2099-12-31T00:00:00.000Z",
  id: 12345,
};
const FORBIDDEN_KEYS = Object.keys(FORBIDDEN);

const ALLOWED = {
  title: "Koncert u parku",
  description: "Opis koncerta",
  cityId: 1,
  categoryId: 1,
  startsAt: "2099-09-05T18:00:00.000Z",
  isFree: false,
  priceText: "10 EUR",
};

// Matches main.ts: app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }))
const globalPipe = new ValidationPipe({ whitelist: true, transform: true });
const viaPipe = (payload: object, metatype: new () => object) =>
  globalPipe.transform(payload, { type: "body", metatype, data: "" });

function fixture(organizerStatus: "CLAIMED" | "VERIFIED" | "TRUSTED" = "CLAIMED", existingStatus: EventStatus = EventStatus.PENDING_REVIEW) {
  const current = {
    id: 1, title: "Postojeći", slug: "postojeci", status: existingStatus, organizerId: OWN_ORGANIZER_ID, isFeatured: false,
    publishedAt: existingStatus === EventStatus.PUBLISHED ? new Date() : null,
    cityId: 1, regionId: 1, startsAt: new Date("2099-09-05T12:00:00Z"), endsAt: new Date("2099-09-05T14:00:00Z"), occurrences: [],
  };
  const prisma: any = {
    event: {
      findUnique: jest.fn().mockImplementation(async ({ where }) => where.id ? current : null),
      findFirst: jest.fn().mockImplementation(async ({ where }) =>
        where.id === current.id && where.organizerId === current.organizerId ? current : null),
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn().mockImplementation(async ({ data }) => ({ id: 2, ...data, occurrences: [] })),
      update: jest.fn().mockImplementation(async ({ data }) => ({ ...current, ...data })),
    },
    city: { findUnique: jest.fn().mockResolvedValue({ id: 1, name: "Osijek", countyId: 1, county: { regionId: 1 } }) },
    category: { findUnique: jest.fn().mockResolvedValue({ id: 1 }) },
    eventCategory: { upsert: jest.fn(), deleteMany: jest.fn() },
    organizer: { findUniqueOrThrow: jest.fn().mockResolvedValue({ id: OWN_ORGANIZER_ID, name: "Organizator", status: organizerStatus }) },
  };
  const cache = { revalidate: jest.fn().mockResolvedValue(true) };
  const events = new EventsService(prisma, { detectForEvent: jest.fn() } as never, cache as never);
  const email = { webUrl: "https://manifestacije.hr", sendEventSubmitted: jest.fn(), sendEventPublished: jest.fn(), sendAdminNewSubmission: jest.fn() };
  const organizer = new OrganizerService(prisma, events, {} as never, {} as never, email as never,
    { syncEventSubmitter: jest.fn() } as never, cache as never);
  return { current, prisma, organizer };
}

describe("organizer event DTO policy", () => {
  it("allowlist lists exactly the validated properties of OrganizerEventDto", () => {
    const validated = new Set(
      getMetadataStorage().getTargetValidationMetadatas(OrganizerEventDto, "", true, false).map((meta) => meta.propertyName),
    );
    expect([...validated].sort()).toEqual([...ORGANIZER_EVENT_FIELDS].sort());
  });

  it("does not expose any admin-controlled field to organizers", () => {
    for (const key of FORBIDDEN_KEYS) expect(ORGANIZER_EVENT_FIELDS).not.toContain(key);
  });

  it("strips forbidden fields from a mixed payload at the validation pipe, keeping allowed ones", async () => {
    const dto = await viaPipe({
      ...ALLOWED,
      ...FORBIDDEN,
      endsAt: null,
      occurrences: [{ id: 5, startsAt: "2099-09-05T18:00:00.000Z", endsAt: "2099-09-05T20:00:00.000Z", eventId: OTHER_ORGANIZER_ID }],
    }, OrganizerEventDto) as Record<string, unknown>;

    for (const key of FORBIDDEN_KEYS) expect(dto[key]).toBeUndefined();
    expect(dto).toMatchObject({ ...ALLOWED, endsAt: null });
    expect(dto.occurrences).toEqual([expect.objectContaining({ id: 5, startsAt: "2099-09-05T18:00:00.000Z" })]);
    expect((dto.occurrences as Record<string, unknown>[])[0].eventId).toBeUndefined();
  });

  it("keeps admin-controlled fields on the admin DTO", async () => {
    const dto = await viaPipe({ title: "Admin", organizerId: 3, isFeatured: true, slug: "admin-slug" }, EventUpsertDto);
    expect(dto).toMatchObject({ organizerId: 3, isFeatured: true, slug: "admin-slug" });
  });

  it("server-side allowlist drops forbidden fields even if the pipe were bypassed", () => {
    const picked = pickOrganizerEventInput({ ...ALLOWED, ...FORBIDDEN, endsAt: null } as never) as Record<string, unknown>;
    for (const key of FORBIDDEN_KEYS) expect(key in picked).toBe(false);
    expect(picked).toEqual({ ...ALLOWED, endsAt: null });
  });
});

describe("organizer event create authorization", () => {
  it.each(["CLAIMED", "VERIFIED"] as const)("%s organizer: owner, status, slug and featuring come from the server", async (organizerStatus) => {
    const { organizer, prisma } = fixture(organizerStatus);

    await organizer.createEvent(OWN_ORGANIZER_ID, { ...ALLOWED, ...FORBIDDEN } as never);

    const data = prisma.event.create.mock.calls[0][0].data;
    expect(data).toMatchObject({
      title: ALLOWED.title,
      organizerId: OWN_ORGANIZER_ID,
      status: EventStatus.PENDING_REVIEW,
      isFeatured: false,
      sourceType: "ORGANIZER_FORM",
      slug: "koncert-u-parku",
    });
    expect(data.publishedAt).toBeUndefined();
    expect(data.createdByUserId).toBeUndefined();
    expect(data.extractionConfidence).toBeUndefined();
  });

  it("trusted organizer auto-publishes only its own, non-featured event", async () => {
    const { organizer, prisma } = fixture("TRUSTED");

    await organizer.createEvent(OWN_ORGANIZER_ID, { ...ALLOWED, ...FORBIDDEN, status: "DRAFT" } as never);

    const data = prisma.event.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ organizerId: OWN_ORGANIZER_ID, status: EventStatus.PUBLISHED, isFeatured: false, slug: "koncert-u-parku" });
    expect(prisma.organizer.findUniqueOrThrow).toHaveBeenCalledWith({ where: { id: OWN_ORGANIZER_ID } });
  });
});

describe("organizer event update authorization", () => {
  it.each([
    ["another organizer", { organizerId: OTHER_ORGANIZER_ID }],
    ["no organizer", { organizerId: null }],
  ])("cannot reassign the event to %s, feature it, rename its slug or set its status", async (_label, ownerOverride) => {
    const { organizer, prisma } = fixture();

    await organizer.updateEvent(OWN_ORGANIZER_ID, 1, { title: "Novi naslov", endsAt: null, ...FORBIDDEN, ...ownerOverride } as never);

    expect(prisma.event.findFirst).toHaveBeenCalledWith({ where: { id: 1, organizerId: OWN_ORGANIZER_ID } });
    const data = prisma.event.update.mock.calls[0][0].data;
    expect(data).toMatchObject({ title: "Novi naslov", endsAt: null, status: EventStatus.PENDING_REVIEW });
    for (const key of ["organizerId", "isFeatured", "slug", "publishedAt", "createdByUserId", "sourceType"]) {
      expect(key in data).toBe(false);
    }
  });

  it("fails closed if published revision handling is unavailable, without unpublishing", async () => {
    const { organizer, prisma } = fixture("TRUSTED", EventStatus.PUBLISHED);

    await expect(organizer.updateEvent(OWN_ORGANIZER_ID, 1, { title: "Ispravak", status: "PUBLISHED" } as never)).rejects.toThrow("Pregled");
    expect(prisma.event.update).not.toHaveBeenCalled();
  });

  it("rejects editing another organizer's event without writing anything", async () => {
    const { organizer, prisma } = fixture();

    await expect(organizer.updateEvent(OTHER_ORGANIZER_ID, 1, { title: "Preuzeto" } as never)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.event.update).not.toHaveBeenCalled();
  });
});

describe("organizer controller identity", () => {
  const user = (organizerId: number | null | undefined) =>
    ({ id: 42, email: "org@example.hr", role: UserRole.ORGANIZER, organizerId, authVersion: 0 });

  it.each([null, undefined, 0, -1, 1.5])("refuses an organizer user without a valid organizer link (%p)", (organizerId) => {
    expect(() => requireOrganizerId(user(organizerId) as never)).toThrow(ForbiddenException);
  });

  it("never lets an unlinked organizer user reach the service", async () => {
    const service = { createEvent: jest.fn(), updateEvent: jest.fn(), deleteEvent: jest.fn(), listEvents: jest.fn(), listSources: jest.fn() };
    const controller = new OrganizerController(service as never, {} as never);
    const unlinked = user(null) as never;

    expect(() => controller.events(unlinked)).toThrow(ForbiddenException);
    expect(() => controller.sources(unlinked)).toThrow(ForbiddenException);
    expect(() => controller.createEvent(unlinked, ALLOWED as never)).toThrow(ForbiddenException);
    expect(() => controller.updateEvent(unlinked, "1", ALLOWED as never)).toThrow(ForbiddenException);
    expect(() => controller.deleteEvent(unlinked, "1")).toThrow(ForbiddenException);
    for (const fn of Object.values(service)) expect(fn).not.toHaveBeenCalled();
  });

  it("acts for the authenticated user's organizer, not the organizerId in the body", () => {
    const service = { createEvent: jest.fn(), updateEvent: jest.fn() };
    const controller = new OrganizerController(service as never, {} as never);

    controller.createEvent(user(OWN_ORGANIZER_ID) as never, { ...ALLOWED, organizerId: OTHER_ORGANIZER_ID } as never);
    controller.updateEvent(user(OWN_ORGANIZER_ID) as never, "1", { organizerId: OTHER_ORGANIZER_ID } as never);

    expect(service.createEvent.mock.calls[0][0]).toBe(OWN_ORGANIZER_ID);
    expect(service.updateEvent.mock.calls[0][0]).toBe(OWN_ORGANIZER_ID);
  });
});
