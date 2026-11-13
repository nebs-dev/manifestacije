import { expect, test, unique } from "../support/fixtures";
import { wellFormedCandidate } from "../support/ai-stub";
import { AI_STUB_URL } from "../support/env";
import { futureDate } from "../support/dates";

/**
 * Journey 8 — a listing page too long for one model call.
 *
 * Measured on the two pages from the sources audit: osijek031.com/svi-dogadaji/
 * came to 69 634 characters of text, and on the 13th of the month every one of
 * its 40 upcoming dates sat beyond character 39 443 — past the 24 000 the
 * extractor used to read. The page therefore yielded no upcoming events at
 * all. kulturni-centar.hr is 91 796 characters and fails the opposite way: its
 * tail is an archive, so reading more of it would triple the cost of every
 * check for nothing.
 *
 * What this spec holds to account is the journey, not the arithmetic (that is
 * `listing-windows.spec.ts`): a long page reaches the editor, it costs a known
 * and bounded number of model calls, the same event repeated across windows
 * arrives once, and re-checking an unchanged page still costs nothing.
 */

type QueueRow = {
  id: number;
  type: string;
  parsedJson: { candidates?: { title?: string }[] } | null;
};

const calendar = (params: Record<string, string | number>) =>
  `${AI_STUB_URL}/fixture/calendar-page?${new URLSearchParams(
    Object.entries(params).map(([k, v]) => [k, String(v)]),
  )}`;

async function myRows(adminApi: { get(path: string): Promise<{ json(): Promise<unknown> }> }, label: string) {
  const queue = (await (await adminApi.get("/api/admin/event-sources?pageSize=100")).json()) as { items: QueueRow[] };
  return queue.items.filter((row) => row.type === "SCRAPE_DISCOVERY" && JSON.stringify(row.parsedJson ?? {}).includes(label));
}

const cardsIn = (rows: QueueRow[]) => rows.flatMap((row) => row.parsedJson?.candidates ?? []);

type RunResult = {
  outcome?: string;
  reason?: string;
  listing?: {
    windowsParsed: number;
    windowsTotal: number;
    charsRecovered: number;
    reason: string;
    mergedDuplicates: number;
  } | null;
};

/** What the source's own run log says about its most recent check. */
async function lastRun(
  adminApi: { get(path: string): Promise<{ json(): Promise<unknown> }> },
  sourceId: number,
): Promise<RunResult> {
  const runs = (await (await adminApi.get(`/api/admin/monitored-sources/${sourceId}/runs`)).json()) as
    { status: string; result: RunResult | null }[];
  return runs[0]?.result ?? {};
}

test("@critical a listing page past one model call still reaches the editor, once", async ({ adminApi, ai }) => {
  const label = unique("E2E dugi kalendar");
  // 90 days of programme already over, then 40 still to come — the shape that
  // hid every upcoming event behind the old prefix.
  const url = calendar({ past: 90, upcoming: 40 });

  // The long-running exhibition the page repeats under every single day. The
  // stub answers with it for every window it is given, so the only thing
  // standing between the editor and one card per window is the merge.
  const running = wellFormedCandidate({
    title: `${label} trajna izložba`,
    date: futureDate(41),
    timeText: "19:00",
    endTimeText: "",
    endsAt: null,
    address: "",
    imageUrl: "",
  });
  await ai.willReturn([running.candidate]);

  const before = await ai.callCount();
  const source = (await (
    await adminApi.post("/api/admin/monitored-sources", {
      data: { name: label, url, sourceType: "LISTING_PAGE" },
    })
  ).json()) as { id: number };

  await adminApi.post(`/api/admin/monitored-sources/${source.id}/run`, { data: {} });
  const first = await lastRun(adminApi, source.id);

  // The page was read in several windows, and the run log says which.
  expect(first.listing, "the check reported no listing stats").toBeTruthy();
  expect(first.listing!.reason).toBe("selected");
  expect(first.listing!.windowsTotal).toBeGreaterThan(1);
  expect(first.listing!.windowsParsed).toBeGreaterThan(1);
  // Bounded: a longer page must not buy an unbounded number of calls.
  expect(first.listing!.windowsParsed).toBeLessThanOrEqual(3);
  expect(first.listing!.charsRecovered).toBeGreaterThan(0);

  // One model call per window read, and no more.
  const spent = (await ai.callCount()) - before;
  expect(spent).toBe(first.listing!.windowsParsed);

  // And one card for one event, however many windows described it.
  const cards = cardsIn(await myRows(adminApi, label));
  expect(cards).toHaveLength(1);
  expect(cards[0]?.title).toContain(label);
  expect(first.listing!.mergedDuplicates).toBeGreaterThan(0);
});

test("@critical re-checking the same long page costs nothing and adds nothing", async ({ adminApi, ai }) => {
  const label = unique("E2E dugi bez promjene");
  const url = calendar({ past: 90, upcoming: 40, tag: label });
  const running = wellFormedCandidate({
    title: `${label} trajna izložba`,
    date: futureDate(41),
    timeText: "19:00",
    endTimeText: "",
    endsAt: null,
    address: "",
    imageUrl: "",
  });
  await ai.willReturn([running.candidate]);

  const source = (await (
    await adminApi.post("/api/admin/monitored-sources", {
      data: { name: label, url, sourceType: "LISTING_PAGE" },
    })
  ).json()) as { id: number };
  await adminApi.post(`/api/admin/monitored-sources/${source.id}/run`, { data: {} });
  const rowsAfterFirst = await myRows(adminApi, label);
  expect(rowsAfterFirst).toHaveLength(1);

  // Nothing about the page changed, so the fingerprint settles it before any
  // window is chosen — the windowing must not have cost the change gate.
  const callsBefore = await ai.callCount();
  await adminApi.post(`/api/admin/monitored-sources/${source.id}/run`, { data: {} });
  const second = await lastRun(adminApi, source.id);

  expect(second.outcome).toBe("unchanged");
  expect(second.reason).toBe("fingerprint");
  expect(await ai.callCount()).toBe(callsBefore);
  expect(await myRows(adminApi, label)).toHaveLength(1);
});
