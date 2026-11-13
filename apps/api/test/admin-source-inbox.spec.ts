import { AdminService, type AdminEventSourceListParams } from "../src/admin/admin.service";

/**
 * The where-clause behind the editorial inbox filter.
 *
 * The queue is append-only — 928 rows in production, 38 pages of 25, three
 * kinds of source interleaved — and 290 of 325 discovery rows were never
 * opened once. These tests pin the three properties that make the filter
 * trustworthy: "actionable" is read off the row itself and therefore covers a
 * source an admin pasted by hand, "never opened" adds the per-admin read state
 * instead of replacing that, and an empty result must return nothing rather
 * than everything.
 */
describe("event source inbox filter", () => {
  type Captured = { sql: string; params: unknown[] };

  function buildService(actionableIds: number[]) {
    const captured: Captured[] = [];
    const prisma = {
      // The actionable query is built with Prisma.sql, so what arrives here is
      // a Sql object carrying its own text and values.
      $queryRaw: async (query: { strings?: string[]; sql?: string; values?: unknown[] }) => {
        captured.push({ sql: query.sql ?? (query.strings ?? []).join("?"), params: query.values ?? [] });
        return actionableIds.map((id) => ({ id }));
      },
    };
    const service = new AdminService(
      prisma as never, null as never, null as never, null as never, null as never, null as never, null as never
    );
    const where = (params: AdminEventSourceListParams | undefined, userId?: number) =>
      (service as never as {
        eventSourceListWhere(p: AdminEventSourceListParams | undefined, u?: number): Promise<Record<string, unknown>>;
      }).eventSourceListWhere(params, userId);
    return { where, captured };
  }

  it("returns an unfiltered query when nothing is asked for", async () => {
    const { where } = buildService([]);

    expect(await where(undefined)).toEqual({});
  });

  it("filters to one kind of source", async () => {
    const { where } = buildService([]);

    expect(await where({ type: "SCRAPE_DISCOVERY" })).toEqual({ AND: [{ type: "SCRAPE_DISCOVERY" }] });
  });

  it("ignores a type or status that is not in the enum instead of returning nothing", async () => {
    const { where } = buildService([]);

    expect(await where({ type: "DROP TABLE", status: "whatever" })).toEqual({});
  });

  it("searches the fields an editor actually remembers a source by", async () => {
    const { where } = buildService([]);
    const result = (await where({ q: "kinematografi" })) as { AND: { OR: Record<string, unknown>[] }[] };

    expect(result.AND[0].OR.map((clause) => Object.keys(clause)[0])).toEqual([
      "sourceUrl",
      "rawEmailSubject",
      "rawEmailFrom",
      "organizer",
    ]);
  });

  it("restricts to rows that still hold an undecided candidate", async () => {
    const { where, captured } = buildService([7, 9]);

    expect(await where({ actionable: true })).toEqual({ AND: [{ id: { in: [7, 9] } }] });
    // Read off the row, not off the notification view: the view's trigger
    // skips a source an admin pasted themselves, and filtering on it hid
    // exactly those rows from the default inbox.
    expect(captured[0].sql).toContain("jsonb_array_elements");
    expect(captured[0].sql).not.toContain("ActiveAdminNotification");
  });

  it("counts both candidate shapes, including the legacy single-candidate rows", async () => {
    const { where, captured } = buildService([1]);

    await where({ actionable: true });

    expect(captured[0].sql).toContain("jsonb_typeof");
    expect(captured[0].sql).toContain("parsedJson\"->>'_status'");
  });

  it("leaves a row that is already linked to an event out of the inbox", async () => {
    const { where, captured } = buildService([1]);

    await where({ actionable: true });

    expect(captured[0].sql).toContain("eventId\" IS NULL");
    expect(captured[0].sql).toContain("'NEW', 'PARSED', 'NEEDS_REVIEW'");
  });

  it("returns an empty page, not the whole queue, when nothing is actionable", async () => {
    // The impossible id matters: an empty `in` array is a Prisma no-op on some
    // paths, and "nothing to do" must never render as "here is everything".
    const { where } = buildService([]);

    expect(await where({ actionable: true })).toEqual({ AND: [{ id: { in: [-1] } }] });
  });

  it("adds the per-admin read state for 'never opened' on top of actionable", async () => {
    const { where, captured } = buildService([4]);

    await where({ unviewed: true }, 30);

    expect(captured[0].sql).toContain("jsonb_array_elements");
    expect(captured[0].sql).toContain("AdminNotificationRead");
    expect(captured[0].params).toEqual([30]);
  });

  it("falls back to actionable rather than leaking another admin's read state when there is no user", async () => {
    const { where, captured } = buildService([4]);

    await where({ unviewed: true });

    expect(captured[0].sql).not.toContain("AdminNotificationRead");
    expect(captured[0].sql).toContain("jsonb_array_elements");
  });

  it("combines a kind, a search and the actionable gate", async () => {
    const { where } = buildService([11]);
    const result = (await where({ type: "SCRAPE_DISCOVERY", q: "tz", actionable: true })) as { AND: unknown[] };

    expect(result.AND).toHaveLength(3);
  });
});
