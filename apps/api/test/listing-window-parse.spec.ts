import Anthropic from "@anthropic-ai/sdk";
import { AiEventParserService } from "../src/ai-parser/ai-event-parser.service";
import { WINDOW_BUDGET } from "../src/ai-parser/listing-windows";

jest.mock("@anthropic-ai/sdk", () => ({ __esModule: true, default: jest.fn() }));

/**
 * Reading a listing page that does not fit in one model call.
 *
 * The page here is shaped like osijek031.com/svi-dogadaji/, which is where the
 * defect was measured: a month calendar that prints day 1 upward, so mid-month
 * a 24 000 character prefix holds nothing but days that have already happened.
 * It also repeats a long-running exhibition under every single day, which is
 * what makes the cross-window merge necessary rather than theoretical.
 */

const TODAY = new Date("2026-11-13T12:00:00+01:00");
const SOURCE = "https://www.osijek031.com/svi-dogadaji/";

/** Roughly the bulk a real listing carries per entry — the measured page runs
 *  about 2 300 characters per calendar day, almost all of it teaser prose. */
const teaser = (index: number) =>
  `<p>Opis događaja ${index}. ${"Program počinje u dvorani i traje do večeri. ".repeat(6)}</p>`;

/** A day's worth of calendar: the permanent exhibition, then that day's event. */
function day(index: number, iso: string): string {
  const [y, m, d] = iso.split("-");
  const stated = `${Number(d)}.${Number(m)}.${y}.`;
  return [
    `<p>${index}.</p>`,
    `<p>Trajna izložba “Dođoš u Osijeku”<br>20.12.2026. u 19:00</p>`,
    teaser(index),
    `<p>Događaj ${index}<br>${stated} u 20:00</p>`,
    teaser(index),
  ].join("\n");
}

/** A month calendar printed day 1 upward, the first `pastDays` already over. */
function calendarHtml(pastDays: number, upcomingDays: number): string {
  const blocks: string[] = ["<p>Svi događaji – Osijek 031</p>"];
  let index = 1;
  for (let i = 0; i < pastDays; i++, index++) {
    blocks.push(day(index, `2026-03-${String((i % 28) + 1).padStart(2, "0")}`));
  }
  for (let i = 0; i < upcomingDays; i++, index++) {
    blocks.push(day(index, `2026-12-${String((i % 28) + 1).padStart(2, "0")}`));
  }
  return `<html><body>${blocks.join("\n")}</body></html>`;
}

/** Upcoming day-events, i.e. what an editor would get out of this page. */
const upcomingDayEvents = (candidates: { title: string; startsAt: string }[]) =>
  candidates.filter((c) => /^Događaj \d+$/.test(c.title) && c.startsAt >= "2026-11-13");

/** The provider, answering from whatever window it was actually given. */
function providerReadingItsOwnWindow() {
  const create = jest.fn(async (request: { messages: { content: { type: string; text?: string }[] }[] }) => {
    const prompt = request.messages[0].content
      .filter((part) => part.type === "text")
      .map((part) => part.text ?? "")
      .join("\n");

    const candidates: Record<string, unknown>[] = [];
    const seen = new Set<string>();
    const event = /Događaj (\d+)\s*\n\s*(\d{1,2})\.(\d{1,2})\.(20\d{2})\. u (\d{2}:\d{2})/g;
    let m: RegExpExecArray | null;
    while ((m = event.exec(prompt)) !== null) {
      if (seen.has(m[1])) continue;
      seen.add(m[1]);
      const iso = `${m[4]}-${m[3].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
      candidates.push({
        title: `Događaj ${m[1]}`,
        description: "Opis.",
        startsAt: `${iso}T${m[5]}:00`,
        dateText: `${Number(m[2])}.${Number(m[3])}.${m[4]}.`,
        timeText: m[5],
        venueName: "Dvorana",
        city: "Osijek",
        category: "glazba",
        isFree: false,
      });
    }
    if (/Trajna izložba/.test(prompt)) {
      candidates.push({
        title: "Trajna izložba “Dođoš u Osijeku”",
        description: "Izložba.",
        startsAt: "2026-12-20T19:00:00",
        dateText: "20.12.2026.",
        timeText: "19:00",
        venueName: "GISKO",
        city: "Osijek",
        category: "izlozbe",
        isFree: true,
      });
    }
    return { content: [{ type: "text", text: JSON.stringify({ candidates }) }] };
  });
  (Anthropic as unknown as jest.Mock).mockImplementation(() => ({ messages: { create } }));
  return create;
}

describe("parseListingWithLlm", () => {
  const originalEnv = process.env;
  let create: jest.Mock;
  let parser: AiEventParserService;

  beforeEach(() => {
    process.env = { ...originalEnv, ANTHROPIC_API_KEY: "synthetic-credential-never-log" };
    create = providerReadingItsOwnWindow();
    parser = new AiEventParserService();
  });
  afterEach(() => { process.env = originalEnv; jest.restoreAllMocks(); jest.clearAllMocks(); });

  it("finds the upcoming events a single prefix could not reach", async () => {
    const html = calendarHtml(100, 60);
    expect(parser.textForFingerprint(html).length).toBeGreaterThan(WINDOW_BUDGET * 2);

    // The old path, called directly: one request, the first 24 000 characters,
    // and on this page those characters are all March.
    const before = await parser.parseBatchWithLlm({ rawHtml: html, sourceUrl: SOURCE });
    const after = await parser.parseListingWithLlm({ rawHtml: html, sourceUrl: SOURCE, now: TODAY });

    expect(upcomingDayEvents(before.candidates)).toHaveLength(0);
    expect(upcomingDayEvents(after.result.candidates).length).toBeGreaterThan(20);
    expect(after.stats.reason).toBe("selected");
    expect(after.stats.charsRecovered).toBeGreaterThan(0);
    // Every candidate is dated and titled, i.e. the model's answers survived
    // the window split rather than coming back as unusable fragments.
    expect(after.result.candidates.every((c) => c.title && c.startsAt)).toBe(true);
  });

  it("spends one model call per chosen window and no more", async () => {
    const html = calendarHtml(100, 60);
    const { stats } = await parser.parseListingWithLlm({ rawHtml: html, sourceUrl: SOURCE, now: TODAY });

    expect(create).toHaveBeenCalledTimes(stats.windowsParsed);
    expect(stats.windowsParsed).toBeLessThanOrEqual(3);
    expect(stats.windowsParsed).toBeGreaterThan(1);
  });

  it("returns the event repeated under every day of the month exactly once", async () => {
    // The permanent exhibition is in every window, so the provider returns it
    // once per call. Without the merge the editor gets one card per window for
    // one event, which is the duplication the previous release removed.
    const html = calendarHtml(100, 60);
    const { result, stats } = await parser.parseListingWithLlm({ rawHtml: html, sourceUrl: SOURCE, now: TODAY });

    const exhibition = result.candidates.filter((c) => c.title.includes("Trajna izložba"));
    expect(exhibition).toHaveLength(1);
    expect(stats.mergedDuplicates).toBeGreaterThan(0);
  });

  it("keeps separate events separate, however alike they read", async () => {
    const html = calendarHtml(100, 60);
    const { result } = await parser.parseListingWithLlm({ rawHtml: html, sourceUrl: SOURCE, now: TODAY });

    const keys = result.candidates.map((c) => `${c.title}|${c.startsAt}`);
    expect(new Set(keys).size).toBe(keys.length);
    // Two different days of one title are two events, not one.
    const dates = new Set(result.candidates.map((c) => c.startsAt.slice(0, 10)));
    expect(dates.size).toBeGreaterThan(1);
  });

  it("costs exactly one call on a page that fits, as it always did", async () => {
    const html = `<html><body><p>Koncert A<br>14.11.2026. u 20:00</p><p>Događaj 1<br>14.11.2026. u 20:00</p></body></html>`;
    const { stats } = await parser.parseListingWithLlm({ rawHtml: html, sourceUrl: SOURCE, now: TODAY });

    expect(stats.reason).toBe("fits");
    expect(stats.windowsParsed).toBe(1);
    expect(stats.charsRecovered).toBe(0);
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("never tells the model the content was cut when it chose the window", async () => {
    // "[sadržaj skraćen]" is the old blind truncation marker. A chosen window
    // is whole, and saying otherwise invites the model to report a page it was
    // never shown as incomplete.
    const html = calendarHtml(100, 60);
    await parser.parseListingWithLlm({ rawHtml: html, sourceUrl: SOURCE, now: TODAY });

    for (const call of create.mock.calls) {
      const prompt = JSON.stringify(call[0].messages);
      expect(prompt).not.toContain("sadržaj skraćen");
    }
  });

  it("still truncates a single oversized blob handed in as raw text", async () => {
    // The per-window budget only applies to windows the selection built; a
    // caller passing one huge rawText (an editor paste) keeps the old guard.
    await parser.parseBatchWithLlm({ rawText: "x".repeat(40_000), sourceUrl: SOURCE });
    expect(JSON.stringify(create.mock.calls[0][0].messages)).toContain("sadržaj skraćen");
  });
});
