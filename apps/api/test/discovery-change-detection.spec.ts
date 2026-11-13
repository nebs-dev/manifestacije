import { contentFingerprint, structuredPayloads } from "../src/monitored-sources/content-fingerprint";
import { AiEventParserService } from "../src/ai-parser/ai-event-parser.service";
import { DuplicatesService } from "../src/duplicates/duplicates.service";
import { MonitoredSourcesService } from "../src/monitored-sources/monitored-sources.service";

jest.mock("../src/monitored-sources/source-fetch", () => ({
  politeFetch: jest.fn(),
  imageIsReachable: jest.fn().mockResolvedValue(false),
}));
import { politeFetch } from "../src/monitored-sources/source-fetch";

/**
 * The whole check, end to end, against the defect that shipped in PR #4.
 *
 * Two production checks of one unchanged cinema programme, ten minutes apart,
 * each queued all 34 events on it. The page was 314 079 bytes both times with
 * a different sha256 — a nonce — while the text the parser extracts was
 * byte-identical (5 249 characters). Nothing here stubs the change detection
 * itself: the service is driven through `runNow` with a fake HTTP layer, and
 * what is counted is how often the model is asked and how many cards come out.
 */

const LISTING = "https://kino-primjer.hr/tjedni-pregled/";

/** A page whose bytes move on every fetch while its content does not. */
const pageWithNonce = (events: { title: string; time: string; day: number }[], nonce: string) => `
<!doctype html><html><head>
  <meta name="csrf" content="${nonce}">
  <script>window.__sessionToken = "${nonce}";</script>
</head><body>
  <nav>Naslovnica Program Kontakt</nav>
  <main>
    <h1>Tjedni pregled</h1>
    ${events.map((e) => `<article><h2>${e.title}</h2><p>${e.day}.11.2027. u ${e.time}, Osijek</p></article>`).join("\n")}
  </main>
  <footer>Kino Primjer, Osijek <span data-ad="${nonce}">oglas</span></footer>
</body></html>`;

describe("content fingerprint", () => {
  const events = [{ title: "Vojni rok", time: "20:00", day: 20 }];

  it("is unmoved by a nonce, a session token and a rotating advert", () => {
    const a = pageWithNonce(events, "aaaa1111");
    const b = pageWithNonce(events, "bbbb2222");
    const parser = new AiEventParserService();
    const fp = (html: string) =>
      contentFingerprint({ text: parser.textForFingerprint(html), links: [], html, baseUrl: LISTING });

    expect(a).not.toBe(b);
    expect(fp(a)).toBe(fp(b));
  });

  it("moves when an event's time changes", () => {
    const parser = new AiEventParserService();
    const fp = (html: string) =>
      contentFingerprint({ text: parser.textForFingerprint(html), links: [], html, baseUrl: LISTING });

    expect(fp(pageWithNonce([{ title: "Vojni rok", time: "21:00", day: 20 }], "x")))
      .not.toBe(fp(pageWithNonce(events, "x")));
  });

  it("moves when a detail page appears or disappears, even with identical text", () => {
    const html = pageWithNonce(events, "x");
    const base = { text: "same text", html, baseUrl: LISTING };

    expect(contentFingerprint({ ...base, links: ["/dogadaj/a"] }))
      .not.toBe(contentFingerprint({ ...base, links: ["/dogadaj/a", "/dogadaj/b"] }));
  });

  it("treats the same link written two ways as one link", () => {
    const html = pageWithNonce(events, "x");
    const base = { text: "same text", html, baseUrl: LISTING };

    expect(contentFingerprint({ ...base, links: ["https://kino-primjer.hr/dogadaj/a"] }))
      .toBe(contentFingerprint({ ...base, links: ["/dogadaj/a/", "/dogadaj/a?utm_source=fb"] }));
  });

  it("moves when structured data changes, and not when it is merely reordered", () => {
    const ld = (body: string) => `<html><body><script type="application/ld+json">${body}</script></body></html>`;
    const one = ld('{"@type":"Event","name":"Vojni rok","startDate":"2027-11-20T20:00"}');
    const reordered = ld('{"startDate":"2027-11-20T20:00","@type":"Event","name":"Vojni rok"}');
    const changed = ld('{"@type":"Event","name":"Vojni rok","startDate":"2027-11-20T21:00"}');

    expect(structuredPayloads(one)).toEqual(structuredPayloads(reordered));
    expect(structuredPayloads(one)).not.toEqual(structuredPayloads(changed));
  });
});

describe("a monitored source check, end to end", () => {
  const fetchMock = politeFetch as jest.MockedFunction<typeof politeFetch>;

  type Row = Record<string, unknown>;

  function harness(pages: () => string, candidates: () => Row[]) {
    const discoveredEvents = new Map<string, Row>();
    const eventSources: { id: number; parsedJson: unknown }[] = [];
    const jobs: Row[] = [];
    let modelCalls = 0;
    let nextId = 1;
    const sourceRow: Row = {
      id: 1, url: LISTING, sourceType: "LISTING_PAGE", isActive: true, checkIntervalMinutes: 1440,
      etag: null, lastModified: null, contentHash: null, contentFingerprint: null, lastFullParseAt: null,
      checkingSince: null, consecutiveFailures: 0, organizerId: null,
    };

    const bump = (row: Row, data: Row) => {
      for (const [k, v] of Object.entries(data)) {
        if (v && typeof v === "object" && "increment" in (v as object)) row[k] = ((row[k] as number) ?? 0) + (v as { increment: number }).increment;
        else row[k] = v;
      }
    };

    const prisma = {
      event: { findMany: async () => [] },
      ingestionJob: {
        create: async ({ data }: { data: Row }) => { const j = { id: jobs.length + 1, ...data }; jobs.push(j); return j; },
        update: async ({ where, data }: { where: { id: number }; data: Row }) => {
          Object.assign(jobs[(where.id as number) - 1], data); return jobs[(where.id as number) - 1];
        },
      },
      monitoredSource: {
        findUniqueOrThrow: async () => ({ ...sourceRow }),
        findUnique: async () => ({ ...sourceRow }),
        update: async ({ data }: { data: Row }) => { Object.assign(sourceRow, data); return { ...sourceRow }; },
        updateMany: async () => ({ count: 1 }),
      },
      discoveredSourceItem: {
        upsert: async () => ({ status: "NEW", createdAt: new Date(0), updatedAt: new Date(1) }),
        updateMany: async () => ({ count: 0 }),
        findUnique: async () => null,
      },
      discoveredEvent: {
        findMany: async ({ where }: { where: Row }) => {
          const w = where as { identityKey?: { in: string[] }; titleKey?: { in: string[] }; OR?: unknown };
          if (w.identityKey) return w.identityKey.in.map((k) => discoveredEvents.get(k)).filter(Boolean);
          const titles = new Set(w.titleKey?.in ?? []);
          return [...discoveredEvents.values()].filter((r) => titles.has(r.titleKey as string)
            && (!w.OR || r.importedEventId != null || r.ignoredAt != null));
        },
        upsert: async ({ where, create, update }: { where: { identityKey: string }; create: Row; update: Row }) => {
          const found = discoveredEvents.get(where.identityKey);
          if (found) bump(found, update);
          // Mirrors the column defaults the real table applies on insert.
          else discoveredEvents.set(where.identityKey, { identityKey: where.identityKey, importedEventId: null, ignoredAt: null, timesSeen: 1, timesQueued: 1, ...create });
          return discoveredEvents.get(where.identityKey);
        },
        updateMany: async ({ where, data }: { where: { identityKey: { in: string[] } }; data: Row }) => {
          for (const k of where.identityKey.in) { const f = discoveredEvents.get(k); if (f) bump(f, data); }
          return { count: 0 };
        },
      },
      eventSource: {
        create: async ({ data }: { data: Row }) => { const r = { id: nextId++, parsedJson: data.parsedJson }; eventSources.push(r); return r; },
        findMany: async ({ where }: { where: { id: { in: number[] } } }) =>
          eventSources.filter((r) => where.id.in.includes(r.id)).map((r) => ({ id: r.id })),
      },
    };

    const realParser = new AiEventParserService();
    const parser = {
      extractEventSubLinks: () => [],
      extractAllPageLinks: () => [],
      extractEmbeddedEvents: () => null,
      extractJsonLdEvents: () => null,
      crawlListingSubPages: async () => ({ subTexts: [], totalFound: 0, fetched: 0 }),
      textForFingerprint: (html: string) => realParser.textForFingerprint(html),
      parseBatchWithLlm: async () => {
        modelCalls += 1;
        return { sourceUrl: LISTING, sourceType: "batch" as const, candidates: candidates() };
      },
      // Routed through the same counter on purpose: the point of these tests is
      // how many model calls a re-check costs, and the listing read is where
      // those calls are now made. The fixture pages are short, so the real
      // selection would give exactly one window for each of them.
      parseListingWithLlm: async () => {
        modelCalls += 1;
        return {
          result: { sourceUrl: LISTING, sourceType: "batch" as const, candidates: candidates() },
          stats: {
            windowsTotal: 1, windowsParsed: 1, charsRead: 0, charsRecovered: 0,
            reason: "fits" as const, mergedDuplicates: 0,
          },
        };
      },
    };

    fetchMock.mockImplementation(async () => ({
      outcome: "ok" as const, httpStatus: 200, body: pages(), etag: null, lastModified: null, finalUrl: LISTING,
    }));

    const service = new MonitoredSourcesService(prisma as never, parser as never, new DuplicatesService(null as never));
    return {
      service,
      state: { discoveredEvents, eventSources, jobs, sourceRow },
      get modelCalls() { return modelCalls; },
      run: () => (service as never as { checkClaimedSource(s: Row): Promise<void> }).checkClaimedSource({ ...sourceRow }),
      lastResult: () => (jobs.at(-1) as { result?: Record<string, number> } | undefined)?.result ?? {},
      cards: () => eventSources.reduce((n, r) => n + ((r.parsedJson as { candidates: unknown[] }).candidates.length), 0),
    };
  }

  const candidate = (title: string, day: number, time = "20:00", over: Row = {}) => ({
    title, description: `Opis: ${title}.`,
    startsAt: `2027-11-${String(day).padStart(2, "0")}T${time}:00+01:00`,
    endsAt: "", venueName: "Kino Primjer", address: "Trg 1", city: "Osijek", county: "", region: "",
    category: "film", isFree: false, priceText: "5 €", ticketUrl: "", sourceUrl: "", organizerName: "",
    imageUrl: "", confidence: 0.9, missingFields: [], warnings: [], _status: "pending" as const, ...over,
  });

  beforeEach(() => fetchMock.mockReset());

  it("two checks of the same content: no new cards and no second model call", async () => {
    // The exact production failure. Only the nonce moves between fetches.
    let nonce = "first";
    const roster = [candidate("Vojni rok", 20), candidate("Kristalni planet", 21)];
    const h = harness(() => pageWithNonce([{ title: "Vojni rok", time: "20:00", day: 20 }], nonce), () => roster.map((c) => ({ ...c })));

    await h.run();
    expect(h.modelCalls).toBe(1);
    expect(h.cards()).toBe(2);

    nonce = "second";
    await h.run();

    expect(h.modelCalls).toBe(1);
    expect(h.state.eventSources).toHaveLength(1);
    expect(h.lastResult()).toEqual({ outcome: "unchanged", reason: "fingerprint" });
  });

  it("one genuinely new event: exactly one new card", async () => {
    let roster = [candidate("Vojni rok", 20), candidate("Kristalni planet", 21)];
    let events = [{ title: "Vojni rok", time: "20:00", day: 20 }];
    const h = harness(() => pageWithNonce(events, "n"), () => roster.map((c) => ({ ...c })));

    await h.run();
    roster = [...roster, candidate("Posljednji rimski bog", 22)];
    events = [...events, { title: "Posljednji rimski bog", time: "18:00", day: 22 }];
    await h.run();

    expect(h.lastResult().candidatesCreated).toBe(1);
    expect(h.lastResult().candidatesSkipped).toBe(2);
    expect(h.cards()).toBe(3);
  });

  it("several screenings of one film: every term reaches the editor and survives a re-check", async () => {
    // Keying on the day alone would make the 18:00 showing an alias of the
    // 20:00 one, and publishing either would bury the other for good.
    const roster = [
      candidate("Vojni rok", 20, "18:00"),
      candidate("Vojni rok", 20, "20:00"),
      candidate("Vojni rok", 21, "20:00"),
    ];
    let nonce = "a";
    const h = harness(() => pageWithNonce([{ title: "Vojni rok", time: "18:00", day: 20 }], nonce), () => roster.map((c) => ({ ...c })));

    await h.run();
    expect(h.lastResult().candidatesCreated).toBe(3);
    expect(h.state.discoveredEvents.size).toBe(3);

    nonce = "b";
    await h.run();
    expect(h.cards()).toBe(3);
  });

  it("a changed time on a published event comes back as an edit, naming the event", async () => {
    let roster = [candidate("Vojni rok", 20, "20:00")];
    let events = [{ title: "Vojni rok", time: "20:00", day: 20 }];
    const h = harness(() => pageWithNonce(events, "n"), () => roster.map((c) => ({ ...c })));

    await h.run();
    for (const row of h.state.discoveredEvents.values()) row.importedEventId = 77;

    roster = [candidate("Vojni rok", 20, "21:30")];
    events = [{ title: "Vojni rok", time: "21:30", day: 20 }];
    await h.run();

    expect(h.lastResult().candidatesCreated).toBe(1);
    const card = (h.state.eventSources.at(-1) as {
      parsedJson: { candidates: { warnings: string[]; _existingEventId?: number; _status?: string }[] };
    }).parsedJson.candidates[0];
    expect(card._existingEventId).toBe(77);
    expect(card.warnings.join(" ")).toMatch(/#77/);
    // Advisory: the editor still decides, and the card is still importable.
    expect(card._status).toBe("pending");
  });

  it("a differently worded model answer for the same page is not a change", async () => {
    // The model is free to reword a description or name a venue differently.
    // None of that is a fact about the event, and it must not produce a card.
    let variant = 0;
    const roster = () => [
      candidate("Vojni rok", 20, "20:00", {
        description: variant === 0 ? "Komedija o vojnom roku." : "Duhovita predstava o vojsci.",
        venueName: variant === 0 ? "Kino Primjer" : "Kino Primjer, velika dvorana",
        imageUrl: variant === 0 ? "" : "https://cdn.example/poster.jpg",
      }),
    ];
    // The page text changes too, or the fingerprint would stop the second run
    // before the model is reached and prove nothing.
    let events = [{ title: "Vojni rok", time: "20:00", day: 20 }];
    const h = harness(() => pageWithNonce(events, "n"), roster);

    await h.run();
    variant = 1;
    events = [{ title: "Vojni rok", time: "20:00", day: 20 }, { title: "Najava", time: "10:00", day: 25 }];
    await h.run();

    // The second run re-parsed (the page really did change) but the event
    // itself is unchanged, so no second card for it.
    expect(h.lastResult().candidatesCreated).toBe(0);
    expect(h.cards()).toBe(1);
  });

  it("honours a decision recorded under the old key shape", async () => {
    // The 1 260 identities seeded from the backlog were keyed off candidates
    // that had already been through enrichment, so 161 of them carry a
    // "|url|" key for an event this code now keys as "|ev|". The 43 published
    // and 69 rejected decisions have to survive that, or the inbox fills up
    // with events editors already dealt with.
    const roster = [candidate("Vojni rok", 20, "20:00")];
    const h = harness(() => pageWithNonce([{ title: "Vojni rok", time: "20:00", day: 20 }], "n"), () => roster.map((c) => ({ ...c })));

    h.state.discoveredEvents.set("kino-primjer.hr|url|https://kino-primjer.hr/film/vojni-rok|2027-11-20", {
      identityKey: "kino-primjer.hr|url|https://kino-primjer.hr/film/vojni-rok|2027-11-20",
      sourceScope: "kino-primjer.hr",
      titleKey: "vojni rok",
      cityName: "Osijek",
      startsAt: new Date("2027-11-20T20:00:00+01:00"),
      contentHash: "whatever-the-old-pipeline-produced",
      importedEventId: 501,
      ignoredAt: null,
      lastEventSourceId: null,
      timesSeen: 3,
      timesQueued: 3,
    });

    await h.run();

    expect(h.lastResult().candidatesCreated).toBe(0);
    expect(h.state.eventSources).toHaveLength(0);
  });

  it("does not let that decision swallow a different screening of the same film", async () => {
    // Same film, same day, published at 18:00 — the 20:00 showing is a
    // separate event and must still reach the editor.
    const roster = [candidate("Vojni rok", 20, "20:00")];
    const h = harness(() => pageWithNonce([{ title: "Vojni rok", time: "20:00", day: 20 }], "n"), () => roster.map((c) => ({ ...c })));

    h.state.discoveredEvents.set("kino-primjer.hr|url|https://kino-primjer.hr/film/vojni-rok|2027-11-20", {
      identityKey: "kino-primjer.hr|url|https://kino-primjer.hr/film/vojni-rok|2027-11-20",
      sourceScope: "kino-primjer.hr", titleKey: "vojni rok", cityName: "Osijek",
      startsAt: new Date("2027-11-20T18:00:00+01:00"),
      contentHash: "old", importedEventId: 501, ignoredAt: null, lastEventSourceId: null, timesSeen: 1, timesQueued: 1,
    });

    await h.run();

    expect(h.lastResult().candidatesCreated).toBe(1);
  });

  it("is idempotent: a third and fourth check add nothing", async () => {
    const roster = [candidate("Vojni rok", 20), candidate("Kristalni planet", 21)];
    let nonce = 0;
    const h = harness(() => pageWithNonce([{ title: "Vojni rok", time: "20:00", day: 20 }], `n${nonce}`), () => roster.map((c) => ({ ...c })));

    await h.run();
    for (let i = 0; i < 3; i++) { nonce += 1; await h.run(); }

    expect(h.modelCalls).toBe(1);
    expect(h.state.eventSources).toHaveLength(1);
    expect(h.cards()).toBe(2);
    expect([...h.state.discoveredEvents.values()].every((r) => (r.timesQueued as number) === 1)).toBe(true);
  });
});
