import { test, expect } from "../support/fixtures";
import type { Locator } from "@playwright/test";
import { wellFormedCandidate, type StubCandidate } from "../support/ai-stub";
import { AI_STUB_URL } from "../support/env";
import { futureDate } from "../support/dates";
import { Journey, writeAuditReport } from "./journey";

/**
 * The review form labels its inputs with a `<label>` that names no input, so
 * `getByLabel` finds nothing on the screen as it stands. Reaching a field by
 * its label's next sibling is the workaround — and the fact that it is needed
 * is itself one of the findings.
 */
const field = (card: Locator, label: string): Locator =>
  card.locator(`xpath=.//label[normalize-space()=${JSON.stringify(label)}]/following-sibling::*[1]//input|.//label[normalize-space()=${JSON.stringify(label)}]/following-sibling::input`).first();

/**
 * How much work one editor does to clear six discovered candidates.
 *
 * This is the before/after measurement for the editorial inbox, and the *task*
 * is what stays fixed, not the script: the same six candidates of the same six
 * qualities, the same four events created and the same two ignored. The script
 * itself has to follow the screen, so it changes when the screen does; what is
 * compared is the counts it records.
 *
 * Run with `pnpm e2e:audit`. Not a regression test — the assertions here only
 * keep the run honest (six candidates really were processed), and the numbers
 * land in e2e/.artifacts/audit/.
 */

const journeys: Journey[] = [];

test.afterAll(({}, testInfo) => {
  if (journeys.length) console.log(`\n[audit] measurements written to ${writeAuditReport(journeys, `${testInfo.project.name}-inbox-after`)}\n`);
});

type Plan = {
  label: string;
  quality: string;
  action: "create" | "ignore";
  candidate: StubCandidate;
  sourceText: string;
};

/** Six candidates of the quality a real listing page produces. */
function sixCandidates(label: string): Plan[] {
  const complete = wellFormedCandidate({ title: `${label} 1 potpun`, date: futureDate(30) });
  const noCity = wellFormedCandidate({
    title: `${label} 2 bez grada`, date: futureDate(31), city: "",
    missingFields: ["city"], warnings: ["Grad nije naveden u izvoru; potrebno je provjeriti."],
  });
  const noCategory = wellFormedCandidate({
    title: `${label} 3 bez kategorije`, date: futureDate(32), category: "",
    missingFields: ["category"],
  });
  const noDate = wellFormedCandidate({
    title: `${label} 4 bez datuma`, date: futureDate(33),
    startsAt: "", dateText: "", timeText: "", endsAt: null, endTimeText: "",
    missingFields: ["startsAt"], warnings: ["Datum nije potvrđen izvorom; potreban je pregled."],
  });
  const offTopic = wellFormedCandidate({ title: `${label} 5 nije događaj`, date: futureDate(34) });
  const duplicate = wellFormedCandidate({ title: `${label} 6 duplikat`, date: futureDate(35) });

  return [
    { label: "1 potpun", quality: "complete", action: "create", ...complete },
    { label: "2 bez grada", quality: "missing city", action: "create", ...noCity },
    { label: "3 bez kategorije", quality: "missing category", action: "create", ...noCategory },
    { label: "4 bez datuma", quality: "missing date", action: "create", ...noDate },
    { label: "5 nije događaj", quality: "not an event", action: "ignore", ...offTopic },
    { label: "6 duplikat", quality: "duplicate", action: "ignore", ...duplicate },
  ] as Plan[];
}

test("clearing six discovered candidates", async ({ adminPage: page, adminApi, ai }) => {
  const label = `Audit ${Date.now().toString(36)}`;
  const plan = sixCandidates(label);
  const journey = new Journey("Clearing six discovered candidates", page);
  journeys.push(journey);
  await journey.trackScrolling();

  // A monitored-source check is where these candidates come from in
  // production, so the row under test is a real SCRAPE_DISCOVERY row.
  await ai.willReturn(plan.map((item) => item.candidate));
  // The page has to carry the candidates' own wording: the parser only keeps a
  // date it can quote from the source, so a fixture page that does not say the
  // dates produces six candidates with none.
  const url = `${AI_STUB_URL}/fixture/source-page?text=${encodeURIComponent(plan.map((item) => item.sourceText).join("\n\n---\n\n"))}`;
  const source = (await (
    await adminApi.post("/api/admin/monitored-sources", {
      data: { name: label, url, sourceType: "LISTING_PAGE" },
    })
  ).json()) as { id: number };
  await adminApi.post(`/api/admin/monitored-sources/${source.id}/run`, { data: {} });

  const started = Date.now();

  journey.step("Find the row that needs work");
  await page.goto("/admin/sources");
  await expect(page.getByRole("heading", { name: "Izvori", exact: true })).toBeVisible();
  await journey.shot("inbox");
  journey.metrics["Scrolled, inbox"] = `${await journey.scrolled()} px`;
  journey.end();

  journey.step("Open the source");
  await journey.click(page.getByRole("row").filter({ hasText: label }).getByRole("link").first());
  await page.getByTestId("candidate-rail").waitFor({ timeout: 30_000 });
  const railTop = await page.evaluate(() => {
    const rail = document.querySelector("[data-testid='candidate-rail']");
    return rail ? Math.round(rail.getBoundingClientRect().top) : -1;
  });
  journey.metrics["Work starts at"] = `${railTop} px down a ${page.viewportSize()?.height ?? 0} px viewport`;
  await journey.shot("review-landing");
  journey.end();

  let created = 0;
  let ignored = 0;

  // The screen opens on the first undecided candidate and moves to the next
  // one as each is decided, so the loop works whatever is in front of it
  // rather than hunting for a card by title.
  const editor = page.locator("[data-slot='card']").filter({ has: page.getByLabel("Naslov") }).first();

  for (const item of plan) {
    journey.step(`${item.label} (${item.quality}) → ${item.action}`);
    await expect(editor.getByLabel("Naslov")).toHaveValue(new RegExp(item.label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));

    if (item.action === "ignore") {
      await journey.click(page.getByRole("button", { name: "Ignoriraj", exact: true }).first());
      await expect(page.getByText("Kandidat ignoriran")).toBeVisible();
      ignored += 1;
      journey.end();
      continue;
    }

    if (item.quality === "missing city") {
      await journey.fill(editor.getByLabel("Grad"), "Osijek");
    }
    if (item.quality === "missing date") {
      const date = futureDate(33);
      await journey.fill(editor.getByLabel("Datum").first(), date.iso);
      await journey.fill(editor.getByLabel("Početak").first(), "20:00");
    }
    const category = editor.getByRole("checkbox", { name: "Glazba" }).first();
    if ((await category.count()) && !(await category.isChecked())) {
      await journey.click(category, "category has to be ticked by hand");
    }

    await journey.click(page.getByRole("button", { name: "Kreiraj događaj", exact: true }).first());
    await expect(page.getByText("Događaj kreiran").first()).toBeVisible();
    created += 1;
    journey.end();
  }

  journey.metrics["Candidates processed"] = `${created} created, ${ignored} ignored`;
  journey.metrics["Scrolled, whole task"] = `${await journey.scrolled()} px`;
  journey.metrics["Wall clock (indicative only)"] = `${Math.round((Date.now() - started) / 100) / 10} s`;
  await journey.shot("review-after");

  // Keeps the run honest: the numbers above only mean something if the work
  // actually happened.
  expect(created + ignored).toBe(6);
});
