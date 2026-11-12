import { expect, test } from "../support/fixtures";
import { wellFormedCandidate } from "../support/ai-stub";
import { AI_STUB_URL } from "../support/env";

/**
 * Journeys 3 and 4 — an organizer hands in a link or a poster, and the
 * submission survives an Anthropic outage.
 *
 * The AI is the only thing faked. The link the organizer submits is really
 * fetched by the API over HTTP, from a fixture page the stub server serves, so
 * the fetch-then-parse path runs exactly as in production.
 */

test("@smoke @critical an organizer submits a link and the parsed request appears on their list", async ({ organizerPage: page, ai }) => {
  const { candidate, sourceText } = wellFormedCandidate({ title: `E2E link ${Date.now().toString(36)}` });
  await ai.willReturn([candidate]);
  const sourceUrl = `${AI_STUB_URL}/fixture/source-page?text=${encodeURIComponent(sourceText)}`;

  await page.goto("/organizer/submit-link");
  await page.getByPlaceholder("https://…").fill(sourceUrl);
  await page.getByRole("button", { name: "Pošalji na pregled" }).click();

  await expect(page).toHaveURL(/\/organizer\/events$/);
  await expect(page.getByRole("heading", { name: "Poslani zahtjevi" })).toBeVisible();
  const request = page.getByText("127.0.0.1", { exact: false }).first();
  await expect(request).toBeVisible();
  await expect(page.getByText(/1 događaj pronađen/)).toBeVisible();

  expect(await ai.callCount(), "the API should have called the model exactly once").toBe(1);
});

test("@critical an organizer pastes text and the AI reads one event out of it", async ({ organizerPage: page, ai, organizerApi }) => {
  const title = `E2E tekst ${Date.now().toString(36)}`;
  const { candidate, sourceText } = wellFormedCandidate({ title });
  await ai.willReturn([candidate]);

  await page.goto("/organizer/submit-link");
  await page.getByPlaceholder("Tekst pozivnice, email, opis…").fill(sourceText);
  await page.getByRole("button", { name: "Pošalji na pregled" }).click();

  await expect(page).toHaveURL(/\/organizer\/events$/);
  await expect(page.getByText(/1 događaj pronađen/)).toBeVisible();

  // The candidate the admin will see carries the title and the start the model
  // claimed, which the parser accepted because the quoted date is in the text.
  const sources = (await (await organizerApi.get("/api/organizer/sources")).json()) as {
    status: string;
    parsedJson?: { candidates?: { title: string; startsAt: string }[] };
  }[];
  const parsed = sources.find((source) => source.parsedJson?.candidates?.some((c) => c.title === title));
  expect(parsed, "the submitted text produced no source row").toBeTruthy();
  expect(parsed?.parsedJson?.candidates?.[0]?.startsAt).toContain(candidate.startsAt.slice(0, 10));
});

test("@smoke @critical a submission survives an Anthropic outage and is kept for manual review", async ({ organizerPage: page, ai, organizerApi }) => {
  const marker = `E2E AI pao ${Date.now().toString(36)}`;
  await ai.willFail(503);

  await page.goto("/organizer/submit-link");
  await page.getByPlaceholder("Tekst pozivnice, email, opis…").fill(`${marker}\nDatum: nepoznat\nMolimo obradite ručno.`);
  await page.getByRole("button", { name: "Pošalji na pregled" }).click();

  // The organizer must not be told the submission was lost: it is stored and
  // flagged for a human instead.
  await expect(page.getByText(/spremljen i poslan na pregled/i)).toBeVisible();
  await expect(page).toHaveURL(/\/organizer\/events$/);

  const sources = (await (await organizerApi.get("/api/organizer/sources")).json()) as { status: string; rawText?: string }[];
  const stored = sources.find((source) => source.rawText?.includes(marker));
  expect(stored, "an AI failure must not discard the organizer's submission").toBeTruthy();
  expect(stored?.status, "the source should be waiting for a human").toBe("NEEDS_REVIEW");
});

test("a reply that is prose instead of JSON is treated as a failed parse, not a silent success", async ({ organizerPage: page, ai, organizerApi }) => {
  const marker = `E2E proza ${Date.now().toString(36)}`;
  await ai.willReturnProse();

  await page.goto("/organizer/submit-link");
  await page.getByPlaceholder("Tekst pozivnice, email, opis…").fill(`${marker}\nNejasan sadržaj bez datuma.`);
  await page.getByRole("button", { name: "Pošalji na pregled" }).click();

  await expect(page).toHaveURL(/\/organizer\/events$/);
  const sources = (await (await organizerApi.get("/api/organizer/sources")).json()) as { status: string; rawText?: string }[];
  const stored = sources.find((source) => source.rawText?.includes(marker));
  expect(stored?.status).toBe("NEEDS_REVIEW");
});

test("Facebook links are refused without a poster or pasted text", async ({ organizerPage: page, ai }) => {
  await page.goto("/organizer/submit-link");
  await page.getByPlaceholder("https://…").fill("https://www.facebook.com/events/1234567890");

  await expect(page.getByText(/Facebook link se ne može pouzdano pročitati/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Pošalji na pregled" })).toBeDisabled();
  expect(await ai.callCount(), "nothing should reach the model").toBe(0);
});
