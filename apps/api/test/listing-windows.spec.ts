import { gunzipSync } from "node:zlib";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  MAX_WINDOWS,
  WINDOW_BUDGET,
  selectListingWindows,
  statedDates,
} from "../src/ai-parser/listing-windows";

/**
 * Which part of a long listing page the model is given.
 *
 * The two fixtures are the real pages from the audit, captured 2026-11-13, and
 * they fail in opposite directions — one hides its upcoming events past the
 * budget, the other has nothing but an archive out there. A fix that reads
 * "more of the page" helps the first and wastes two model calls per check on
 * the second, so both belong here.
 */

const FIXTURES = join(__dirname, "fixtures", "listing-text");
const fixture = (name: string) => gunzipSync(readFileSync(join(FIXTURES, name))).toString("utf8");

/** The day both pages were captured; the fixtures' dates never move again. */
const CAPTURED = new Date("2026-11-13T12:00:00+01:00");

describe("statedDates", () => {
  it("reads the date formats Croatian listing pages actually use", () => {
    expect(statedDates("Koncert 14.11.2026. u 20h")).toEqual(["2026-11-14"]);
    expect(statedDates("28/09/26")).toEqual(["2026-09-28"]);
    expect(statedDates("2026-12-01")).toEqual(["2026-12-01"]);
    expect(statedDates("otvorenje 5. prosinca 2026.")).toEqual(["2026-12-05"]);
    expect(statedDates("Tjedan znanosti, 13. studenoga 2026.")).toEqual(["2026-11-13"]);
  });

  it("ignores a day with no year rather than guessing one", () => {
    // `sourceDates` guesses, and must: a poster saying "25.8." means a real
    // day. Here a guess is actively harmful — it assumes *next* year once this
    // year's date has passed, which reads a page of last season's programme as
    // a page full of upcoming events and buys model calls to re-read events
    // `dropPastCandidates` then discards.
    expect(statedDates("25.8. Projekcija filma")).toEqual([]);
    expect(statedDates("8.")).toEqual([]);
  });

  it("does not count a day that is not a day, or a stray number pair", () => {
    expect(statedDates("31.02.2026.")).toEqual([]);
    expect(statedDates("2020 2021 2022 2023")).toEqual([]);
    expect(statedDates("Siječanj Veljača Ožujak")).toEqual([]);
  });

  it("counts each distinct day once however often the page repeats it", () => {
    expect(statedDates("14.11.2026. ... 14.11.2026. ... 15.11.2026.")).toEqual(["2026-11-14", "2026-11-15"]);
  });
});

describe("selectListingWindows", () => {
  it("hands over a page that fits whole, in one window, unchanged", () => {
    const text = "Koncert A\n\n14.11.2026. u 20h\n\nKoncert B\n\n15.11.2026.";
    const selection = selectListingWindows({ text, now: CAPTURED });

    expect(selection.reason).toBe("fits");
    expect(selection.windows).toHaveLength(1);
    expect(selection.windows[0].text).toBe(text);
    // The cost of a short page must not change: one window, one model call.
    expect(selection.recovered).toBe(0);
  });

  it("returns nothing for an empty page", () => {
    expect(selectListingWindows({ text: "   \n\n  ", now: CAPTURED }).windows).toHaveLength(0);
  });

  it("never exceeds the budget per window or the cap on windows", () => {
    // 40 000 blocks of a dated event: far more than three windows' worth.
    const text = Array.from({ length: 4000 }, (_, i) => `Događaj ${i}\n\n14.11.2026. u 20h`).join("\n\n");
    const selection = selectListingWindows({ text, now: CAPTURED });

    expect(selection.windows.length).toBeLessThanOrEqual(MAX_WINDOWS);
    for (const window of selection.windows) expect(window.text.length).toBeLessThanOrEqual(WINDOW_BUDGET + 300);
  });

  it("splits a page that has no paragraph breaks at all", () => {
    const text = `${"x".repeat(50_000)} 14.11.2026.`;
    const selection = selectListingWindows({ text, now: CAPTURED });

    expect(selection.windows.length).toBeGreaterThan(0);
    for (const window of selection.windows) expect(window.text.length).toBeLessThanOrEqual(WINDOW_BUDGET + 300);
  });

  it("reads the prefix when nothing on a long page states a date", () => {
    // No opinion to act on, so don't act: this is what the old code did and
    // there is nothing better to do with a page whose dates are unreadable.
    const text = Array.from({ length: 3000 }, (_, i) => `Nedatirani sadržaj ${i}`).join("\n\n");
    const selection = selectListingWindows({ text, now: CAPTURED });

    expect(selection.reason).toBe("no-dates");
    expect(selection.windows).toHaveLength(1);
    expect(selection.windows[0].at).toBe(0);
  });

  it("skips the windows whose dates have all passed", () => {
    // Enough past programme to fill two whole windows before anything
    // upcoming appears, which is the shape of a month calendar mid-month.
    const past = Array.from({ length: 1400 }, (_, i) => `Prošli događaj ${i}\n\n10.03.2026. u 20h`).join("\n\n");
    const future = "Nadolazeći koncert\n\n20.12.2026. u 20h";
    const selection = selectListingWindows({ text: `${past}\n\n${future}`, now: CAPTURED });

    expect(selection.reason).toBe("selected");
    expect(selection.windows.map((w) => w.upcoming).every((n) => n > 0)).toBe(true);
    expect(selection.windows.some((w) => w.text.includes("Nadolazeći koncert"))).toBe(true);
  });

  it("gives a window that does not start at the top the page's own first line", () => {
    const head = "Svi događaji – Osijek 031";
    const past = Array.from({ length: 1400 }, (_, i) => `Prošli ${i}\n\n10.03.2026.`).join("\n\n");
    const selection = selectListingWindows({ text: `${head}\n\n${past}\n\nKoncert\n\n20.12.2026.`, now: CAPTURED });

    const tail = selection.windows.find((w) => w.at > 0);
    expect(tail).toBeTruthy();
    // Without it the model reads a month calendar with no mention of the city
    // anywhere in its window and returns candidates with no city at all.
    expect(tail!.text.startsWith(head)).toBe(true);
  });

  it("keeps the chosen windows in page order", () => {
    const block = (i: number) => `Događaj ${i}\n\n${i % 2 ? "20.12.2026." : "10.03.2026."} u 20h`;
    const text = Array.from({ length: 2000 }, (_, i) => block(i)).join("\n\n");
    const selection = selectListingWindows({ text, now: CAPTURED });

    const offsets = selection.windows.map((w) => w.at);
    expect(offsets).toEqual([...offsets].sort((a, b) => a - b));
  });
});

describe("selectListingWindows on the real audit pages", () => {
  it("osijek031.com: reaches the upcoming events the old prefix could not", () => {
    // The whole defect in one assertion. 69 634 chars of month calendar, all
    // 40 upcoming dates between chars 39 443 and 59 152, and a 24 000 char
    // prefix that therefore held nothing but the first third of a month that
    // had already happened. The source yielded no upcoming events at all.
    const text = fixture("osijek031-svi-dogadaji.txt.gz");
    expect(text.length).toBeGreaterThan(WINDOW_BUDGET);

    const prefixOnly = statedDates(text.slice(0, WINDOW_BUDGET)).filter((d) => d >= "2026-11-13");
    expect(prefixOnly).toHaveLength(0);

    const selection = selectListingWindows({ text, now: CAPTURED });
    expect(selection.reason).toBe("selected");
    expect(selection.windows.length).toBeGreaterThan(1);
    expect(selection.windows.length).toBeLessThanOrEqual(MAX_WINDOWS);
    expect(selection.recovered).toBeGreaterThan(20_000);

    const read = selection.windows.map((w) => w.text).join("\n");
    expect(statedDates(read).filter((d) => d >= "2026-11-13").length).toBeGreaterThan(5);
    // And it does not pay for the window that is only filter chrome and
    // already-past days.
    expect(selection.windows.some((w) => w.at === 0)).toBe(false);
  });

  it("kulturni-centar.hr: spends one model call, because the rest is an archive", () => {
    // The opposite page, and the reason this is a selection rather than "read
    // more of it": 91 796 chars, of which 67 796 are last season's programme.
    // Reading all of it would triple the cost of every check to recover
    // nothing an editor can use.
    const text = fixture("kulturni-centar-sva-dogadjanja.txt.gz");
    expect(text.length).toBeGreaterThan(WINDOW_BUDGET);

    const selection = selectListingWindows({ text, now: CAPTURED });
    expect(selection.windows).toHaveLength(1);
    expect(selection.windows[0].at).toBe(0);
    expect(selection.recovered).toBe(0);
    expect(selection.windows[0].upcoming).toBeGreaterThan(0);
  });
});
