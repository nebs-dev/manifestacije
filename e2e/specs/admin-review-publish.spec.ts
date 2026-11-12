import { expect, test, unique } from "../support/fixtures";
import { wellFormedCandidate } from "../support/ai-stub";
import { createPendingOrganizerEvent } from "../support/factory";
import { futureDate } from "../support/dates";
import { confirmDuplicateIfOffered } from "../support/flows";

/**
 * Journey 5 — the daily editorial loop: a source comes in, the AI proposes a
 * candidate, the editor reviews it and publishes, and the event is then live on
 * the public site.
 */

test("@smoke @critical an editor parses a source, reviews the candidate and publishes it", async ({ adminPage: page, ai, adminApi }) => {
  const title = unique("E2E admin izvor");
  const { candidate, sourceText } = wellFormedCandidate({ title });
  await ai.willReturn([candidate]);

  // The manual-entry form is the one admin path that needs no outbound fetch.
  await page.goto("/admin/sources");
  await expect(page.getByRole("heading", { name: "Izvori", exact: true })).toBeVisible();

  // Scoped: /admin/sources renders two source forms, and both carry an
  // identically labelled "AI parser (Claude)" checkbox and submit button.
  const manual = page.locator("#admin-source-screenshot-form");
  await manual.getByLabel(/^Tekst/).fill(sourceText);
  await manual.getByLabel("Predmet").fill(title);
  await manual.getByRole("checkbox", { name: /AI parser/ }).check();
  await manual.getByRole("button", { name: "Kreiraj izvor" }).click();

  // The new source appears in the table; open it.
  const sourceLink = page.getByRole("link", { name: title }).first();
  await expect(sourceLink).toBeVisible({ timeout: 30_000 });
  await sourceLink.click();

  await expect(page.getByRole("heading", { name: "Parsirani kandidati" })).toBeVisible();

  // Every candidate arrives collapsed into a summary button; its fields and its
  // Kreiraj/Ignoriraj actions only exist once it is expanded. That extra click
  // per candidate is friction #1 in the UX audit.
  const summary = page.getByRole("button", { name: new RegExp(title) });
  await expect(summary).toBeVisible();
  await summary.click();

  await page.getByRole("button", { name: "Kreiraj i objavi" }).click();
  await confirmDuplicateIfOffered(page);
  await expect(page.getByText("Događaj kreiran i objavljen")).toBeVisible();

  // The event now exists, published, and nothing is left pending on the source.
  const events = (await (await adminApi.get(`/api/admin/events?search=${encodeURIComponent(title)}`)).json()) as {
    items: { id: number; title: string; status: string; slug: string }[];
  };
  const published = events.items.find((event) => event.title === title);
  expect(published, "the candidate did not become an event").toBeTruthy();
  expect(published?.status).toBe("PUBLISHED");

  // And it is reachable on the public site at its own URL.
  await page.goto(`/eventi/${published!.slug}`);
  await expect(page.getByRole("heading", { name: title, level: 1 })).toBeVisible();
});

test("@critical an editor approves an organizer's submission from the pending queue", async ({ adminPage: page, adminApi, organizerApi, organizer }) => {
  const title = unique("E2E prijava organizatora");
  await createPendingOrganizerEvent(organizerApi, adminApi, title, futureDate(26));

  await page.goto("/admin/events/pending");
  await expect(page.getByRole("heading", { name: "Događaji na čekanju" })).toBeVisible();

  const row = page.getByRole("row").filter({ hasText: title });
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: "Odobri" }).click();

  await expect(page.getByText(`Odobreno: ${title}`)).toBeVisible();

  const events = (await (await adminApi.get(`/api/admin/events?search=${encodeURIComponent(title)}`)).json()) as {
    items: { title: string; status: string; organizerId: number | null }[];
  };
  const approved = events.items.find((event) => event.title === title);
  expect(approved?.status).toBe("PUBLISHED");
  expect(approved?.organizerId, "approval must not detach the submitting organizer").toBe(organizer.organizerId);
});

test("an editor can reject a submission and it leaves the queue", async ({ adminPage: page, adminApi, organizerApi }) => {
  const title = unique("E2E odbijena prijava");
  await createPendingOrganizerEvent(organizerApi, adminApi, title, futureDate(27));

  await page.goto("/admin/events/pending");
  const row = page.getByRole("row").filter({ hasText: title });
  await row.getByRole("button", { name: "Odbij" }).click();
  await expect(page.getByText(`Odbijeno: ${title}`)).toBeVisible();

  const events = (await (await adminApi.get(`/api/admin/events?search=${encodeURIComponent(title)}`)).json()) as {
    items: { title: string; status: string }[];
  };
  expect(events.items.find((event) => event.title === title)?.status).toBe("REJECTED");
});
