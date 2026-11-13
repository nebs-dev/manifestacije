import { expect, test, unique } from "../support/fixtures";
import { wellFormedCandidate, type StubCandidate } from "../support/ai-stub";
import { AI_STUB_URL, API_URL } from "../support/env";
import { futureDate } from "../support/dates";

/**
 * Journey 9 — working a row of candidates.
 *
 * The measured walkthrough spent 14 clicks and 20 256 px of scrolling to clear
 * six candidates, six of those clicks only opening a candidate so its fields
 * existed, with the first one 1 697 px below the top of the window. What this
 * spec holds to account is the behaviour that replaced it: the first undecided
 * candidate is open on arrival, deciding one moves to the next without going
 * back to a list, several can be ignored at once, and edits are not dropped
 * silently.
 */

type QueueRow = { id: number; type: string; parsedJson: { candidates?: { title?: string; _status?: string }[] } | null };

const listingUrl = (texts: string[]) =>
  `${AI_STUB_URL}/fixture/source-page?text=${encodeURIComponent(texts.join("\n\n---\n\n"))}`;

function programme(label: string, count: number) {
  return Array.from({ length: count }, (_, i) =>
    wellFormedCandidate({ title: `${label} ${i + 1}`, date: futureDate(30 + i), address: "", imageUrl: "" }),
  );
}

async function sourceWith(
  adminApi: { post(path: string, init: { data: unknown }): Promise<{ json(): Promise<unknown> }>; get(path: string): Promise<{ json(): Promise<unknown> }> },
  ai: { willReturn(candidates: StubCandidate[]): Promise<void> },
  label: string,
  built: ReturnType<typeof programme>,
) {
  await ai.willReturn(built.map((b) => b.candidate));
  const source = (await (
    await adminApi.post("/api/admin/monitored-sources", {
      data: { name: label, url: listingUrl(built.map((b) => b.sourceText)), sourceType: "LISTING_PAGE" },
    })
  ).json()) as { id: number };
  await adminApi.post(`/api/admin/monitored-sources/${source.id}/run`, { data: {} });

  const queue = (await (await adminApi.get("/api/admin/event-sources?pageSize=100")).json()) as { items: QueueRow[] };
  const row = queue.items.find((item) => item.type === "SCRAPE_DISCOVERY" && JSON.stringify(item.parsedJson ?? {}).includes(label));
  expect(row, "the check produced no review row").toBeTruthy();
  return row!;
}

const candidatesOf = async (
  adminApi: { get(path: string): Promise<{ json(): Promise<unknown> }> },
  rowId: number,
) => {
  const data = (await (await adminApi.get(`/api/admin/event-sources/${rowId}`)).json()) as {
    parsedJson?: { candidates?: { title?: string; _status?: string }[] };
  };
  return data.parsedJson?.candidates ?? [];
};

test("@smoke @critical the review screen opens on a candidate that is ready to work", async ({ adminPage: page, adminApi, ai }) => {
  const label = unique("E2E radna ploha");
  const row = await sourceWith(adminApi, ai, label, programme(label, 3));

  await page.goto(`/admin/sources/${row.id}`);

  // No disclosure to click: the fields of the first undecided candidate are
  // on the screen, and so is what the source said.
  await expect(page.getByLabel("Naslov")).toHaveValue(`${label} 1`);
  await expect(page.getByTestId("candidate-rail")).toBeVisible();
  await expect(page.getByTestId("source-evidence")).toBeVisible();
  await expect(page.getByRole("button", { name: "Kreiraj događaj", exact: true })).toBeVisible();

  // The work is at the top of the page, not below the source tooling.
  const offset = await page.evaluate(() => {
    const rail = document.querySelector("[data-testid='candidate-rail']");
    return rail ? Math.round(rail.getBoundingClientRect().top) : -1;
  });
  expect(offset).toBeGreaterThan(0);
  expect(offset, "the candidates should start inside the first screen").toBeLessThan(600);
});

test("@smoke @critical a discovery row shows what the page said, beside the AI's reading of it", async ({ adminPage: page, adminApi, ai }) => {
  // The row under test is a real SCRAPE_DISCOVERY row: a monitored-source
  // check stores the fetched page in rawHtml and never fills rawText, so this
  // is the case where the comparison panel used to have nothing to show.
  const label = unique("E2E izvorni tekst");
  const built = programme(label, 2);
  const row = await sourceWith(adminApi, ai, label, built);

  await page.goto(`/admin/sources/${row.id}`);
  const evidence = page.getByTestId("source-evidence");
  await expect(evidence).toBeVisible();

  // The page's own wording is on screen next to the fields, not behind a link.
  const text = evidence.getByTestId("source-evidence-text");
  await expect(text).toBeVisible();
  await expect(text).toContainText(`${label} 1`);
  await expect(text).toContainText("Datum:");
  await expect(evidence).not.toContainText("nema spremljen tekst");

  // It is text, not a page: nothing from the stored markup is rendered.
  const tags = await text.evaluate((node) => node.querySelectorAll("*").length);
  expect(tags).toBe(0);
  await expect(text).not.toContainText("<script");

  // It arrives narrowed to the candidate on screen, without anyone typing —
  // which is the point: the lines about *this* event, not the whole page.
  await expect(text).not.toContainText(`${label} 2`);

  // And the editor can look anywhere else in the page from the same panel.
  await evidence.getByLabel("Traži u tekstu izvora").fill(`${label} 2`);
  await expect(text).toContainText(`${label} 2`);
});

test("@critical deciding a candidate moves to the next one without going back to a list", async ({ adminPage: page, adminApi, ai }) => {
  const label = unique("E2E sljedeci");
  const row = await sourceWith(adminApi, ai, label, programme(label, 3));

  await page.goto(`/admin/sources/${row.id}`);
  await expect(page.getByLabel("Naslov")).toHaveValue(`${label} 1`);

  await page.getByRole("button", { name: "Ignoriraj" }).click();
  await expect(page.getByText("Kandidat ignoriran")).toBeVisible();

  // The second candidate is now the one on screen — no click on a list, no
  // scroll back to the top.
  await expect(page.getByLabel("Naslov")).toHaveValue(`${label} 2`);
});

test("@critical several candidates can be ignored at once, with a confirmation", async ({ adminPage: page, adminApi, ai }) => {
  const label = unique("E2E masovno");
  const row = await sourceWith(adminApi, ai, label, programme(label, 4));

  await page.goto(`/admin/sources/${row.id}`);
  const rail = page.getByTestId("candidate-rail");
  await expect(rail).toBeVisible();

  await rail.getByRole("checkbox", { name: `Odaberi ${label} 2` }).check();
  await rail.getByRole("checkbox", { name: `Odaberi ${label} 3` }).check();
  await expect(rail.getByText("2 odabrano")).toBeVisible();

  // Nothing happens on the first press: a bulk action asks first.
  await rail.getByRole("button", { name: "Ignoriraj odabrano" }).click();
  expect((await candidatesOf(adminApi, row.id)).filter((c) => c._status === "ignored")).toHaveLength(0);

  await rail.getByRole("button", { name: "Da, ignoriraj" }).click();
  await expect(page.getByText("Ignorirano 2 kandidata")).toBeVisible();

  const after = await candidatesOf(adminApi, row.id);
  expect(after.filter((c) => c._status === "ignored").map((c) => c.title).sort()).toEqual([`${label} 2`, `${label} 3`]);
  // And nothing else was touched.
  expect(after.filter((c) => !c._status || c._status === "pending")).toHaveLength(2);
});

test("@critical bulk ignore is refused without an admin token", async ({ request, organizerApi, adminApi, ai }) => {
  const label = unique("E2E ovlasti");
  const row = await sourceWith(adminApi, ai, label, programme(label, 2));
  const body = { candidateIndexes: [0] };

  const anonymous = await request.post(`${API_URL}/api/admin/event-sources/${row.id}/ignore-candidates`, { data: body });
  expect(anonymous.status()).toBe(401);

  // The guard answers an insufficient role with 401 rather than 403 across the
  // whole admin API; this endpoint inherits that, and the point here is that
  // it is refused, not which of the two codes the project settled on.
  const asOrganizer = await organizerApi.post(`/api/admin/event-sources/${row.id}/ignore-candidates`, { data: body });
  expect(asOrganizer.status()).toBe(401);

  // And the row is untouched by either attempt.
  expect((await candidatesOf(adminApi, row.id)).filter((c) => c._status === "ignored")).toHaveLength(0);
});

test("@critical bulk ignore refuses the whole batch if one candidate already has an event", async ({ adminApi, ai }) => {
  const label = unique("E2E batch odbijen");
  const row = await sourceWith(adminApi, ai, label, programme(label, 3));

  const created = await adminApi.post(`/api/admin/event-sources/${row.id}/create-event`, {
    data: { candidateIndex: 0, publish: false },
  });
  expect(created.ok()).toBeTruthy();

  const res = await adminApi.post(`/api/admin/event-sources/${row.id}/ignore-candidates`, {
    data: { candidateIndexes: [0, 1, 2] },
  });
  expect(res.status()).toBe(409);

  // All or nothing: the other two are still waiting, not half-ignored.
  const after = await candidatesOf(adminApi, row.id);
  expect(after.filter((c) => c._status === "ignored")).toHaveLength(0);
  expect(after.filter((c) => c._status === "created")).toHaveLength(1);
});

test("@critical an empty or out-of-range bulk selection is rejected", async ({ adminApi, ai }) => {
  const label = unique("E2E raspon");
  const row = await sourceWith(adminApi, ai, label, programme(label, 2));

  const empty = await adminApi.post(`/api/admin/event-sources/${row.id}/ignore-candidates`, { data: { candidateIndexes: [] } });
  expect(empty.status()).toBe(400);

  const tooHigh = await adminApi.post(`/api/admin/event-sources/${row.id}/ignore-candidates`, { data: { candidateIndexes: [99] } });
  expect(tooHigh.status()).toBe(400);

  expect((await candidatesOf(adminApi, row.id)).filter((c) => c._status === "ignored")).toHaveLength(0);
});

test("@critical leaving a candidate with unsaved edits asks first", async ({ adminPage: page, adminApi, ai }) => {
  const label = unique("E2E nespremljeno");
  const row = await sourceWith(adminApi, ai, label, programme(label, 2));

  await page.goto(`/admin/sources/${row.id}`);
  await expect(page.getByLabel("Naslov")).toHaveValue(`${label} 1`);
  await page.getByLabel("Naslov").fill(`${label} 1 ispravljen`);

  // Declining the prompt keeps the editor where they were, edits intact.
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.getByTestId("candidate-rail").getByRole("button", { name: new RegExp(`${label} 2`) }).click();
  await expect(page.getByLabel("Naslov")).toHaveValue(`${label} 1 ispravljen`);

  // Accepting it moves on.
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByTestId("candidate-rail").getByRole("button", { name: new RegExp(`${label} 2`) }).click();
  await expect(page.getByLabel("Naslov")).toHaveValue(`${label} 2`);
});

test("@critical the inbox can be narrowed to a row status", async ({ adminPage: page, adminApi, ai }) => {
  const label = unique("E2E status filter");
  await sourceWith(adminApi, ai, label, programme(label, 2));

  await page.goto("/admin/sources");
  const row = page.getByRole("row").filter({ hasText: label });
  await expect(row).toBeVisible();

  // A parsed discovery row is PARSED, so asking for NEEDS_REVIEW must drop it
  // — and asking for PARSED must bring it back.
  await page.getByLabel("Status izvora").selectOption("NEEDS_REVIEW");
  await expect(page.getByRole("row").filter({ hasText: label })).toHaveCount(0);

  await page.getByLabel("Status izvora").selectOption("PARSED");
  await expect(page.getByRole("row").filter({ hasText: label })).toBeVisible();
});
