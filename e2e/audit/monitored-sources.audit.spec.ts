import { expect, test } from "../support/fixtures";
import { wellFormedCandidate, type StubCandidate } from "../support/ai-stub";
import { AI_STUB_URL } from "../support/env";
import { futureDate } from "../support/dates";
import { Journey, writeAuditReport } from "./journey";

/**
 * Measures the half of the editorial workflow the 2026-11-11 UX audit did not
 * cover: a MonitoredSource that discovers events on its own, and what happens
 * to those candidates afterwards.
 *
 * Three things are counted here, all from a real run:
 *   1. how many model calls one check of one source makes,
 *   2. how many clicks it takes to get from "the check found N events" to
 *      "N events are published",
 *   3. what a second check of the same page does to a queue that already
 *      holds the first check's candidates.
 *
 * Exploration, not a regression test: it lives in e2e/audit so `pnpm e2e`
 * and the CI gate never run it.
 */

const journeys: Journey[] = [];

test.afterAll(({}, testInfo) => {
  if (journeys.length) console.log(`\n[audit] measurements written to ${writeAuditReport(journeys, testInfo.project.name)}\n`);
});

type SourceRow = { id: number; name: string };
type QueueRow = { id: number; type: string; status: string; parsedJson: { candidates?: unknown[] } | null };

/** `?text=` carries a whole inline listing — the "kalendar manifestacija" shape. */
function inlineListingUrl(candidates: { sourceText: string }[]): string {
  const text = candidates.map((c) => c.sourceText).join("\n\n---\n\n");
  return `${AI_STUB_URL}/fixture/source-page?text=${encodeURIComponent(text)}`;
}

/**
 * A listing whose links really do point at each candidate's own detail page —
 * the shape that makes the check pay for enrichment. `findMatchingLink` needs
 * two significant words shared between the candidate title and the link's last
 * path segment, so the slugs are derived from the titles.
 */
function listingWithLinksUrl(titles: string[]): string {
  const slugs = titles.map((title) =>
    title
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
  );
  return `${AI_STUB_URL}/fixture/listing-page?slugs=${encodeURIComponent(slugs.join(","))}`;
}

/**
 * Titles with no two-word overlap between them, so the title-to-link matcher
 * pairs each candidate with its own detail page instead of all of them with
 * the first link it finds.
 */
const DISTINCT = [
  "Jesenska svirka Retfala",
  "Zimski sajam Tvrdja",
  "Baranjska berba Bilje",
  "Kazalisna premijera Vinkovci",
  "Slavonski vezovi Djakovo",
  "Gastro vecer Valpovo",
];

function candidates(count: number, label: string, titles?: string[]): { candidate: StubCandidate; sourceText: string }[] {
  return Array.from({ length: count }, (_, i) => {
    const built = wellFormedCandidate({
      title: titles?.[i] ?? `${label} ${i + 1}`,
      date: futureDate(20 + i),
      // The common real shape: the listing names the venue but no street
      // address, and carries no per-event image.
      address: "",
      imageUrl: "",
    });
    return { candidate: built.candidate, sourceText: built.sourceText };
  });
}

test("one check of one monitored source: model calls and candidate fan-out", async ({ adminPage: page, adminApi, ai }) => {
  const label = `Audit nadzor ${Date.now().toString(36)}`;

  // (a) An inline listing: every event's details are on the page itself, so
  //     there is nothing to crawl.
  const inline = candidates(6, `${label} inline`);
  await ai.willReturn(inline.map((c) => c.candidate));
  const inlineSource = (await (
    await adminApi.post("/api/admin/monitored-sources", {
      data: { name: `${label} inline`, url: inlineListingUrl(inline), sourceType: "LISTING_PAGE" },
    })
  ).json()) as SourceRow;

  const before = await ai.callCount();
  const inlineResponse = await adminApi.post(`/api/admin/monitored-sources/${inlineSource.id}/run`, { data: {} });
  const inlineRun = `HTTP ${inlineResponse.status()} ${(await inlineResponse.text()).slice(0, 400) || "(empty body)"}`;
  const inlineCalls = (await ai.callCount()) - before;

  // (b) A thin directory that links out: the check now also pays for a detail
  //     page per candidate it considers incomplete.
  const linked = candidates(6, `${label} linked`, DISTINCT);
  await ai.willReturn(linked.map((c) => c.candidate));
  const linkedSource = (await (
    await adminApi.post("/api/admin/monitored-sources", {
      data: {
        name: `${label} linked`,
        url: listingWithLinksUrl(linked.map((c) => c.candidate.title)),
        sourceType: "LISTING_PAGE",
      },
    })
  ).json()) as SourceRow;

  const beforeLinked = await ai.callCount();
  const linkedResponse = await adminApi.post(`/api/admin/monitored-sources/${linkedSource.id}/run`, { data: {} });
  const linkedRun = `HTTP ${linkedResponse.status()} ${(await linkedResponse.text()).slice(0, 400) || "(empty body)"}`;
  const linkedCalls = (await ai.callCount()) - beforeLinked;

  console.log(`[audit] inline listing (6 events on the page): ${inlineCalls} model call(s), run result ${inlineRun}`);
  console.log(`[audit] listing with 6 sub-links: ${linkedCalls} model call(s), run result ${linkedRun}`);

  // What one call actually carries, from the request the provider received.
  const lastCall = (await (await page.request.get(`${AI_STUB_URL}/__requests`)).json()) as {
    last: { model: string; maxTokens: number; systemChars: number; systemCached: boolean; userTextChars: number } | null;
  };
  console.log(`[audit] per-call payload: ${JSON.stringify(lastCall.last)}`);

  const journey = new Journey("Model calls per source check", page);
  journeys.push(journey);
  journey.find(
    "status",
    "monitored-sources.service.ts",
    `One check of an inline listing costs ${inlineCalls} model call(s); the same listing shaped as a directory of links costs ${linkedCalls}, one per candidate enriched (capped at MAX_ENRICH_FETCHES=20).`
  );
});

test("discovery to published: clicks for a six-candidate listing", async ({ adminPage: page, adminApi, ai }) => {
  const journey = new Journey("Monitored source to published events", page);
  journeys.push(journey);

  const label = `Audit objava ${Date.now().toString(36)}`;
  const found = candidates(6, label);
  await ai.willReturn(found.map((c) => c.candidate));
  const source = (await (
    await adminApi.post("/api/admin/monitored-sources", {
      data: { name: label, url: inlineListingUrl(found), sourceType: "LISTING_PAGE" },
    })
  ).json()) as SourceRow;

  journey.step("Open the monitored-sources screen");
  await page.goto("/admin/monitored-sources");
  await page.getByRole("heading", { name: "Izvori pod nadzorom" }).waitFor();
  await journey.shot("monitored-sources-list");
  journey.end();

  journey.step("Run the check by hand");
  const row = page.getByRole("row").filter({ hasText: label });
  await journey.click(row.getByRole("button", { name: "Provjeri sada" }));
  // The check is synchronous; the row's status column settles when it is done.
  await expect(row).toContainText(/OK|Bez promjena|Greška/, { timeout: 120_000 });
  journey.end();

  journey.step("Find the candidates the check produced");
  // Two routes exist now. The run log is still there, but the inbox opens
  // filtered to what needs an editor, so the new candidates are on the first
  // screen rather than somewhere in 38 pages — one click instead of two, and
  // no need to remember which source produced them.
  await page.goto("/admin/sources");
  await page.getByTestId("source-filter-summary").waitFor({ timeout: 30_000 });
  await journey.shot("inbox-filtered");
  // The row is labelled by the source's host, not by any event on it: a batch
  // of several candidates leads with the site and keeps the first title in a
  // secondary line outside the link. Scanning the queue for an event title
  // therefore finds nothing, which is survivable now only because the filter
  // puts the row on the first screen.
  const inboxRow = page.getByRole("row").filter({ hasText: label });
  await expect(inboxRow).toBeVisible({ timeout: 30_000 });
  journey.find(
    "memory",
    "/admin/sources",
    "A discovery row is labelled by the source's hostname; the first event's title sits in a secondary line that is not part of the link, so the queue cannot be scanned by event name."
  );
  await journey.click(inboxRow.getByRole("link").first());
  await page.getByTestId("candidate-rail").waitFor({ timeout: 30_000 });
  await journey.shot("discovery-review");
  journey.find(
    "memory",
    "/admin/sources/[id] (SCRAPE_DISCOVERY)",
    "A discovery row stores rawHtml and no rawText; the source text shown beside the candidate is derived from that markup on read, so the comparison works on rows that were stored long before the panel existed."
  );
  journey.end();

  // Whether several candidates can be acted on at once.
  const selectAll = await page.getByRole("checkbox", { name: /odaberi sve/i }).count();
  journey.find(
    "clicks",
    "/admin/sources/[id] (SCRAPE_DISCOVERY)",
    `The rail carries ${selectAll} select-all control and a per-candidate checkbox, so a row of junk can be ignored in one confirmed action; creating events stays one at a time.`
  );

  journey.step("Publish all six candidates");
  for (let i = 1; i <= 6; i++) {
    const publish = page.getByRole("button", { name: "Kreiraj i objavi" }).first();
    await publish.scrollIntoViewIfNeeded();
    await journey.click(publish);
    await expect(page.getByText(/Događaj kreiran i objavljen|već/).first()).toBeVisible({ timeout: 60_000 });
    await page.waitForTimeout(250);
  }
  await journey.shot("after-publishing-six");
  journey.end();

  const published = (await (
    await adminApi.get(`/api/admin/events?search=${encodeURIComponent(label)}&pageSize=50`)
  ).json()) as { items: { title: string; status: string }[] };
  console.log(
    `[audit] published ${published.items.filter((e) => e.status === "PUBLISHED").length}/6 in ${journey.totals.clicks} clicks`
  );
});

test("a second check of the same page: how many cards it adds", async ({ adminPage: page, adminApi, ai }) => {
  const journey = new Journey("Re-check of a programme that gained one event", page);
  journeys.push(journey);

  const label = `Audit ponovno ${Date.now().toString(36)}`;
  const first = candidates(5, label);
  await ai.willReturn(first.map((c) => c.candidate));
  const source = (await (
    await adminApi.post("/api/admin/monitored-sources", {
      data: { name: label, url: inlineListingUrl(first), sourceType: "LISTING_PAGE" },
    })
  ).json()) as SourceRow;

  await adminApi.post(`/api/admin/monitored-sources/${source.id}/run`, { data: {} });

  // The page now gains one new event. Everything else on it is unchanged —
  // which is what a weekly programme page does.
  const second = [...first, ...candidates(1, `${label} novi`)];
  await ai.willReturn(second.map((c) => c.candidate));
  await adminApi.put(`/api/admin/monitored-sources/${source.id}`, { data: { url: inlineListingUrl(second) } });
  const beforeCalls = await ai.callCount();
  await adminApi.post(`/api/admin/monitored-sources/${source.id}/run`, { data: {} });
  const secondCheckCalls = (await ai.callCount()) - beforeCalls;

  const queue = (await (await adminApi.get("/api/admin/event-sources?pageSize=100")).json()) as { items: QueueRow[] };
  const mine = queue.items.filter(
    (row) => row.type === "SCRAPE_DISCOVERY" && JSON.stringify(row.parsedJson ?? {}).includes(label)
  );
  const candidateRows = mine.reduce((sum, row) => sum + (row.parsedJson?.candidates?.length ?? 0), 0);

  const newestRow = mine.sort((a, b) => b.id - a.id).at(0);
  const cardsInNewest = newestRow?.parsedJson?.candidates?.length ?? 0;

  console.log(
    `[audit] two checks of a page whose programme gained 1 event: ${mine.length} queue rows, ${candidateRows} candidate cards, ${cardsInNewest} on the second check's own row, ${secondCheckCalls} model call(s)`
  );
  journey.find(
    "clicks",
    "/admin/sources",
    `Two checks of one page that gained a single event produced ${candidateRows} candidate cards for 6 events (${cardsInNewest} on the second check's row). Before the per-event identity this was 11 cards in 2 rows: every unchanged event was extracted and queued again.`
  );
});
