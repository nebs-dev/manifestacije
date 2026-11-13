import {
  decideDiscovery,
  discoveryContentHash,
  discoveryIdentityKey,
  discoveryScope,
  firstTermDateKey,
  type DiscoveryRecord,
  type IdentifiableCandidate,
} from "../src/monitored-sources/discovery-identity";

/**
 * The deduplication rules, case by case.
 *
 * Every test here is a production shape. The queue held 3 179 candidate cards
 * for 748 distinct events — 40 cards for one comedy, 39 for one film screening
 * — because a re-check of a listing page re-queued everything on it. The risk
 * in fixing that is the opposite failure: merging two events that merely read
 * alike loses one of them silently, which is far worse than a duplicate card.
 * So the "keeps apart" tests matter more than the "treats as one" tests.
 */

const LISTING = "https://kinematografi-osijek.hr/tjedni-pregled/";

const candidate = (over: Partial<IdentifiableCandidate> = {}): IdentifiableCandidate => ({
  title: "Komedija \"Vojni rok\"",
  description: "Predstava u Kazalištu.",
  startsAt: "2026-11-20T20:00:00+01:00",
  endsAt: "",
  venueName: "HNK Osijek",
  address: "Županijska 9",
  city: "Osijek",
  category: "predstava",
  isFree: false,
  priceText: "15 €",
  ticketUrl: "",
  imageUrl: "",
  sourceUrl: "",
  ...over,
});

describe("discoveryScope", () => {
  it("scopes identity to the host, not the source row, so a delete and re-add keeps the memory", () => {
    // MonitoredSource is hard deleted and DiscoveredSourceItem cascades with
    // it; 34 of 35 production sources were deleted and took the record of
    // everything they had found with them. A host string survives that.
    expect(discoveryScope("https://www.kinematografi-osijek.hr/tjedni-pregled/")).toBe("kinematografi-osijek.hr");
    expect(discoveryScope("https://kinematografi-osijek.hr/drugi-popis?page=2")).toBe("kinematografi-osijek.hr");
  });

  it("falls back to the raw string rather than throwing on an unparseable URL", () => {
    expect(discoveryScope("not a url")).toBe("not a url");
  });
});

describe("discoveryIdentityKey", () => {
  it("gives the same key to the same event seen on two checks of one page", () => {
    const first = discoveryIdentityKey(candidate(), LISTING);
    // The second check reads the same event with incidental differences: a
    // tidied description and a price the site reformatted.
    const second = discoveryIdentityKey(
      candidate({ description: "Predstava  u   Kazalištu.", priceText: "15,00 EUR" }),
      LISTING
    );

    expect(first).not.toBeNull();
    expect(second).toBe(first);
  });

  it("ignores casing, diacritics and spacing in the title", () => {
    expect(discoveryIdentityKey(candidate({ title: "KOMEDIJA  \"VOJNI  ROK\"" }), LISTING))
      .toBe(discoveryIdentityKey(candidate(), LISTING));
  });

  it("keeps two terms of the same event apart — a weekly programme is not one event", () => {
    const monday = discoveryIdentityKey(candidate({ startsAt: "2026-11-20T20:00:00+01:00" }), LISTING);
    const tuesday = discoveryIdentityKey(candidate({ startsAt: "2026-11-21T20:00:00+01:00" }), LISTING);

    expect(monday).not.toBe(tuesday);
  });

  it("keeps the same title in another city apart", () => {
    expect(discoveryIdentityKey(candidate({ city: "Vinkovci" }), LISTING))
      .not.toBe(discoveryIdentityKey(candidate(), LISTING));
  });

  it("keeps the same event apart when it is found on a different site", () => {
    // Two tourist boards listing one regional festival stay two candidates.
    // Collapsing them is the job of the already-imported check and the
    // duplicate queue, which a human supervises; doing it here would hide an
    // event behind a site whose parse happened to be worse.
    expect(discoveryIdentityKey(candidate(), "https://visitslavoniabaranja.com/dogadaji/"))
      .not.toBe(discoveryIdentityKey(candidate(), LISTING));
  });

  it("refuses to identify a candidate with no date — 710 production candidates had none", () => {
    // A guessed identity would merge a dateless "Kviz" with every other
    // dateless "Kviz" on the site. No key means "queue it every time", which
    // costs a click rather than an event.
    expect(discoveryIdentityKey(candidate({ startsAt: "", occurrences: [] }), LISTING)).toBeNull();
  });

  it("refuses to identify a candidate with no title", () => {
    expect(discoveryIdentityKey(candidate({ title: "" }), LISTING)).toBeNull();
  });

  it("uses the candidate's own detail page when the listing gave it one", () => {
    const withDetail = discoveryIdentityKey(
      candidate({ sourceUrl: "https://kinematografi-osijek.hr/film/vojni-rok" }),
      LISTING
    );

    expect(withDetail).toContain("|url|");
    // A tracking tag or a trailing slash is the same page.
    expect(
      discoveryIdentityKey(
        candidate({ sourceUrl: "https://kinematografi-osijek.hr/film/vojni-rok/?utm_source=fb" }),
        LISTING
      )
    ).toBe(withDetail);
  });

  it("does not let a detail URL swallow the separate terms announced on it", () => {
    const detail = "https://kinematografi-osijek.hr/film/vojni-rok";
    const first = discoveryIdentityKey(candidate({ sourceUrl: detail, startsAt: "2026-11-20T20:00:00+01:00" }), LISTING);
    const second = discoveryIdentityKey(candidate({ sourceUrl: detail, startsAt: "2026-11-21T20:00:00+01:00" }), LISTING);

    expect(first).not.toBe(second);
  });

  it("does not treat the listing's own URL as a detail page", () => {
    const self = discoveryIdentityKey(candidate({ sourceUrl: LISTING }), LISTING);

    expect(self).toContain("|ev|");
  });

  it("reads the first term out of occurrences, so a reordered schedule is still one event", () => {
    const ascending = candidate({
      startsAt: "",
      occurrences: [
        { startsAt: "2026-11-20T20:00:00+01:00" },
        { startsAt: "2026-11-27T20:00:00+01:00" },
      ],
    });
    const descending = candidate({
      startsAt: "",
      occurrences: [
        { startsAt: "2026-11-27T20:00:00+01:00" },
        { startsAt: "2026-11-20T20:00:00+01:00" },
      ],
    });

    expect(discoveryIdentityKey(descending, LISTING)).toBe(discoveryIdentityKey(ascending, LISTING));
  });
});

describe("firstTermDateKey", () => {
  it("reads a late-evening start as its own Zagreb day, not the UTC one", () => {
    expect(firstTermDateKey(candidate({ startsAt: "2026-07-20T23:30:00+02:00" }))).toBe("2026-07-20");
  });

  it("returns an empty key rather than a wrong one for an unparseable date", () => {
    expect(firstTermDateKey(candidate({ startsAt: "nekad u studenom" }))).toBe("");
  });
});

describe("discoveryContentHash", () => {
  it("is stable across the parser noise that changes every run", () => {
    const first = discoveryContentHash(candidate());
    // Confidence, warnings, missingFields and _status all wobble between
    // checks. Hashing the whole candidate would report "changed" forever and
    // undo the deduplication entirely.
    const second = discoveryContentHash({
      ...candidate(),
      ...({ confidence: 0.42, warnings: ["nešto"], missingFields: ["city"], _status: "pending" } as object),
    });

    expect(second).toBe(first);
  });

  it("changes when the source moves the start time", () => {
    expect(discoveryContentHash(candidate({ startsAt: "2026-11-20T21:00:00+01:00" })))
      .not.toBe(discoveryContentHash(candidate()));
  });

  it("changes when a term is added to the schedule", () => {
    const one = candidate({ occurrences: [{ startsAt: "2026-11-20T20:00:00+01:00" }] });
    const two = candidate({
      occurrences: [{ startsAt: "2026-11-20T20:00:00+01:00" }, { startsAt: "2026-11-21T20:00:00+01:00" }],
    });

    expect(discoveryContentHash(two)).not.toBe(discoveryContentHash(one));
  });

  it("changes when the venue or the price changes", () => {
    const base = discoveryContentHash(candidate());

    expect(discoveryContentHash(candidate({ venueName: "Dvorana Franjo Krežma" }))).not.toBe(base);
    expect(discoveryContentHash(candidate({ priceText: "20 €" }))).not.toBe(base);
  });

  it("ignores the description and the poster, which are prose and pictures, not facts", () => {
    // Both are written or resolved downstream and neither changes what the
    // event is. Counting them re-queued events editors had already published
    // every time the model reworded a sentence.
    const base = discoveryContentHash(candidate());

    expect(discoveryContentHash(candidate({ description: "Posve drukčiji opis iste predstave." }))).toBe(base);
    expect(discoveryContentHash(candidate({ imageUrl: "https://cdn.example/poster.jpg" }))).toBe(base);
  });

  it("does not change when only whitespace in the description moves", () => {
    expect(discoveryContentHash(candidate({ description: "Predstava\n\n u Kazalištu." })))
      .toBe(discoveryContentHash(candidate({ description: "Predstava u Kazalištu." })));
  });
});

describe("decideDiscovery", () => {
  const record = (over: Partial<DiscoveryRecord> = {}): DiscoveryRecord => ({
    identityKey: "k",
    contentHash: "h",
    importedEventId: null,
    ignoredAt: null,
    lastEventSourceId: 7,
    ...over,
  });
  const live = new Set([7]);

  it("queues an event nobody has on record", () => {
    expect(decideDiscovery("k", "h", undefined, live)).toEqual({ action: "queue", reason: "new" });
  });

  it("queues an unidentifiable candidate every time", () => {
    expect(decideDiscovery(null, "h", undefined, live)).toEqual({ action: "queue", reason: "unkeyed" });
  });

  it("skips an event already waiting in the inbox — this is the duplicate that was being created", () => {
    expect(decideDiscovery("k", "h", record(), live)).toEqual({ action: "skip", reason: "unchanged" });
  });

  it("skips an event an editor already published", () => {
    expect(decideDiscovery("k", "h", record({ importedEventId: 55 }), live)).toEqual({ action: "skip", reason: "imported" });
  });

  it("skips an event an editor already rejected", () => {
    expect(decideDiscovery("k", "h", record({ ignoredAt: new Date() }), live)).toEqual({ action: "skip", reason: "ignored" });
  });

  it("does not re-queue an event an editor has not judged yet, however the content moved", () => {
    // The card is already in front of them. Adding a second one for the same
    // event is precisely the duplicate this mechanism exists to prevent, and
    // testing the hash before this was the defect that shipped in PR #4.
    expect(decideDiscovery("k", "h2", record(), live)).toEqual({ action: "skip", reason: "unchanged" });
  });

  it("queues again when the source changed an event whose card is gone and was never judged", () => {
    expect(decideDiscovery("k", "h2", record({ lastEventSourceId: 999 }), live))
      .toEqual({ action: "queue", reason: "changed" });
  });

  it("queues again when the source changed an event an editor had rejected", () => {
    expect(decideDiscovery("k", "h2", record({ ignoredAt: new Date() }), live))
      .toEqual({ action: "queue", reason: "changed" });
  });

  it("tells a changed-after-publishing event apart, so the card can say 'edit #55' not 'create'", () => {
    expect(decideDiscovery("k", "h2", record({ importedEventId: 55 }), live))
      .toEqual({ action: "queue", reason: "changed-after-import" });
  });

  it("queues an undecided event whose only review row has been deleted", () => {
    // Deleting a queue row must not retire an event nobody ever judged —
    // bulk delete is the one bulk action the queue has, and it was used.
    expect(decideDiscovery("k", "h", record({ lastEventSourceId: 999 }), live))
      .toEqual({ action: "queue", reason: "orphaned" });
    expect(decideDiscovery("k", "h", record({ lastEventSourceId: null }), live))
      .toEqual({ action: "queue", reason: "orphaned" });
  });

  it("still skips a decided event whose review row has been deleted", () => {
    expect(decideDiscovery("k", "h", record({ lastEventSourceId: 999, importedEventId: 55 }), live))
      .toEqual({ action: "skip", reason: "imported" });
  });
});
