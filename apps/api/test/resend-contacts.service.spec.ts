import { EmailContactSource, EmailContactSyncStatus, OrganizerStatus, UserRole } from "@prisma/client";
import { ResendContactsService } from "../src/contacts/resend-contacts.service";

/** In-memory stand-in for prisma.emailContact, keyed by normalized email — lets
 *  tests exercise real dedup/upsert behavior across repeated calls instead of
 *  chaining mockResolvedValueOnce per call. */
function fakeEmailContactTable() {
  const rows = new Map<string, Record<string, unknown>>();
  let nextId = 1;

  const table = {
    findUnique: jest.fn(async ({ where }: { where: { email?: string; id?: number } }) => {
      if (where.email) return rows.get(where.email) ?? null;
      if (where.id !== undefined) {
        for (const row of rows.values()) if (row.id === where.id) return row;
        return null;
      }
      return null;
    }),
    findUniqueOrThrow: jest.fn(async ({ where }: { where: { email: string } }) => {
      const row = rows.get(where.email);
      if (!row) throw new Error("not found");
      return row;
    }),
    create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
      const row = {
        id: nextId++,
        resendContactId: null,
        syncStatus: EmailContactSyncStatus.PENDING,
        isUnsubscribed: false,
        unsubscribedAt: null,
        lastSyncedAt: null,
        syncError: null,
        ...data,
      };
      rows.set(data.email as string, row);
      return row;
    }),
    update: jest.fn(async ({ where, data }: { where: { email: string }; data: Record<string, unknown> }) => {
      const existing = rows.get(where.email);
      if (!existing) throw new Error("not found");
      const updated = { ...existing, ...data };
      rows.set(where.email, updated);
      return updated;
    }),
  };

  return { rows, table };
}

function contactsClientMock(overrides: Record<string, unknown> = {}) {
  return {
    create: jest.fn().mockResolvedValue({ data: { id: "resend_1" }, error: null }),
    get: jest.fn().mockResolvedValue({ data: null, error: { message: "not found" } }),
    update: jest.fn().mockResolvedValue({ data: { id: "resend_1" }, error: null }),
    ...overrides,
  };
}

function makeService(client: unknown, table: unknown) {
  const service = new ResendContactsService({ emailContact: table } as never);
  // The real Resend SDK nests these under `.contacts` — mirror that shape so
  // the service's `this.client.contacts.create(...)` calls resolve correctly.
  (service as unknown as { client: unknown }).client = client ? { contacts: client } : null;
  return service;
}

describe("ResendContactsService.normalizeEmail", () => {
  it("trims and lowercases", () => {
    const service = makeService(null, {});
    expect(service.normalizeEmail("  Organizer@Example.HR  ")).toBe("organizer@example.hr");
  });
});

describe("ResendContactsService.upsertEligibleContact", () => {
  it("creates a new EmailContact and a new Resend contact with unsubscribed=false", async () => {
    const { rows, table } = fakeEmailContactTable();
    const client = contactsClientMock();
    const service = makeService(client, table);

    await service.upsertEligibleContact({ email: "New@Example.hr", source: EmailContactSource.REGISTRATION });

    expect(client.create).toHaveBeenCalledWith(expect.objectContaining({ email: "new@example.hr", unsubscribed: false }));
    const row = rows.get("new@example.hr");
    expect(row).toMatchObject({ source: EmailContactSource.REGISTRATION, resendContactId: "resend_1", syncStatus: EmailContactSyncStatus.SYNCED });
  });

  it("does not create a duplicate EmailContact for the same normalized email from a later trigger", async () => {
    const { rows, table } = fakeEmailContactTable();
    const client = contactsClientMock();
    const service = makeService(client, table);

    await service.upsertEligibleContact({ email: "organizer@example.hr", source: EmailContactSource.EVENT_SUBMISSION });
    await service.upsertEligibleContact({ email: "organizer@example.hr", source: EmailContactSource.REGISTRATION, userId: 9, organizerId: 5 });

    expect(rows.size).toBe(1);
    const row = rows.get("organizer@example.hr")!;
    // First trigger reason is preserved rather than overwritten by the later one.
    expect(row.source).toBe(EmailContactSource.EVENT_SUBMISSION);
    // But identifiers discovered later are filled in.
    expect(row.userId).toBe(9);
    expect(row.organizerId).toBe(5);
  });

  it("repeated sync of the same contact is idempotent", async () => {
    const { rows, table } = fakeEmailContactTable();
    const client = contactsClientMock();
    const service = makeService(client, table);

    await service.upsertEligibleContact({ email: "organizer@example.hr", source: EmailContactSource.REGISTRATION });
    await service.upsertEligibleContact({ email: "organizer@example.hr", source: EmailContactSource.REGISTRATION });
    await service.upsertEligibleContact({ email: "organizer@example.hr", source: EmailContactSource.REGISTRATION });

    expect(rows.size).toBe(1);
  });

  it("update path never passes unsubscribed, preserving whatever state Resend already has", async () => {
    const { table } = fakeEmailContactTable();
    const client = contactsClientMock();
    const service = makeService(client, table);

    await service.upsertEligibleContact({ email: "organizer@example.hr", source: EmailContactSource.REGISTRATION });
    // Second call hits the update path since resendContactId is now set.
    await service.upsertEligibleContact({ email: "organizer@example.hr", source: EmailContactSource.REGISTRATION });

    expect(client.update).toHaveBeenCalledTimes(1);
    expect(client.update.mock.calls[0][0]).not.toHaveProperty("unsubscribed");
  });

  it("falls back to get+update when create conflicts with an existing Resend contact, preserving their subscription state", async () => {
    const { rows, table } = fakeEmailContactTable();
    const client = contactsClientMock({
      create: jest.fn().mockResolvedValue({ data: null, error: { message: "Contact already exists" } }),
      get: jest.fn().mockResolvedValue({ data: { id: "resend_existing", unsubscribed: true }, error: null }),
    });
    const service = makeService(client, table);

    await service.upsertEligibleContact({ email: "organizer@example.hr", source: EmailContactSource.REGISTRATION });

    expect(client.get).toHaveBeenCalledWith({ email: "organizer@example.hr" });
    expect(client.update).toHaveBeenCalledWith(expect.objectContaining({ id: "resend_existing" }));
    expect(client.update.mock.calls[0][0]).not.toHaveProperty("unsubscribed");
    const row = rows.get("organizer@example.hr")!;
    expect(row.resendContactId).toBe("resend_existing");
    // Mirrors Resend's own unsubscribed=true for this pre-existing contact —
    // a pure read of their truth, not something our sync forced on them.
    expect(row.isUnsubscribed).toBe(true);
    expect(row.syncStatus).toBe(EmailContactSyncStatus.UNSUBSCRIBED);
  });

  it("marks syncStatus=FAILED with a safe error message when Resend is unreachable, without throwing", async () => {
    const { rows, table } = fakeEmailContactTable();
    const client = contactsClientMock({
      create: jest.fn().mockRejectedValue(new Error("network timeout")),
      get: jest.fn().mockResolvedValue({ data: null, error: { message: "not found" } }),
    });
    const service = makeService(client, table);

    await expect(
      service.upsertEligibleContact({ email: "organizer@example.hr", source: EmailContactSource.REGISTRATION })
    ).resolves.toBeDefined();

    const row = rows.get("organizer@example.hr")!;
    expect(row.syncStatus).toBe(EmailContactSyncStatus.FAILED);
    expect(row.syncError).toBeTruthy();
  });

  it("skips the Resend network call and leaves syncStatus=PENDING when no client is configured", async () => {
    const { rows, table } = fakeEmailContactTable();
    const service = makeService(null, table);

    await service.upsertEligibleContact({ email: "organizer@example.hr", source: EmailContactSource.REGISTRATION });

    const row = rows.get("organizer@example.hr")!;
    expect(row.syncStatus).toBe(EmailContactSyncStatus.PENDING);
  });
});

describe("ResendContactsService trigger methods", () => {
  it("syncOrganizerRegistration never throws even if the Resend call fails", async () => {
    const { table } = fakeEmailContactTable();
    const client = contactsClientMock({ create: jest.fn().mockRejectedValue(new Error("boom")) });
    const service = makeService(client, table);

    await expect(
      service.syncOrganizerRegistration({ id: 1, email: "organizer@example.hr" })
    ).resolves.toBeUndefined();
  });

  it("syncEventSubmitter does nothing when no email is known", async () => {
    const { table } = fakeEmailContactTable();
    const client = contactsClientMock();
    const service = makeService(client, table);

    await service.syncEventSubmitter(undefined, EmailContactSource.EVENT_SUBMISSION);

    expect(client.create).not.toHaveBeenCalled();
  });
});

describe("ResendContactsService.retryFailedContact", () => {
  it("re-syncs a FAILED row and clears syncError on success", async () => {
    const { rows, table } = fakeEmailContactTable();
    const client = contactsClientMock({
      create: jest.fn().mockResolvedValue({ data: null, error: { message: "boom" } }),
      get: jest.fn().mockResolvedValue({ data: null, error: { message: "boom" } }),
    });
    const service = makeService(client, table);
    await service.upsertEligibleContact({ email: "organizer@example.hr", source: EmailContactSource.REGISTRATION });
    expect(rows.get("organizer@example.hr")!.syncStatus).toBe(EmailContactSyncStatus.FAILED);

    client.create.mockResolvedValue({ data: { id: "resend_1" }, error: null });
    const result = await service.retryFailedContact("organizer@example.hr");

    expect(result?.syncStatus).toBe(EmailContactSyncStatus.SYNCED);
    expect(result?.syncError).toBeNull();
  });
});

function makeServiceWithOrganizers(client: unknown, table: ReturnType<typeof fakeEmailContactTable>["table"], organizers: unknown[]) {
  const prisma = { emailContact: table, organizer: { findMany: jest.fn().mockResolvedValue(organizers) } };
  const service = new ResendContactsService(prisma as never);
  (service as unknown as { client: unknown }).client = client ? { contacts: client } : null;
  return { service, prisma };
}

describe("ResendContactsService.backfillExistingEngagedOrganizers", () => {
  it("includes an organizer with a linked ORGANIZER-role User", async () => {
    const { table } = fakeEmailContactTable();
    const client = contactsClientMock();
    const { service } = makeServiceWithOrganizers(client, table, [
      { id: 1, name: "Org A", email: "orga@example.hr", status: OrganizerStatus.UNCLAIMED, users: [{ id: 5, email: "orga@example.hr", role: UserRole.ORGANIZER }] },
    ]);

    const stats = await service.backfillExistingEngagedOrganizers();

    expect(stats).toMatchObject({ scanned: 1, eligible: 1, created: 1, skippedUnengaged: 0 });
  });

  it("includes an organizer with CLAIMED/VERIFIED/TRUSTED status even without a linked user", async () => {
    const { table } = fakeEmailContactTable();
    const client = contactsClientMock();
    const { service } = makeServiceWithOrganizers(client, table, [
      { id: 1, name: "Org A", email: "orga@example.hr", status: OrganizerStatus.VERIFIED, users: [] },
    ]);

    const stats = await service.backfillExistingEngagedOrganizers();

    expect(stats).toMatchObject({ eligible: 1, created: 1 });
  });

  it("skips attribution-only organizers — UNCLAIMED, no linked user, regardless of email or events", async () => {
    const { table } = fakeEmailContactTable();
    const client = contactsClientMock();
    const { service } = makeServiceWithOrganizers(client, table, [
      { id: 1, name: "Org A", email: "orga@example.hr", status: OrganizerStatus.UNCLAIMED, users: [] },
    ]);

    const stats = await service.backfillExistingEngagedOrganizers();

    expect(stats).toMatchObject({ eligible: 0, skippedUnengaged: 1, created: 0 });
    expect(client.create).not.toHaveBeenCalled();
  });

  it("preserves the unsubscribed state of an already-synced contact instead of re-syncing it", async () => {
    const { rows, table } = fakeEmailContactTable();
    rows.set("orga@example.hr", {
      id: 1,
      email: "orga@example.hr",
      resendContactId: "resend_x",
      syncStatus: EmailContactSyncStatus.UNSUBSCRIBED,
      isUnsubscribed: true,
      source: EmailContactSource.REGISTRATION,
    });
    const client = contactsClientMock();
    const { service } = makeServiceWithOrganizers(client, table, [
      { id: 1, name: "Org A", email: "orga@example.hr", status: OrganizerStatus.VERIFIED, users: [] },
    ]);

    const stats = await service.backfillExistingEngagedOrganizers();

    expect(stats).toMatchObject({ eligible: 1, alreadySynced: 1, unsubscribedPreserved: 1 });
    expect(client.create).not.toHaveBeenCalled();
    expect(client.update).not.toHaveBeenCalled();
  });

  it("dedupes the same email backing more than one engaged organizer record", async () => {
    const { table } = fakeEmailContactTable();
    const client = contactsClientMock();
    const { service } = makeServiceWithOrganizers(client, table, [
      { id: 1, name: "Org A", email: "same@example.hr", status: OrganizerStatus.VERIFIED, users: [] },
      { id: 2, name: "Org B", email: "same@example.hr", status: OrganizerStatus.CLAIMED, users: [] },
    ]);

    const stats = await service.backfillExistingEngagedOrganizers();

    expect(stats.created).toBe(1);
  });

  it("dry-run reports stats without writing any EmailContact rows", async () => {
    const { rows, table } = fakeEmailContactTable();
    const client = contactsClientMock();
    const { service } = makeServiceWithOrganizers(client, table, [
      { id: 1, name: "Org A", email: "orga@example.hr", status: OrganizerStatus.VERIFIED, users: [] },
    ]);

    const stats = await service.backfillExistingEngagedOrganizers({ dryRun: true });

    expect(stats).toMatchObject({ eligible: 1 });
    expect(rows.size).toBe(0);
    expect(client.create).not.toHaveBeenCalled();
  });

  it("is idempotent — running it twice does not create duplicate rows or re-sync", async () => {
    const { rows, table } = fakeEmailContactTable();
    const client = contactsClientMock();
    const { service } = makeServiceWithOrganizers(client, table, [
      { id: 1, name: "Org A", email: "orga@example.hr", status: OrganizerStatus.VERIFIED, users: [] },
    ]);

    await service.backfillExistingEngagedOrganizers();
    const stats = await service.backfillExistingEngagedOrganizers();

    expect(rows.size).toBe(1);
    expect(stats.alreadySynced).toBe(1);
    expect(stats.created).toBe(0);
  });
});

describe("ResendContactsService.processResendContactUpdate", () => {
  it("marks a tracked contact unsubscribed when Resend reports unsubscribed=true", async () => {
    const { rows, table } = fakeEmailContactTable();
    rows.set("organizer@example.hr", { id: 1, email: "organizer@example.hr", isUnsubscribed: false, syncStatus: EmailContactSyncStatus.SYNCED });
    const service = makeService(null, table);

    await service.processResendContactUpdate({ type: "contact.updated", data: { email: "organizer@example.hr", unsubscribed: true } });

    const row = rows.get("organizer@example.hr")!;
    expect(row.isUnsubscribed).toBe(true);
    expect(row.syncStatus).toBe(EmailContactSyncStatus.UNSUBSCRIBED);
  });

  it("mirrors unsubscribed=false back to a subscribed state", async () => {
    const { rows, table } = fakeEmailContactTable();
    rows.set("organizer@example.hr", { id: 1, email: "organizer@example.hr", isUnsubscribed: true, syncStatus: EmailContactSyncStatus.UNSUBSCRIBED });
    const service = makeService(null, table);

    await service.processResendContactUpdate({ type: "contact.updated", data: { email: "organizer@example.hr", unsubscribed: false } });

    const row = rows.get("organizer@example.hr")!;
    expect(row.isUnsubscribed).toBe(false);
    expect(row.syncStatus).toBe(EmailContactSyncStatus.SYNCED);
  });

  it("clears the Resend contact id on contact.deleted without recreating it", async () => {
    const { rows, table } = fakeEmailContactTable();
    rows.set("organizer@example.hr", { id: 1, email: "organizer@example.hr", resendContactId: "resend_1", syncStatus: EmailContactSyncStatus.SYNCED });
    const service = makeService(null, table);

    await service.processResendContactUpdate({ type: "contact.deleted", data: { email: "organizer@example.hr" } });

    const row = rows.get("organizer@example.hr")!;
    expect(row.resendContactId).toBeNull();
    expect(row.syncStatus).toBe(EmailContactSyncStatus.PENDING);
  });

  it("ignores events for an email we're not tracking", async () => {
    const { table } = fakeEmailContactTable();
    const service = makeService(null, table);

    await expect(
      service.processResendContactUpdate({ type: "contact.updated", data: { email: "unknown@example.hr", unsubscribed: true } })
    ).resolves.toBeUndefined();
    expect(table.update).not.toHaveBeenCalled();
  });

  it("is idempotent — processing the same event twice converges to the same state", async () => {
    const { rows, table } = fakeEmailContactTable();
    rows.set("organizer@example.hr", { id: 1, email: "organizer@example.hr", isUnsubscribed: false, syncStatus: EmailContactSyncStatus.SYNCED });
    const service = makeService(null, table);

    await service.processResendContactUpdate({ type: "contact.updated", data: { email: "organizer@example.hr", unsubscribed: true } });
    await service.processResendContactUpdate({ type: "contact.updated", data: { email: "organizer@example.hr", unsubscribed: true } });

    const row = rows.get("organizer@example.hr")!;
    expect(row.isUnsubscribed).toBe(true);
    expect(row.syncStatus).toBe(EmailContactSyncStatus.UNSUBSCRIBED);
  });
});
