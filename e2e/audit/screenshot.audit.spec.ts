import { mkdirSync } from "node:fs";
import path from "node:path";
import { test } from "../support/fixtures";
import { wellFormedCandidate } from "../support/ai-stub";
import { AI_STUB_URL } from "../support/env";
import { futureDate } from "../support/dates";

/**
 * Before/after screenshots of the editorial screens.
 *
 * Deliberately free of any selector that belongs to one version of the UI: it
 * waits on the page's own heading and then photographs whatever is there, so
 * the same file produces the "before" shot on the old screen and the "after"
 * shot on the new one. `SHOT_TAG` names which run it is.
 */

const TAG = process.env.SHOT_TAG ?? "shot";
const DIR = path.resolve(__dirname, "..", ".artifacts", "shots");

test("editorial screens", async ({ adminPage: page, adminApi, ai }) => {
  mkdirSync(DIR, { recursive: true });
  const label = `Pregled ${Date.now().toString(36)}`;
  const built = [
    wellFormedCandidate({ title: `${label} 1 potpun`, date: futureDate(30) }),
    wellFormedCandidate({ title: `${label} 2 bez grada`, date: futureDate(31), city: "", missingFields: ["city"] }),
    wellFormedCandidate({ title: `${label} 3 koncert`, date: futureDate(32) }),
    wellFormedCandidate({ title: `${label} 4 predstava`, date: futureDate(33) }),
    wellFormedCandidate({ title: `${label} 5 izlozba`, date: futureDate(34) }),
    wellFormedCandidate({ title: `${label} 6 kviz`, date: futureDate(35) }),
  ];
  await ai.willReturn(built.map((b) => b.candidate));

  const source = (await (
    await adminApi.post("/api/admin/monitored-sources", {
      data: {
        name: label,
        url: `${AI_STUB_URL}/fixture/source-page?text=${encodeURIComponent(built.map((b) => b.sourceText).join("\n\n---\n\n"))}`,
        sourceType: "LISTING_PAGE",
      },
    })
  ).json()) as { id: number };
  await adminApi.post(`/api/admin/monitored-sources/${source.id}/run`, { data: {} });

  const queue = (await (await adminApi.get("/api/admin/event-sources?pageSize=100")).json()) as {
    items: { id: number; type: string; parsedJson: unknown }[];
  };
  const row = queue.items.find((item) => item.type === "SCRAPE_DISCOVERY" && JSON.stringify(item.parsedJson ?? {}).includes(label));
  if (!row) throw new Error("the check produced no review row");

  await page.goto("/admin/sources");
  await page.getByRole("heading", { name: "Izvori", exact: true }).waitFor();
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(DIR, `${TAG}-inbox.png`) });

  await page.goto(`/admin/sources/${row.id}`);
  // Whatever the screen is, the candidate titles are on it once it has loaded.
  await page.getByText(`${label} 1 potpun`).first().waitFor({ timeout: 30_000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(DIR, `${TAG}-review.png`) });
  await page.screenshot({ path: path.join(DIR, `${TAG}-review-full.png`), fullPage: true });

  console.log(`[shots] ${TAG} written to ${DIR}`);
});
