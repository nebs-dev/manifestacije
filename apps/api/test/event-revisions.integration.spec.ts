import { BadRequestException, ConflictException, ForbiddenException, NotFoundException, INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { JwtModule, JwtService } from "@nestjs/jwt";
import { PrismaClient } from "@prisma/client";
import { EventsService } from "../src/events/events.service";
import { EventRevisionsService } from "../src/event-revisions/event-revisions.service";
import { revisionEventInclude } from "../src/event-revisions/revision-content";
import { OrganizerService } from "../src/organizers/organizer.service";
import { PublicFeedService } from "../src/public-feed/public-feed.service";
import { AdminService } from "../src/admin/admin.service";
import { PrismaService } from "../src/prisma/prisma.service";
import { UploadsService } from "../src/admin/uploads.service";
import { OrganizerController } from "../src/organizers/organizer.controller";
import { AdminEventRevisionsController, OrganizerEventRevisionsController } from "../src/event-revisions/event-revisions.controller";
import { PublicFeedController } from "../src/public-feed/public-feed.controller";
import { currentWeekendRange } from "../src/common/weekend";

// Opt-in PostgreSQL tests. Never fall back to the application's DATABASE_URL.
const databaseUrl = process.env.REVISION_TEST_DATABASE_URL;
if (databaseUrl) {
  const url = new URL(databaseUrl);
  if (url.hostname !== "127.0.0.1" || url.port !== "5442" || url.pathname !== "/revision_qa") {
    throw new Error("Revision integration tests require the isolated localhost:5442/revision_qa database");
  }
}
const integration = databaseUrl ? describe : describe.skip;

integration("EventRevision PostgreSQL workflow", () => {
  const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl || "postgresql://unused" } } });
  const cache = { revalidate: jest.fn().mockResolvedValue(true) };
  const duplicates = { detectForEvent: jest.fn().mockResolvedValue(undefined) };
  const email = { webUrl: "https://example.test", sendAdminEventRevision: jest.fn(), sendEventRevisionDecision: jest.fn(), sendEventPublished: jest.fn() };
  const events = new EventsService(prisma as never, duplicates as never, cache as never);
  const revisions = new EventRevisionsService(prisma as never, events, cache as never, email as never);
  const organizer = new OrganizerService(prisma as never, events, {} as never, duplicates as never, email as never, {} as never, cache as never, revisions);
  const feed = new PublicFeedService(prisma as never);
  const admin = new AdminService(prisma as never, events, {} as never, duplicates as never, cache as never, email as never, {} as never);
  let organizerId: number, otherId: number, userId: number, adminId: number, categoryId: number, otherCategory: number, cityId: number, regionId: number, countyId: number;
  let eventId: number;
  let app: INestApplication, baseUrl: string, jwt: JwtService;
  const request = (path: string, user?: number, method = "GET", body?: object) => fetch(`${baseUrl}${path}`, {
    method, headers: { "Content-Type": "application/json", ...(user ? { Authorization: `Bearer ${jwt.sign({ id: user })}` } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const snapshot = () => prisma.event.findUniqueOrThrow({ where: { id: eventId }, include: revisionEventInclude });
  const submit = async (input: object = { title: "Predloženi koncert" }) => {
    await organizer.updateEvent(organizerId, eventId, input, userId);
    return prisma.eventRevision.findFirstOrThrow({ where: { eventId, status: "PENDING" } });
  };
  const approve = (revision: { id: number; version: number }) => revisions.decide(revision.id, adminId, revision.version, "APPROVED");
  const reject = (revision: { id: number; version: number }) => revisions.decide(revision.id, adminId, revision.version, "REJECTED", "Provjerite raspored.");

  beforeAll(async () => {
    await prisma.$connect();
    // This database is disposable and contains synthetic fixtures only.
    await prisma.event.deleteMany();
    await prisma.user.deleteMany();
    await prisma.organizer.deleteMany();
    const org = await prisma.organizer.create({ data: { name: "QA organizator", slug: "qa-organizator", email: "unrelated-scraped@example.test" } });
    organizerId = org.id;
    otherId = (await prisma.organizer.create({ data: { name: "QA drugi", slug: "qa-drugi" } })).id;
    userId = (await prisma.user.create({ data: { email: "submitter@example.test", name: "QA autor", passwordHash: "unused", role: "ORGANIZER", organizerId } })).id;
    adminId = (await prisma.user.create({ data: { email: "admin@example.test", name: "QA admin", passwordHash: "unused", role: "ADMIN" } })).id;
    regionId = (await prisma.region.upsert({ where: { slug: "qa-regija" }, update: {}, create: { name: "QA regija", slug: "qa-regija" } })).id;
    countyId = (await prisma.county.upsert({ where: { slug: "qa-zupanija" }, update: {}, create: { name: "QA županija", slug: "qa-zupanija", regionId } })).id;
    cityId = (await prisma.city.upsert({ where: { slug: "qa-grad" }, update: {}, create: { name: "QA grad", slug: "qa-grad", countyId, lat: 45, lng: 16 } })).id;
    categoryId = (await prisma.category.upsert({ where: { slug: "qa-koncert" }, update: {}, create: { name: "QA koncert", slug: "qa-koncert" } })).id;
    otherCategory = (await prisma.category.upsert({ where: { slug: "qa-festival" }, update: {}, create: { name: "QA festival", slug: "qa-festival" } })).id;
    const module = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: "isolated-revision-fixture-secret" })],
      controllers: [OrganizerController, AdminEventRevisionsController, OrganizerEventRevisionsController, PublicFeedController],
      providers: [
        { provide: PrismaService, useValue: prisma }, { provide: OrganizerService, useValue: organizer },
        { provide: EventRevisionsService, useValue: revisions }, { provide: PublicFeedService, useValue: feed }, { provide: UploadsService, useValue: {} },
      ],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix("api"); app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.listen(0, "127.0.0.1"); baseUrl = await app.getUrl(); jwt = module.get(JwtService);
  });
  beforeEach(async () => {
    jest.clearAllMocks();
    email.sendAdminEventRevision.mockResolvedValue(undefined);
    email.sendEventRevisionDecision.mockResolvedValue(undefined);
    await prisma.event.deleteMany();
    eventId = (await prisma.event.create({ data: {
      title: "Objavljeni koncert", slug: "qa-objavljeni-koncert", description: "Izvorni opis", status: "PUBLISHED", organizerId,
      cityId, countyId, regionId, cityName: "QA grad", categoryId, isAllDay: false, isFree: false, isFeatured: true,
      startsAt: new Date("2099-09-05T18:00:00Z"), endsAt: new Date("2099-09-05T20:00:00Z"),
      publishedAt: new Date("2026-10-01T12:00:00Z"), priceText: "10 EUR", ticketUrl: "https://tickets.example.test",
      sourceUrl: "https://source.example.test", imageUrl: "https://images.example.test/poster.jpg", address: "Izvorna adresa", lat: 45, lng: 16,
      categories: { create: { categoryId } },
    } })).id;
  });
  afterAll(async () => { await app?.close(); await prisma.$disconnect(); });

  it("exercises authenticated organizer-to-admin HTTP approval with the real database and validation pipe", async () => {
    const before = await (await request("/api/public/events/qa-objavljeni-koncert")).json();
    const response = await request(`/api/organizer/events/${eventId}`, userId, "PUT", { title: "HTTP prijedlog", slug: "hijack", status: "DRAFT", endsAt: null });
    expect(response.status).toBe(200);
    const saved = await response.json();
    expect(saved).toMatchObject({ id: eventId, status: "PUBLISHED", pendingRevision: true });
    expect(await (await request("/api/public/events/qa-objavljeni-koncert")).json()).toEqual(before);
    expect((await request(`/api/admin/event-revisions/${saved.revision.id}`, userId)).status).toBe(401);
    expect((await request(`/api/admin/event-revisions/${saved.revision.id}`)).status).toBe(401);
    const otherUser = await prisma.user.create({ data: { email: "other@example.test", name: "Drugi", passwordHash: "unused", role: "ORGANIZER", organizerId: otherId } });
    expect((await request(`/api/organizer/event-revisions/${saved.revision.id}`, otherUser.id)).status).toBe(404);
    const detail = await (await request(`/api/admin/event-revisions/${saved.revision.id}`, adminId)).json();
    expect(detail.changes.map((row: { field: string }) => row.field)).toEqual(expect.arrayContaining(["title", "endsAt"]));
    expect((await request(`/api/admin/event-revisions/${saved.revision.id}/approve`, adminId, "POST", {})).status).toBe(400);
    const decision = await request(`/api/admin/event-revisions/${saved.revision.id}/approve`, adminId, "POST", { version: detail.version });
    expect(decision.status).toBe(201);
    const after = await (await request("/api/public/events/qa-objavljeni-koncert")).json();
    expect(after).toMatchObject({ id: eventId, slug: before.slug, title: "HTTP prijedlog", endsAt: null, status: "PUBLISHED", publishedAt: before.publishedAt });
    expect((await request(`/api/admin/event-revisions/${saved.revision.id}/approve`, adminId, "POST", { version: detail.version })).status).toBe(409);
  });

  it("keeps every published field and public feed unchanged throughout submission/rejection", async () => {
    const weekend = currentWeekendRange(new Date());
    await prisma.event.update({ where: { id: eventId }, data: { startsAt: weekend.start, endsAt: new Date(weekend.end.getTime() + 3600000) } });
    const original = await snapshot();
    const detail = await feed.event(original.slug), listing = await feed.events({}), map = await feed.mapEvents();
    const calendarQuery = { dateFrom: weekend.start.toISOString().slice(0, 10), dateTo: weekend.end.toISOString().slice(0, 10) };
    const calendar = await feed.events(calendarQuery), weekendEvents = await feed.events({ weekend: "true" });
    expect(weekendEvents).toHaveLength(1); expect(calendar).toHaveLength(1);
    const revision = await submit({ title: "Privatni prijedlog", venueName: "Nova dvorana", categoryIds: [otherCategory], cityName: "Novi grad za pregled" });
    expect(await snapshot()).toEqual(original);
    expect(await feed.event(original.slug)).toEqual(detail);
    expect(await feed.events({})).toEqual(listing);
    expect(await feed.mapEvents()).toEqual(map);
    expect(await feed.events(calendarQuery)).toEqual(calendar);
    expect(await feed.events({ weekend: "true" })).toEqual(weekendEvents);
    expect(await prisma.city.findFirst({ where: { name: "Novi grad za pregled" } })).toBeNull();
    expect(await prisma.venue.findFirst({ where: { name: "Nova dvorana" } })).toBeNull();
    expect(cache.revalidate).not.toHaveBeenCalled();
    await reject(revision);
    expect(await snapshot()).toEqual(original);
    expect(cache.revalidate).not.toHaveBeenCalled();
    expect(email.sendEventRevisionDecision).toHaveBeenCalledWith("submitter@example.test", expect.objectContaining({ approved: false, reason: "Provjerite raspored." }), eventId);
  });

  it("replaces one pending proposal, preserves partial edits and invalidates stale review versions", async () => {
    const first = await submit();
    const next = await submit({ description: "Novi opis" });
    expect(next.id).toBe(first.id); expect(next.version).toBe(2);
    expect(next.proposed).toMatchObject({ title: "Predloženi koncert", description: "Novi opis" });
    expect(await prisma.eventRevision.count({ where: { eventId, status: "PENDING" } })).toBe(1);
    await expect(approve(first)).rejects.toBeInstanceOf(ConflictException);
    await expect(reject(first)).rejects.toBeInstanceOf(ConflictException);
    expect((await snapshot()).title).toBe("Objavljeni koncert");
    await submit({ description: "Novi opis" });
    expect(email.sendAdminEventRevision).toHaveBeenCalledTimes(2); // identical retry sends nothing
  });

  it("atomically approves content, nullable fields, categories and location while preserving public identity", async () => {
    const before = await snapshot();
    const revision = await submit({ title: "Odobreni naslov", description: "Novi opis", endsAt: null, isFree: null, priceText: null,
      ticketUrl: null, sourceUrl: null, imageUrl: null, categoryIds: [otherCategory], venueName: "QA dvorana", address: "Nova adresa", lat: null, lng: null });
    const comparison = await revisions.detail(revision.id);
    expect(comparison.changes.map(row => row.field)).toEqual(expect.arrayContaining(["title", "description", "endsAt", "isFree", "priceText", "ticketUrl", "sourceUrl", "imageUrl", "categoryIds", "venueName", "address", "lat", "lng"]));
    expect(comparison.changes.find(row => row.field === "endsAt")).toEqual({ field: "endsAt", original: before.endsAt!.toISOString(), proposed: null });
    const decision = await approve(revision);
    expect(decision).toMatchObject({ status: "APPROVED", reviewedByUserId: adminId });
    expect(decision.reviewedAt).toBeInstanceOf(Date);
    const after = await snapshot();
    expect(after).toMatchObject({ id: eventId, title: "Odobreni naslov", slug: before.slug, status: before.status, organizerId, isFeatured: true,
      publishedAt: before.publishedAt, endsAt: null, isFree: null, priceText: null, ticketUrl: null, sourceUrl: null, imageUrl: null, lat: null, lng: null });
    expect(after.categories.map(row => row.categoryId)).toEqual([otherCategory]);
    expect(after.venue?.name).toBe("QA dvorana");
    expect(cache.revalidate.mock.calls).toEqual([["events"], ["taxonomy"]]);
    expect(duplicates.detectForEvent).toHaveBeenCalledTimes(1);
    expect(email.sendEventPublished).not.toHaveBeenCalled();
    expect(email.sendEventRevisionDecision).toHaveBeenCalledWith("submitter@example.test", expect.objectContaining({ approved: true }), eventId);
  });

  it.each([
    ["single-day", "2099-01-09T20:00:00+01:00", "2099-01-09T22:00:00+01:00", false, "2099-01-09T19:00:00.000Z", "2099-01-09T21:00:00.000Z"],
    ["overnight", "2099-07-10T22:00:00+02:00", "2099-07-11T02:00:00+02:00", false, "2099-07-10T20:00:00.000Z", "2099-07-11T00:00:00.000Z"],
    ["multi-day", "2099-07-10T10:00:00+02:00", "2099-07-13T20:00:00+02:00", false, "2099-07-10T08:00:00.000Z", "2099-07-13T18:00:00.000Z"],
    ["all-day", "2099-07-10T00:00:00+02:00", "2099-07-13T23:59:59+02:00", true, "2099-07-09T22:00:00.000Z", "2099-07-13T21:59:59.999Z"],
    ["DST", "2027-03-28T01:00:00+01:00", "2027-03-28T04:00:00+02:00", false, "2027-03-28T00:00:00.000Z", "2027-03-28T02:00:00.000Z"],
  ])("preserves %s schedule timestamps", async (_name, startsAt, endsAt, isAllDay, expectedStart, expectedEnd) => {
    const revision = await submit({ startsAt, endsAt, isAllDay });
    await approve(revision);
    const event = await snapshot();
    expect(event.startsAt.toISOString()).toBe(expectedStart);
    expect(event.endsAt?.toISOString()).toBe(expectedEnd);
    expect(event.occurrences).toHaveLength(0);
  });

  it("adds, edits, removes occurrences and clears individual ends only at approval", async () => {
    await prisma.eventOccurrence.createMany({ data: [
      { eventId, startsAt: new Date("2099-09-05T18:00:00Z"), endsAt: new Date("2099-09-05T20:00:00Z") },
      { eventId, startsAt: new Date("2099-09-12T18:00:00Z") },
    ] });
    const before = await snapshot(), kept = before.occurrences[0];
    const revision = await submit({ occurrences: [
      { id: kept.id, startsAt: kept.startsAt.toISOString(), endsAt: null, isAllDay: false },
      { startsAt: "2099-09-19T20:00:00+02:00", endsAt: "2099-09-20T02:00:00+02:00", isAllDay: false },
    ] });
    expect(await snapshot()).toEqual(before);
    expect((await revisions.detail(revision.id)).changes.map(row => row.field)).toContain("occurrences");
    await approve(revision);
    const after = await snapshot();
    expect(after.occurrences).toHaveLength(2);
    expect(after.occurrences[0]).toMatchObject({ id: kept.id, endsAt: null });
    expect(after.occurrences[1].endsAt?.toISOString()).toBe("2099-09-20T00:00:00.000Z");
    expect(after.endsAt?.toISOString()).toBe("2099-09-20T00:00:00.000Z");
    await expect(submit({ occurrences: [{ id: before.occurrences[1].id, startsAt: "2099-09-22T18:00:00Z" }] })).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects cross-organizer event, user and revision access without leaking or changing content", async () => {
    const before = await snapshot(), revision = await submit();
    await expect(revisions.saveOrganizerEdit(eventId, otherId, userId, { title: "Krađa" })).rejects.toBeInstanceOf(ForbiddenException);
    await expect(revisions.saveOrganizerEdit(eventId, organizerId, adminId, { title: "Krađa" })).rejects.toBeInstanceOf(ForbiddenException);
    await expect(revisions.detail(revision.id, otherId)).rejects.toBeInstanceOf(NotFoundException);
    expect(await snapshot()).toEqual(before);
  });

  it("strips protected fields at submission and again at approval", async () => {
    const before = await snapshot();
    const revision = await submit({ title: "Siguran naslov", slug: "hijack", status: "DRAFT", organizerId: otherId, isFeatured: false, publishedAt: null, countyName: "fake" });
    expect(revision.proposed).not.toHaveProperty("slug");
    await prisma.eventRevision.update({ where: { id: revision.id }, data: { proposed: { ...revision.proposed as object, slug: "stored-hijack", organizerId: otherId, status: "ARCHIVED", isFeatured: false } } });
    await approve(revision);
    const after = await snapshot();
    for (const key of ["id", "slug", "organizerId", "status", "isFeatured", "publishedAt", "createdAt", "sourceType"] as const) expect(after[key]).toEqual(before[key]);
  });

  it.each(["title", "categories", "owner"])("blocks approval against newer admin %s edits", async field => {
    const revision = await submit();
    if (field === "title") await events.updateEvent(eventId, { title: "Admin verzija" });
    if (field === "categories") await prisma.eventCategory.create({ data: { eventId, categoryId: otherCategory } });
    if (field === "owner") await prisma.event.update({ where: { id: eventId }, data: { organizerId: otherId } });
    const afterAdmin = await snapshot();
    cache.revalidate.mockClear();
    expect((await revisions.detail(revision.id)).conflict).toBe(true);
    await expect(approve(revision)).rejects.toBeInstanceOf(ConflictException);
    expect(await snapshot()).toEqual(afterAdmin);
    expect(cache.revalidate).not.toHaveBeenCalled();
    if (field !== "owner") {
      const resubmission = await submit({ title: "Ponovno pregledano" });
      expect((await revisions.detail(resubmission.id)).conflict).toBe(false);
      await approve(resubmission);
    }
  });

  it("allows only one of concurrent approve/reject decisions and one set of postcommit effects", async () => {
    const revision = await submit();
    const outcomes = await Promise.allSettled([approve(revision), reject(revision)]);
    expect(outcomes.filter(row => row.status === "fulfilled")).toHaveLength(1);
    expect(outcomes.filter(row => row.status === "rejected")).toHaveLength(1);
    expect(email.sendEventRevisionDecision).toHaveBeenCalledTimes(1);
    await expect(approve(revision)).rejects.toBeInstanceOf(ConflictException);
    await expect(reject(revision)).rejects.toBeInstanceOf(ConflictException);
    const saved = await prisma.eventRevision.findUniqueOrThrow({ where: { id: revision.id } });
    expect(cache.revalidate).toHaveBeenCalledTimes(saved.status === "APPROVED" ? 2 : 0);
  });

  it("blocks an approval racing an independently committing admin transaction", async () => {
    const revision = await submit();
    let locked!: () => void, release!: () => void;
    const acquired = new Promise<void>(resolve => { locked = resolve; });
    const released = new Promise<void>(resolve => { release = resolve; });
    const write = prisma.$transaction(async tx => {
      await tx.event.update({ where: { id: eventId }, data: { title: "Istodobna admin izmjena" } });
      locked(); await released;
    });
    await acquired;
    const decision = approve(revision).then(() => "unexpected approval", error => error);
    await new Promise(resolve => setImmediate(resolve));
    release(); await write;
    expect(await decision).toBeInstanceOf(ConflictException);
    expect((await snapshot()).title).toBe("Istodobna admin izmjena");
    expect(cache.revalidate).not.toHaveBeenCalled();
  });

  it("enforces the one-pending SQL constraint independently of application checks", async () => {
    const revision = await submit();
    const { id, createdAt, updatedAt, ...data } = revision;
    await expect(prisma.eventRevision.create({ data: data as never })).rejects.toMatchObject({ code: "P2002" });
  });

  it("rolls back all content, venue, categories and occurrence writes on an approval error", async () => {
    const before = await snapshot(), revision = await submit({ title: "Rollback", venueName: "QA rollback venue" });
    await prisma.eventRevision.update({ where: { id: revision.id }, data: { proposed: { ...revision.proposed as object, categoryIds: [categoryId, 2147483000] } } });
    await expect(approve(revision)).rejects.toThrow();
    expect(await snapshot()).toEqual(before);
    expect(await prisma.venue.findFirst({ where: { name: "QA rollback venue" } })).toBeNull();
    expect((await prisma.eventRevision.findUniqueOrThrow({ where: { id: revision.id } })).status).toBe("PENDING");
    expect(cache.revalidate).not.toHaveBeenCalled();
    expect(email.sendEventRevisionDecision).not.toHaveBeenCalled();
  });

  it("email failures never roll back successful operations or use scraped organizer recipients", async () => {
    email.sendAdminEventRevision.mockRejectedValue(new Error("provider failure"));
    email.sendEventRevisionDecision.mockRejectedValue(new Error("provider failure"));
    const revision = await submit();
    await approve(revision);
    expect((await snapshot()).title).toBe("Predloženi koncert");
    expect(email.sendEventRevisionDecision.mock.calls[0][0]).toBe("submitter@example.test");
    expect(email.sendEventPublished).not.toHaveBeenCalled();
  });

  it("includes revisions in pending counts even after the admin last-seen cutoff", async () => {
    await submit();
    expect(await admin.pendingCounts({ eventsSince: "2999-01-01T00:00:00Z" })).toMatchObject({ revisions: 1, events: 0 });
    expect((await revisions.listPending()).items[0]).toMatchObject({ eventId, organizer: { name: "QA organizator" }, submittedBy: { email: "submitter@example.test" } });
  });

  it("preserves never-published submission behavior without creating a revision", async () => {
    await prisma.event.update({ where: { id: eventId }, data: { status: "DRAFT", publishedAt: null } });
    await organizer.updateEvent(organizerId, eventId, { title: "Nacrt" }, userId);
    expect(await snapshot()).toMatchObject({ title: "Nacrt", status: "PENDING_REVIEW", publishedAt: null });
    expect(await prisma.eventRevision.count({ where: { eventId } })).toBe(0);
    expect(duplicates.detectForEvent).toHaveBeenCalledTimes(1);
  });

  it.each([{ ticketUrl: "javascript:alert(1)" }, { sourceUrl: "data:text/html,x" }, { startsAt: "2099-09-05T20:00:00" }, { endsAt: "2099-09-04T20:00:00Z" }])("rejects unsafe or ambiguous proposal input %j", async input => {
    await expect(submit(input)).rejects.toBeInstanceOf(BadRequestException);
    expect(await prisma.eventRevision.count({ where: { eventId } })).toBe(0);
  });

  it("preserves legacy invalid links on unrelated proposals and permits clearing them", async () => {
    await prisma.event.update({ where: { id: eventId }, data: { ticketUrl: "racesmanager", sourceUrl: "javascript:legacy" } });
    let revision = await submit();
    await approve(revision);
    expect(await snapshot()).toMatchObject({ ticketUrl: "racesmanager", sourceUrl: "javascript:legacy" });
    revision = await submit({ ticketUrl: null, sourceUrl: null });
    await approve(revision);
    expect(await snapshot()).toMatchObject({ ticketUrl: null, sourceUrl: null });
  });

  it("does not rewrite shared venues or taxonomy when only a title is approved", async () => {
    const venue = await prisma.venue.upsert({ where: { slug_cityId: { slug: "qa-shared", cityId } }, update: {}, create: { name: "QA shared", slug: "qa-shared", cityId, address: "Venue adresa", lat: 46, lng: 17 } });
    await prisma.event.update({ where: { id: eventId }, data: { venueId: venue.id } });
    const originalVenue = await prisma.venue.findUnique({ where: { id: venue.id } });
    const originalCity = await prisma.city.findUnique({ where: { id: cityId } });
    await approve(await submit());
    expect(await prisma.venue.findUnique({ where: { id: venue.id } })).toEqual(originalVenue);
    expect(await prisma.city.findUnique({ where: { id: cityId } })).toEqual(originalCity);
  });

  it("previews city resolution from a changed address before admin review", async () => {
    const otherCity = await prisma.city.upsert({ where: { slug: "qa-drugi-grad" }, update: {}, create: { name: "QA drugi grad", slug: "qa-drugi-grad", countyId } });
    const revision = await submit({ address: "Ulica 1, QA drugi grad" });
    expect(revision.proposed).toMatchObject({ cityId: otherCity.id, cityName: "QA drugi grad" });
    expect((await revisions.detail(revision.id)).changes.map(change => change.field)).toContain("cityName");
    await approve(revision);
    expect(await snapshot()).toMatchObject({ cityId: otherCity.id, cityName: "QA drugi grad", address: "Ulica 1, QA drugi grad" });
  });
});
