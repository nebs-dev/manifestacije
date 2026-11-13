import { DuplicatesService } from "../src/duplicates/duplicates.service";
import { MonitoredSourcesService } from "../src/monitored-sources/monitored-sources.service";
import type { ParsedEventCandidate, ParsedSourceResult } from "../src/ai-parser/ai-event-parser.service";

jest.mock("../src/monitored-sources/source-fetch", () => ({
  politeFetch: jest.fn(),
  imageIsReachable: jest.fn().mockResolvedValue(false),
}));
import { politeFetch } from "../src/monitored-sources/source-fetch";

/**
 * Which thin candidates get the detail-page budget.
 *
 * The budget is 20 fetches per check and a long listing can produce far more
 * thin candidates than that, so the order decides what the editor ends up
 * with. A candidate with no date is the one kind the deduplication cannot key,
 * which means it is re-queued on every check forever — and on a month-calendar
 * page, where the day is a bare "8." heading that is never part of the entry
 * itself, that is most of the page. Measured on osijek031.com/svi-dogadaji/:
 * 53 of the 80 candidates a full read produces carry no date. Their dates are
 * on their own detail pages, so those fetches are worth strictly more than a
 * fetch that only goes looking for a missing poster.
 */

const LISTING = "https://kalendar-primjer.hr/svi-dogadaji/";

const candidate = (over: Partial<ParsedEventCandidate>): ParsedEventCandidate => ({
  title: "Događaj",
  description: "Opis događaja koji je dovoljno dug.",
  startsAt: "2027-11-20T20:00:00+01:00",
  endsAt: "",
  venueName: "Dvorana",
  address: "Županijska 9",
  city: "Osijek",
  county: "",
  region: "",
  category: "glazba",
  isFree: false,
  priceText: "",
  ticketUrl: "",
  sourceUrl: "",
  organizerName: "",
  imageUrl: "https://kalendar-primjer.hr/media/plakat-stvarni.jpg",
  confidence: 0.9,
  missingFields: [],
  warnings: [],
  ...over,
});

function fakePrisma() {
  const eventSources: Record<string, unknown>[] = [];
  let id = 1;
  const nothing = { findMany: async () => [], findUnique: async () => null, updateMany: async () => ({ count: 0 }) };
  return {
    eventSources,
    prisma: {
      discoveredSourceItem: { upsert: async () => ({ status: "NEW", createdAt: new Date(0), updatedAt: new Date(0) }), updateMany: async () => ({ count: 0 }) },
      discoveredEvent: { ...nothing, upsert: async () => ({}), update: async () => ({}) },
      monitoredSource: { update: async () => ({}) },
      event: nothing,
      eventSource: {
        create: async ({ data }: { data: Record<string, unknown> }) => {
          const row = { id: id++, ...data };
          eventSources.push(row);
          return row;
        },
        findMany: async () => [],
      },
      detailPageCache: nothing,
      ingestionJob: { create: async () => ({ id: 1 }), update: async () => ({}) },
    },
  };
}

/** A parser that returns the given candidates and resolves a detail page by URL. */
function fakeParser(candidates: ParsedEventCandidate[], detailFor: (url: string) => ParsedEventCandidate) {
  const result = (): ParsedSourceResult => ({
    sourceUrl: LISTING,
    sourceType: "batch",
    candidates: candidates.map((c) => ({ ...c })),
  });
  return {
    extractEventSubLinks: () => [],
    extractAllPageLinks: () => candidates.map((c) => `${LISTING}dogadaj/${encodeURIComponent(c.title.toLowerCase().replace(/\s+/g, "-"))}`),
    extractEmbeddedEvents: () => null,
    extractJsonLdEvents: () => null,
    textForFingerprint: (html: string) => html,
    crawlListingSubPages: async () => ({ subTexts: [], totalFound: 0, fetched: 0 }),
    parseBatchWithLlm: async () => result(),
    parseListingWithLlm: async () => ({
      result: result(),
      stats: { windowsTotal: 1, windowsParsed: 1, charsRead: 0, charsRecovered: 0, reason: "fits" as const, mergedDuplicates: 0 },
    }),
    parse: async ({ sourceUrl }: { sourceUrl?: string }) => detailFor(sourceUrl ?? ""),
    parseWithLlm: async ({ sourceUrl }: { sourceUrl?: string }) => detailFor(sourceUrl ?? ""),
  };
}

describe("detail-page budget", () => {
  const fetchMock = politeFetch as jest.MockedFunction<typeof politeFetch>;
  let fetched: string[];

  beforeEach(() => {
    fetched = [];
    fetchMock.mockReset();
    fetchMock.mockImplementation(async (url: string) => {
      fetched.push(url);
      return { outcome: "ok" as const, httpStatus: 200, body: "<html><body>detalj</body></html>", etag: null, lastModified: null, finalUrl: url };
    });
  });
  afterEach(() => jest.clearAllMocks());

  it("spends the fetches on the candidates with no date before the ones that only lack a poster", async () => {
    // 25 candidates that only want a picture come first in the array, then the
    // five that have no date at all. The budget is 20, so in array order the
    // dateless five would never be fetched — and would come back on every
    // future check, unkeyed, forever.
    const posterless = Array.from({ length: 25 }, (_, i) => candidate({ title: `Ima datum ${i}`, imageUrl: "" }));
    const dateless = Array.from({ length: 5 }, (_, i) => candidate({ title: `Nema datum ${i}`, startsAt: "" }));

    const fake = fakePrisma();
    const service = new MonitoredSourcesService(
      fake.prisma as never,
      fakeParser([...posterless, ...dateless], () => candidate({})) as never,
      new DuplicatesService(null as never),
    );

    await (service as never as { processListingPage(s: { id: number; url: string }, h: string): Promise<unknown> })
      .processListingPage({ id: 1, url: LISTING }, "<html><body>stranica</body></html>");

    const datelessFetched = fetched.filter((url) => url.includes("nema-datum"));
    expect(datelessFetched).toHaveLength(5);
    // And the cap still holds: more thin candidates than budget must not buy
    // more fetches.
    expect(fetched.length).toBeLessThanOrEqual(20);
  });
});
