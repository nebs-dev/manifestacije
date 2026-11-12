import { expect, test, unique } from "../support/fixtures";
import { wellFormedCandidate, type StubCandidate } from "../support/ai-stub";
import { AI_STUB_URL } from "../support/env";
import { futureDate } from "../support/dates";

/**
 * Journey 7 — the editorial inbox.
 *
 * Two regressions, both measured against production before the fix: a
 * monitored source re-queueing events it had already found (3 179 candidate
 * cards for 748 distinct events), and a queue with no filter (928 rows, 290 of
 * 325 discovery rows never opened).
 */

type QueueRow = {
  id: number;
  type: string;
  status: string;
  parsedJson: { candidates?: { title?: string; _status?: string; warnings?: string[] }[] } | null;
};

const listingUrl = (candidates: { sourceText: string }[]) =>
  `${AI_STUB_URL}/fixture/source-page?text=${encodeURIComponent(candidates.map((c) => c.sourceText).join("\n\n---\n\n"))}`;

function programme(titles: string[]): { candidate: StubCandidate; sourceText: string }[] {
  return titles.map((title, index) => {
    const built = wellFormedCandidate({ title, date: futureDate(40 + index), address: "", imageUrl: "" });
    return { candidate: built.candidate, sourceText: built.sourceText };
  });
}

/** Every discovery row this test owns, found by its own unique titles. */
async function myRows(adminApi: { get(path: string): Promise<{ json(): Promise<unknown> }> }, label: string) {
  const queue = (await (await adminApi.get("/api/admin/event-sources?pageSize=100")).json()) as { items: QueueRow[] };
  return queue.items.filter((row) => row.type === "SCRAPE_DISCOVERY" && JSON.stringify(row.parsedJson ?? {}).includes(label));
}

const cardsIn = (rows: QueueRow[]) => rows.flatMap((row) => row.parsedJson?.candidates ?? []);

test("@smoke @critical a second check of a monitored source does not re-queue the events it already found", async ({ adminApi, ai }) => {
  const label = unique("E2E dedup");
  const titles = [1, 2, 3, 4, 5, 6].map((n) => `${label} koncert ${n}`);
  const six = programme(titles);

  await ai.willReturn(six.map((c) => c.candidate));
  const source = (await (
    await adminApi.post("/api/admin/monitored-sources", {
      data: { name: label, url: listingUrl(six), sourceType: "LISTING_PAGE" },
    })
  ).json()) as { id: number };

  await adminApi.post(`/api/admin/monitored-sources/${source.id}/run`, { data: {} });

  const afterFirst = await myRows(adminApi, label);
  expect(cardsIn(afterFirst)).toHaveLength(6);

  // The page gains one event and keeps the other six, which is what a weekly
  // programme page does. Its bytes change, so the whole page is parsed again.
  const seven = programme([...titles, `${label} koncert 7`]);
  await ai.willReturn(seven.map((c) => c.candidate));
  await adminApi.put(`/api/admin/monitored-sources/${source.id}`, { data: { url: listingUrl(seven) } });
  await adminApi.post(`/api/admin/monitored-sources/${source.id}/run`, { data: {} });

  const afterSecond = await myRows(adminApi, label);
  const cards = cardsIn(afterSecond);

  // Seven cards for seven events. Before the per-event identity this was 13:
  // a second row carrying all seven again.
  expect(cards).toHaveLength(7);
  expect(new Set(cards.map((card) => card.title))).toHaveProperty("size", 7);
  // And the second check's own row holds only the new event.
  const newest = afterSecond.sort((a, b) => b.id - a.id).at(0);
  expect(newest, "the second check produced no row at all").toBeTruthy();
  expect(newest!.parsedJson?.candidates).toHaveLength(1);
  expect(newest!.parsedJson?.candidates?.[0]?.title).toContain("koncert 7");
});

test("@critical a check whose page changed but whose programme did not adds no review row", async ({ adminApi, ai }) => {
  const label = unique("E2E bez promjene");
  const three = programme([1, 2, 3].map((n) => `${label} predstava ${n}`));

  await ai.willReturn(three.map((c) => c.candidate));
  const source = (await (
    await adminApi.post("/api/admin/monitored-sources", {
      data: { name: label, url: listingUrl(three), sourceType: "LISTING_PAGE" },
    })
  ).json()) as { id: number };
  await adminApi.post(`/api/admin/monitored-sources/${source.id}/run`, { data: {} });
  expect(await myRows(adminApi, label)).toHaveLength(1);

  // Same three events, different page bytes — a rotated banner, a visitor
  // counter, a reordered sidebar. This was the common case in production.
  await ai.willReturn(three.map((c) => c.candidate));
  await adminApi.put(`/api/admin/monitored-sources/${source.id}`, {
    data: { url: `${listingUrl(three)}&banner=${Date.now()}` },
  });
  await adminApi.post(`/api/admin/monitored-sources/${source.id}/run`, { data: {} });

  expect(await myRows(adminApi, label)).toHaveLength(1);
});

test("@critical separate terms of one event all reach the editor", async ({ adminApi, ai }) => {
  // The failure the deduplication must not cause: a weekly programme lists one
  // play on three nights, and those are three events.
  const label = unique("E2E termini");
  const title = `${label} ista predstava`;
  const terms = [0, 1, 2].map((offset) => wellFormedCandidate({ title, date: futureDate(50 + offset), address: "", imageUrl: "" }));

  await ai.willReturn(terms.map((t) => t.candidate));
  const source = (await (
    await adminApi.post("/api/admin/monitored-sources", {
      data: { name: label, url: listingUrl(terms), sourceType: "LISTING_PAGE" },
    })
  ).json()) as { id: number };
  await adminApi.post(`/api/admin/monitored-sources/${source.id}/run`, { data: {} });

  const cards = cardsIn(await myRows(adminApi, label));
  expect(cards).toHaveLength(3);
  expect(cards.every((card) => card._status !== "created" && card._status !== "ignored")).toBe(true);
});

test("@smoke @critical the inbox opens on the sources that still need an editor", async ({ adminPage: page, adminApi, ai }) => {
  const label = unique("E2E inbox");
  const two = programme([`${label} prvi`, `${label} drugi`]);
  await ai.willReturn(two.map((c) => c.candidate));
  const source = (await (
    await adminApi.post("/api/admin/monitored-sources", {
      data: { name: label, url: listingUrl(two), sourceType: "LISTING_PAGE" },
    })
  ).json()) as { id: number };
  await adminApi.post(`/api/admin/monitored-sources/${source.id}/run`, { data: {} });

  const [row] = await myRows(adminApi, label);
  expect(row, "the check produced no review row").toBeTruthy();

  await page.goto("/admin/sources");
  await expect(page.getByRole("heading", { name: "Izvori", exact: true })).toBeVisible();

  // The queue opens filtered, and says so.
  const summary = page.getByTestId("source-filter-summary");
  await expect(summary).toContainText("čeka obradu");

  const myRow = page.getByRole("row").filter({ hasText: `${label} prvi` });
  await expect(myRow).toBeVisible();

  // Narrowing to monitored sources keeps it; narrowing to e-mail drops it.
  await page.getByRole("button", { name: "Nadzirani izvori" }).click();
  await expect(myRow).toBeVisible();
  await page.getByRole("button", { name: "E-mail / ručno" }).click();
  await expect(myRow).toHaveCount(0);

  // Search finds it again without paging.
  await page.getByRole("button", { name: "Svi tipovi" }).click();
  await page.getByLabel("Traži izvore").fill("127.0.0.1");
  await expect(page.getByRole("row").filter({ hasText: `${label} prvi` })).toBeVisible();
});

test("@critical a source whose candidates are all decided leaves the unprocessed view", async ({ adminPage: page, adminApi, ai }) => {
  const label = unique("E2E obrađeno");
  const one = programme([`${label} jedini`]);
  await ai.willReturn(one.map((c) => c.candidate));
  const source = (await (
    await adminApi.post("/api/admin/monitored-sources", {
      data: { name: label, url: listingUrl(one), sourceType: "LISTING_PAGE" },
    })
  ).json()) as { id: number };
  await adminApi.post(`/api/admin/monitored-sources/${source.id}/run`, { data: {} });

  const [row] = await myRows(adminApi, label);
  expect(row).toBeTruthy();
  await adminApi.post(`/api/admin/event-sources/${row!.id}/ignore-candidate`, { data: { candidateIndex: 0 } });

  await page.goto("/admin/sources");
  const summary = page.getByTestId("source-filter-summary");
  await expect(summary).toContainText("čeka obradu");
  await expect(page.getByRole("row").filter({ hasText: `${label} jedini` })).toHaveCount(0);

  // It is not gone, only out of the way — one click brings it back.
  await page.getByRole("button", { name: "Prikaži i obrađene" }).click();
  await expect(page.getByRole("row").filter({ hasText: `${label} jedini` })).toBeVisible();
});
