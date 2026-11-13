import { AdminService } from "../src/admin/admin.service";
import { AiEventParserService } from "../src/ai-parser/ai-event-parser.service";

/**
 * Source text for the review screen's comparison panel.
 *
 * A monitored-source check stores the page it fetched in `rawHtml` and never
 * fills `rawText`, so on exactly the rows the editorial inbox exists for the
 * panel that compares the AI's reading against the source had nothing to show.
 * The text is derived on read from markup already on the row — no write, no
 * migration, and it works for rows that were stored months ago.
 */

type Row = Record<string, unknown> | null;

function service(row: Row) {
  const prisma = { eventSource: { findUnique: async () => row } };
  return new AdminService(
    prisma as never,
    null as never,
    new AiEventParserService(),
    null as never,
    null as never,
    null as never,
    null as never,
  );
}

const page = (body: string) =>
  `<!doctype html><html><head><title>Program</title><style>.a{color:red}</style></head>
   <body><nav>Naslovnica Kontakt</nav><main>${body}</main><footer>Impressum</footer>
   <script>window.x = 1;</script></body></html>`;

describe("getSource source text", () => {
  it("derives readable text from a discovery row's stored markup", async () => {
    const row = {
      id: 1,
      type: "SCRAPE_DISCOVERY",
      rawText: null,
      rawHtml: page("<h1>Tjedni pregled</h1><article><h2>Koncert u parku</h2><p>14.11.2026. u 20:00</p></article>"),
    };

    const result = (await service(row).getSource(1)) as { rawText?: string | null };

    expect(result.rawText).toContain("Koncert u parku");
    expect(result.rawText).toContain("14.11.2026.");
  });

  it("returns text, never markup — the panel must not be handed a page to render", async () => {
    const row = {
      id: 1,
      rawText: null,
      rawHtml: page(`<p onclick="alert(1)">Predstava</p><script>alert("xss")</script>`),
    };

    const result = (await service(row).getSource(1)) as { rawText?: string | null };

    expect(result.rawText).toContain("Predstava");
    expect(result.rawText).not.toContain("<script");
    expect(result.rawText).not.toContain("onclick");
    expect(result.rawText).not.toContain("alert(");
  });

  it("never sends the stored markup to the client", async () => {
    // Nothing reads it, it is untrusted, and a discovery row carries hundreds
    // of kilobytes of it.
    const result = (await service({ id: 1, rawText: null, rawHtml: page("<p>Nešto</p>") }).getSource(1)) as Record<string, unknown>;

    expect(result).not.toHaveProperty("rawHtml");
  });

  it("leaves a row that already has its own text alone", async () => {
    const row = { id: 1, rawText: "Tekst koji je urednik zalijepio", rawHtml: page("<p>Nešto sasvim drugo</p>") };

    const result = (await service(row).getSource(1)) as { rawText?: string | null };

    expect(result.rawText).toBe("Tekst koji je urednik zalijepio");
  });

  it("caps what it returns and says that it did", async () => {
    const long = Array.from({ length: 4000 }, (_, i) => `<p>Redak ${i} s dovoljno teksta da se nakupi.</p>`).join("");
    const result = (await service({ id: 1, rawText: null, rawHtml: page(long) }).getSource(1)) as { rawText?: string | null };

    expect(result.rawText!.length).toBeLessThan(20_200);
    expect(result.rawText).toContain("tekst skraćen");
  });

  it("gives nothing rather than an empty panel for a row with no markup", async () => {
    const result = (await service({ id: 1, rawText: null, rawHtml: null }).getSource(1)) as { rawText?: string | null };
    expect(result.rawText).toBeNull();
  });

  it("gives nothing for markup that holds no readable text", async () => {
    const result = (await service({ id: 1, rawText: null, rawHtml: "<html><body><script>var a=1;</script></body></html>" }).getSource(1)) as
      { rawText?: string | null };
    expect(result.rawText).toBeNull();
  });

  it("still returns null for a source that does not exist", async () => {
    expect(await service(null).getSource(404)).toBeNull();
  });
});
