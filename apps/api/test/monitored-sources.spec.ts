import { AiEventParserService } from "../src/ai-parser/ai-event-parser.service";
import { AdminService } from "../src/admin/admin.service";
import { MonitoredSourcesService } from "../src/monitored-sources/monitored-sources.service";
import { normalizeUrl } from "../src/monitored-sources/url-normalize";

// Every case below is a regression from a real Croatian source that shipped
// broken data. None of them touch the network.

describe("normalizeUrl", () => {
  it("treats tracking-tagged and bare links as the same discovered item", () => {
    const bare = normalizeUrl("https://example.hr/dogadaj/koncert", "https://example.hr/");

    expect(normalizeUrl("https://example.hr/dogadaj/koncert?utm_source=fb&fbclid=xyz", "https://example.hr/")).toBe(bare);
    expect(normalizeUrl("https://EXAMPLE.hr:443/dogadaj/koncert#program", "https://example.hr/")).toBe(bare);
    expect(normalizeUrl("/dogadaj/koncert/", "https://example.hr/")).toBe(bare);
  });
});

describe("embedded event extraction", () => {
  const parser = new AiEventParserService();

  // Sites that render everything client-side stream their data as escaped
  // JSON inside script tags; scraping the rendered HTML found almost nothing.
  const flightPayload = (events: unknown) =>
    `<script>self.__next_f.push([1,${JSON.stringify(`{"initialEvents":${JSON.stringify(events)}}`)}])</script>`;

  it("reads events out of streamed RSC chunks instead of the rendered page", () => {
    const html = flightPayload([
      {
        name: "Stitch & Chill",
        description: "Radionica vezenja",
        date: "2026-07-29",
        time: "18:00:00",
        venue_name: "Grejp",
        venue_address: "Kapucinska ulica 41",
        city: "osijek",
        category: "workshop",
        price_info: "20 €",
        is_free: false,
        image_url: "https://cdn.example/poster.webp",
      },
    ]);

    const result = parser.extractEmbeddedEvents(html, "https://www.kuda.hr/");

    expect(result?.candidates).toHaveLength(1);
    expect(result?.candidates[0]).toEqual(expect.objectContaining({
      title: "Stitch & Chill",
      venueName: "Grejp",
      address: "Kapucinska ulica 41",
      city: "Osijek",
      priceText: "20 €",
      imageUrl: "https://cdn.example/poster.webp",
    }));
  });

  it("stamps wall-clock times with the Zagreb offset so a UTC host reads them correctly", () => {
    const summer = parser.extractEmbeddedEvents(
      flightPayload([{ name: "Ljetni koncert", date: "2026-07-29", time: "18:00:00", city: "osijek" }]),
      "https://www.kuda.hr/",
    );
    const winter = parser.extractEmbeddedEvents(
      flightPayload([{ name: "Zimski koncert", date: "2026-01-15", time: "19:30:00", city: "osijek" }]),
      "https://www.kuda.hr/",
    );

    expect(summer?.candidates[0].startsAt).toBe("2026-07-29T18:00:00+02:00");
    expect(winter?.candidates[0].startsAt).toBe("2026-01-15T19:30:00+01:00");
  });

  it("prefers the source's own category over keyword guessing", () => {
    // "radionica vezenja" contains "vez", a tradicija-i-folklor keyword.
    const result = parser.extractEmbeddedEvents(
      flightPayload([{ name: "Stitch & Chill - radionica vezenja", date: "2026-07-29", city: "osijek", category: "workshop" }]),
      "https://www.kuda.hr/",
    );

    expect(result?.candidates[0].category).toBe("radionice");
  });

  it("returns null for pages with no embedded payload so the LLM path still runs", () => {
    expect(parser.extractEmbeddedEvents("<html><body>Nema podataka</body></html>", "https://example.hr/")).toBeNull();
  });
});

describe("category guessing", () => {
  const parser = new AiEventParserService();
  const guess = (text: string) => (parser as never as { guessCategory(t: string): string }).guessCategory(text);

  it("does not match a keyword buried inside an unrelated word", () => {
    // "Passport" ends in "sport"; "vezenja" starts with "vez" (folklore).
    expect(guess("Nagradna igra Portanova Summer Passport")).toBe("");
    expect(guess("Sajam antikviteta")).toBe("sajmovi");
  });

  it("still matches Croatian inflections of a keyword", () => {
    expect(guess("Izložbe fotografija")).toBe("izlozbe");
    expect(guess("Radionice keramike")).toBe("radionice");
  });
});

describe("truncated model output", () => {
  const parser = new AiEventParserService();
  const salvage = (text: string) =>
    (parser as never as { salvageTruncatedCandidates(t: string): { candidates: unknown[] } | null }).salvageTruncatedCandidates(text);

  it("keeps the candidates that completed when the response was cut mid-array", () => {
    const truncated = '{"candidates":[{"title":"Prvi"},{"title":"Drugi"},{"title":"Treci sa odsjece';

    expect(salvage(truncated)).toEqual({ candidates: [{ title: "Prvi" }, { title: "Drugi" }] });
  });

  it("recovers the completed fields of a truncated single-event object", () => {
    expect(salvage('{"title":"Osječko ljeto kulture","description":"Zapoceo je opis koji')).toEqual({
      candidates: [{ title: "Osječko ljeto kulture" }],
    });
  });

  it("gives up rather than inventing a candidate from unusable output", () => {
    expect(salvage("Nisam pronasao nijedan dogadaj.")).toBeNull();
  });
});

describe("scraped image classification", () => {
  const service = new MonitoredSourcesService(null as never, null as never);
  const isGeneric = (url: string) => (service as never as { isGenericImage(u: string): boolean }).isGenericImage(url);

  it("rejects site-wide fallbacks and generated social cards", () => {
    expect(isGeneric("https://kuda.hr/og-default.png")).toBe(true);
    expect(isGeneric("https://site.hr/images/logo.png")).toBe(true);
    // Per-event filename, but still a title rendered over a template.
    expect(isGeneric("https://kuda.hr/api/og/ljeto-na-banji-20260722")).toBe(true);
  });

  it("keeps real per-event photos, including ones whose name merely contains 'og'", () => {
    expect(isGeneric("https://cdn.example/event-images/scraped/ljeto-na-banji-1784.webp")).toBe(false);
    expect(isGeneric("https://site.hr/blog/ogulin-fest.jpg")).toBe(false);
  });
});

describe("organizer matching", () => {
  const service = new AdminService(null as never, null as never, null as never, null as never, null as never, null as never, null as never);
  const internals = service as never as {
    normalizeOrganizerName(v: string): string;
    splitOrganizerNames(v: string): string[];
  };
  const sameOrganizer = (a: string, b: string) =>
    internals.normalizeOrganizerName(a) === internals.normalizeOrganizerName(b);

  it("does not fork one organizer over casing, diacritics or a legal suffix", () => {
    expect(sameOrganizer("Centar za kulturu Đakovo", "Centar za kulturu Dakovo")).toBe(true);
    expect(sameOrganizer("KULTURNI CENTAR OSIJEK", "Kulturni centar Osijek")).toBe(true);
    expect(sameOrganizer("Entrio d.o.o.", "Entrio")).toBe(true);
  });

  it("keeps genuinely different organizers apart", () => {
    expect(sameOrganizer("Kulturni centar Osijek", "Kulturni centar Vinkovci")).toBe(false);
  });

  it("splits a credit line into the parties it names", () => {
    expect(internals.splitOrganizerNames("Incognito Agency, Entrio i Centar za kulturu Đakovo")[0]).toBe("Incognito Agency");
    expect(internals.splitOrganizerNames("Ronilački centar Osijek, AIDA Hrvatska")).toHaveLength(2);
  });

  it("does not split on ' i ', which appears inside real Croatian names", () => {
    expect(internals.splitOrganizerNames("Sport i rekreacija Slavonija")).toEqual(["Sport i rekreacija Slavonija"]);
    expect(internals.splitOrganizerNames("Kulturni centar Vinkovci i ŽAKUD VSŽ")).toHaveLength(1);
  });

  it("drops a parenthesised list of people rather than reading it as co-organizers", () => {
    expect(internals.splitOrganizerNames("Kazalište Grupa (Žijah Sokolović, Dražen Šivak)")).toEqual(["Kazalište Grupa"]);
  });
});
