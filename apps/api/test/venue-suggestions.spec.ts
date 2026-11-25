import { AdminService } from "../src/admin/admin.service";
import { EventsService } from "../src/events/events.service";

/**
 * Venue memory (VEN-01…VEN-05). Every venue an admin has ever confirmed is
 * already stored — the search over it was built for the coordinate picker
 * alone, so it hid venues without coordinates, returned one joined `label`
 * the form could not split back into fields, matched case-sensitively, and
 * ignored the city. The last one is the dangerous part: two towns can hold a
 * "Dvorana", and the wrong address must never be filled in silently.
 */
const venue = (id: number, name: string, address: string | null, city: string, extra: Partial<{ lat: number | null; lng: number | null; cityId: number }> = {}) => ({
  id, name, address, lat: 45.5, lng: 18.7, cityId: 1, ...extra, city: { id: extra.cityId ?? 1, name: city },
});

function service(found: ReturnType<typeof venue>[]) {
  const findMany = jest.fn().mockResolvedValue(found);
  const prisma = { venue: { findMany } };
  return { findMany, admin: new AdminService(prisma as never, {} as never, {} as never, {} as never, { revalidate: jest.fn() } as never, {} as never, {} as never) };
}

describe("admin venue suggestions", () => {
  it("returns the stored name and address as separate fields, not only a label", async () => {
    const { admin } = service([venue(3, "Oxygene", "Kapucinska 41", "Osijek")]);

    const [first] = await admin.searchVenues("oxy");

    expect(first).toEqual(expect.objectContaining({
      id: 3, name: "Oxygene", address: "Kapucinska 41", cityName: "Osijek", cityId: 1, lat: 45.5, lng: 18.7,
    }));
    // The coordinate picker still reads `label`.
    expect(first.label).toBe("Oxygene, Kapucinska 41, Osijek");
  });

  it("matches regardless of case, so a typed 'oxygene' finds 'Oxygene'", async () => {
    const { findMany, admin } = service([]);

    await admin.searchVenues("oxygene");

    const where = findMany.mock.calls[0][0].where;
    for (const clause of where.OR) {
      expect(Object.values(clause)[0]).toEqual(expect.objectContaining({ mode: "insensitive" }));
    }
  });

  it("keeps venues that have an address but no coordinates", async () => {
    const { admin } = service([venue(4, "Klub bez koordinata", "Trg 1", "Osijek", { lat: null, lng: null })]);

    const results = await admin.searchVenues("klub");

    expect(results).toHaveLength(1);
    expect(results[0]).toEqual(expect.objectContaining({ name: "Klub bez koordinata", lat: null, lng: null }));
  });

  it("puts venues from the event's own city first when several towns share a name", async () => {
    const { admin } = service([
      venue(1, "Dvorana", "Zagrebačka 1", "Zagreb", { cityId: 9 }),
      venue(2, "Dvorana", "Osječka 2", "Osijek", { cityId: 1 }),
    ]);

    const results = await admin.searchVenues("dvorana", { cityName: "Osijek" });

    expect(results.map(result => result.cityName)).toEqual(["Osijek", "Zagreb"]);
  });

  it("never drops the other cities' venues, so the admin can still pick one", async () => {
    const { admin } = service([
      venue(1, "Dvorana", "Zagrebačka 1", "Zagreb", { cityId: 9 }),
      venue(2, "Dvorana", "Osječka 2", "Osijek", { cityId: 1 }),
    ]);

    expect(await admin.searchVenues("dvorana", { cityName: "Osijek" })).toHaveLength(2);
  });

  it("prefers a name that starts with the query over one that merely contains it", async () => {
    const { admin } = service([
      venue(1, "Stari klub Oxygene", "Trg 2", "Osijek"),
      venue(2, "Oxygene", "Kapucinska 41", "Osijek"),
    ]);

    const results = await admin.searchVenues("oxygene");

    expect(results.map(result => result.name)).toEqual(["Oxygene", "Stari klub Oxygene"]);
  });

  it("asks the database for nothing on a query too short to mean anything", async () => {
    const { findMany, admin } = service([]);

    expect(await admin.searchVenues("o")).toEqual([]);
    expect(findMany).not.toHaveBeenCalled();
  });
});

describe("venue memory on write", () => {
  /** VEN-04 server side: an event whose poster named only the club reuses the
   *  address and the point confirmed on the earlier event there, without a
   *  geocoder call. A later event must not blank what was stored before. */
  it("reuses a stored venue's address and coordinates for an event that carries neither", async () => {
    const city = { id: 1, name: "Osijek", countyId: 2, county: { regionId: 3, region: { slug: "slavonija-i-baranja" } }, lat: 45.55, lng: 18.69 };
    const prisma = {
      city: { findFirst: jest.fn().mockResolvedValue(city), findMany: jest.fn().mockResolvedValue([city]) },
      venue: {
        findUnique: jest.fn().mockResolvedValue({ id: 12, name: "Oxygene", address: "Kapucinska 41", lat: 45.56, lng: 18.68 }),
        upsert: jest.fn().mockResolvedValue({ id: 12 }),
      },
      event: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({ id: 77, occurrences: [] }) },
      eventCategory: { upsert: jest.fn().mockResolvedValue({}) },
      category: { findFirst: jest.fn().mockResolvedValue({ id: 4, slug: "glazba" }), findUnique: jest.fn().mockResolvedValue({ id: 4, slug: "glazba" }), upsert: jest.fn().mockResolvedValue({ id: 4, slug: "glazba" }) },
    };
    const events = new EventsService(prisma as never, { detectForEvent: jest.fn() } as never, { revalidate: jest.fn().mockResolvedValue(true) } as never);

    // A transaction client short-circuits the post-create side effects
    // (duplicate detection, cache revalidation) this test does not exercise.
    await events.createFromDto({ title: "Afterwork Party", description: "Opis", venueName: "Oxygene", cityName: "Osijek", startsAt: "2099-11-12T17:00:00+01:00" } as never, {}, prisma as never);

    expect(prisma.event.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ venueId: 12, address: "Kapucinska 41", lat: 45.56, lng: 18.68 }),
    }));
    // The stored address survives an event that brought none of its own.
    expect(prisma.venue.upsert).toHaveBeenCalledWith(expect.objectContaining({
      update: expect.objectContaining({ address: "Kapucinska 41", lat: 45.56, lng: 18.68 }),
    }));
  });
});

describe("merging duplicate venues (VEN-06)", () => {
  const venueRow = (id: number, name: string, cityId: number, extra: Record<string, unknown> = {}) =>
    ({ id, name, slug: name.toLowerCase(), cityId, address: null, lat: null, lng: null, ...extra });

  function mergeService(source: unknown, target: unknown) {
    const tx = {
      venue: {
        findUnique: jest.fn().mockImplementation(async ({ where }) => (where.id === 1 ? source : where.id === 2 ? target : null)),
        update: jest.fn().mockImplementation(async ({ data }) => ({ ...(target as object), ...data })),
        delete: jest.fn().mockResolvedValue({}),
      },
      event: { updateMany: jest.fn().mockResolvedValue({ count: 4 }) },
    };
    const prisma = { $transaction: jest.fn().mockImplementation((work: (client: unknown) => unknown) => work(tx)) };
    const admin = new AdminService(prisma as never, {} as never, {} as never, {} as never, { revalidate: jest.fn() } as never, {} as never, {} as never);
    return { admin, tx };
  }

  it("moves the events and removes the venue that was merged away", async () => {
    const { admin, tx } = mergeService(venueRow(1, "Klub Oxygene", 1, { address: "Kapucinska 41", lat: 45.5, lng: 18.6 }), venueRow(2, "Oxygene", 1));

    const result = await admin.mergeVenues(1, 2);

    expect(tx.event.updateMany).toHaveBeenCalledWith({ where: { venueId: 1 }, data: { venueId: 2 } });
    expect(tx.venue.delete).toHaveBeenCalledWith({ where: { id: 1 } });
    expect(result).toEqual(expect.objectContaining({ movedEvents: 4, removedVenueId: 1 }));
  });

  it("fills in only what the surviving venue is missing", async () => {
    const { admin, tx } = mergeService(
      venueRow(1, "Klub Oxygene", 1, { address: "Kapucinska 41", lat: 45.5, lng: 18.6 }),
      venueRow(2, "Oxygene", 1, { address: "Potvrđena adresa 1" }),
    );

    await admin.mergeVenues(1, 2);

    // The confirmed address stays; the coordinates it lacked are taken over.
    expect(tx.venue.update).toHaveBeenCalledWith({ where: { id: 2 }, data: { address: "Potvrđena adresa 1", lat: 45.5, lng: 18.6 } });
  });

  it("refuses to merge venues from different cities", async () => {
    const { admin, tx } = mergeService(venueRow(1, "Dvorana", 1), venueRow(2, "Dvorana", 9));

    await expect(admin.mergeVenues(1, 2)).rejects.toThrow("različitim gradovima");
    expect(tx.event.updateMany).not.toHaveBeenCalled();
    expect(tx.venue.delete).not.toHaveBeenCalled();
  });

  it("refuses to merge a venue into itself", async () => {
    const { admin } = mergeService(venueRow(1, "Oxygene", 1), venueRow(1, "Oxygene", 1));
    await expect(admin.mergeVenues(1, 1)).rejects.toThrow("samim sobom");
  });

  it("refuses when one of the venues no longer exists", async () => {
    const { admin } = mergeService(venueRow(1, "Oxygene", 1), null);
    await expect(admin.mergeVenues(1, 2)).rejects.toThrow("nije pronađeno");
  });
});
