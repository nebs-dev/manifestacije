import { test } from "../support/fixtures";
import { wellFormedCandidate } from "../support/ai-stub";
import { futureDate } from "../support/dates";
import { createPublishedEvent } from "../support/factory";
import { Journey, writeAuditReport } from "./journey";

/**
 * Walks the daily editorial workflow and measures it. No assertions about
 * whether the product is good — just counts, screenshots and observations, so
 * the recommendations that follow are grounded in a real run.
 */

const journeys: Journey[] = [];

test.afterAll(({}, testInfo) => {
  if (journeys.length) console.log(`\n[audit] measurements written to ${writeAuditReport(journeys, testInfo.project.name)}\n`);
});

test("source → parse → review → correct → publish", async ({ adminPage: page, ai }) => {
  const journey = new Journey("Source to published event", page);
  journeys.push(journey);

  const date = futureDate(31);
  const title = `Audit koncert ${Date.now().toString(36)}`;
  // Two candidates, one of them short a field — the ordinary case, not the
  // happy one: a poster usually names a date but not a city.
  const good = wellFormedCandidate({ title, date });
  const thin = wellFormedCandidate({
    title: `${title} (drugi termin)`,
    date: futureDate(38),
    city: "",
    missingFields: ["city"],
    warnings: ["Grad nije naveden u izvoru; potrebno je provjeriti."],
  });
  await ai.willReturn([good.candidate, thin.candidate]);

  journey.step("Open the sources screen");
  await page.goto("/admin/sources");
  await journey.shot("sources-landing");
  journey.end();

  journey.step("Paste the source and parse it");
  const manual = page.locator("#admin-source-screenshot-form");
  await journey.fill(manual.getByLabel(/^Tekst/), `${good.sourceText}\n\n---\n\n${thin.sourceText}`);
  await journey.fill(manual.getByLabel("Predmet"), title);
  await journey.click(manual.getByRole("checkbox", { name: /AI parser/ }), "AI parser is off by default for text");
  await journey.click(manual.getByRole("button", { name: "Kreiraj izvor" }));
  await page.getByRole("link", { name: title }).first().waitFor({ timeout: 60_000 });
  await journey.shot("sources-after-parse");
  journey.find(
    "status",
    "/admin/sources",
    "Parsing is synchronous: the form sits on 'Ne zatvarajte stranicu' until the model answers, with no progress and no way to queue it."
  );
  journey.end();

  journey.step("Open the source");
  await journey.click(page.getByRole("link", { name: title }).first());
  await page.getByRole("heading", { name: "Parsirani kandidati" }).waitFor();
  await journey.shot("source-review-collapsed");
  journey.find(
    "clicks",
    "/admin/sources/[id]",
    "Every candidate arrives collapsed to a one-line summary; its fields and its Kreiraj/Ignoriraj buttons do not exist until it is expanded — one extra click per candidate, before any work."
  );
  const foldOffset = await page.evaluate(() => {
    const heading = [...document.querySelectorAll("h2")].find((h) => h.textContent?.includes("Parsirani kandidati"));
    return heading ? Math.round(heading.getBoundingClientRect().top) : -1;
  });
  journey.find(
    "clicks",
    "/admin/sources/[id]",
    `The work starts ${foldOffset}px down a 900px viewport: the source summary and the full "Dopuni i ponovno parsiraj" panel (a textarea plus a four-image dropzone) sit above "Parsirani kandidati", so every visit begins by scrolling past tools that are rarely used.`
  );
  journey.find(
    "memory",
    "/admin/sources/[id]",
    "The source's own text is behind a collapsed 'Neobrađeni tekst izvora' panel, so checking a parsed date against the source means opening it, reading, and holding the date in mind while scrolling back to the candidate."
  );
  journey.end();

  journey.step("Expand the first candidate");
  // The second candidate's name contains the first one's title, so the plain
  // title is ambiguous; exclude the one marked "(drugi termin)".
  const cardSummary = page
    .getByRole("button", { name: new RegExp(title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")) })
    .filter({ hasNotText: "drugi termin" })
    .first();
  await journey.click(cardSummary);
  const footer = page.getByRole("button", { name: "Kreiraj i objavi" }).first();
  await footer.waitFor();
  // The card that actually holds the expanded candidate is the one carrying
  // the create/ignore footer.
  const card = page.locator("[data-slot='card']").filter({ has: footer }).last();
  await journey.shot("candidate-expanded", card);
  const tall = await journey.viewportsTall("Kreiraj i objavi");
  const geometry = await page.evaluate(() => {
    const button = [...document.querySelectorAll("button")].find((element) => element.textContent?.includes("Kreiraj i objavi"));
    const card = button?.closest("[data-slot='card']") as HTMLElement | undefined;
    const grid = card?.parentElement?.parentElement as HTMLElement | undefined;
    const labels = card ? [...card.querySelectorAll("label, [data-slot='label']")].map((l) => l.textContent?.trim() ?? "") : [];
    return {
      cardWidth: Math.round(card?.getBoundingClientRect().width ?? 0),
      gridWidth: Math.round(grid?.getBoundingClientRect().width ?? 0),
      location: labels.filter((l) => /Grad|Lokacija|Adresa|Precizna/i.test(l)),
    };
  });
  journey.find(
    "clicks",
    "candidate card",
    `Expanding does not widen the card: it stays ${geometry.cardWidth}px inside a ${geometry.gridWidth}px two-column grid, with the neighbouring column left blank. Half the screen is unused while the card is twice as tall as it needs to be.`
  );
  journey.find(
    "retyping",
    "candidate card",
    `One candidate carries ${geometry.location.length} overlapping location fields (${geometry.location.join(", ")}). The editor has to work out which one the public page will use, and keep them consistent by hand.`
  );
  journey.find(
    "clicks",
    "candidate card",
    `An expanded candidate is ${tall} viewports tall at 1440x900, and its Kreiraj / Ignoriraj footer is at the bottom — so every candidate is expand, scroll down the card, act, scroll back up.`
  );
  journey.end();

  journey.step("Correct the candidate (venue and price)");
  const expanded = page.locator("form, [data-slot='card']").filter({ hasText: "URL izvora" }).last();
  const venue = page.getByPlaceholder("npr. Galerija Waldinger").first();
  if (await venue.isVisible().catch(() => false)) await journey.fill(venue, "Gradski park, zapadni ulaz");
  const price = page.getByPlaceholder(/npr\. 10 EUR|npr\. od 25 EUR/).first();
  if (await price.isVisible().catch(() => false)) await journey.fill(price, "Besplatan ulaz");
  await journey.shot("candidate-corrected");
  journey.find(
    "clicks",
    "candidate card",
    "Categories are a 16-checkbox grid inside the card; picking one means scrolling the card and clicking, with no search and no keyboard shortcut."
  );
  journey.end();

  journey.step("Create and publish the first candidate");
  await journey.click(page.getByRole("button", { name: "Kreiraj i objavi" }).first());
  const dupe = page.getByRole("button", { name: /Svejedno kreiraj/ });
  if (await dupe.isVisible().catch(() => false)) {
    await journey.shot("duplicate-warning");
    await journey.click(dupe, "duplicate warning needed a second confirmation");
    journey.find(
      "status",
      "candidate card",
      "The duplicate warning appears after the Kreiraj click, as a second confirmation — the editor has already committed before being told."
    );
  }
  await page.getByText("Događaj kreiran i objavljen").waitFor({ timeout: 30_000 });
  await journey.shot("after-publish");
  journey.find(
    "status",
    "candidate card",
    "'Kreiraj događaj' creates the event as PENDING_REVIEW (admin.service.ts:952), so the editor who just reviewed the candidate has to review the same event a second time in /admin/events/pending. 'Kreiraj i objavi' publishes outright. The two buttons sit side by side and nothing on screen says that the first one doubles the work."
  );
  journey.end();

  journey.step("Handle the second, incomplete candidate");
  await journey.click(page.getByRole("button", { name: /drugi termin/ }).first());
  await journey.shot("candidate-incomplete");
  journey.find(
    "status",
    "candidate card",
    "A missing field shows as a 'Nedostaje: city' badge, but the field it refers to is not highlighted or focused — the editor has to find it."
  );
  journey.end();

  expanded; // referenced so the locator above documents the card it scopes to
});

test("manual event entry by an editor", async ({ adminPage: page }) => {
  const journey = new Journey("Manual event entry (admin)", page);
  journeys.push(journey);
  const date = futureDate(29);

  journey.step("Open the new-event form");
  await page.goto("/admin/events/new");
  await journey.shot("admin-new-event");
  journey.end();

  journey.step("Fill the form");
  // There is no placeholder, no id and no htmlFor on this field, so position
  // inside the form is the only handle it offers.
  await journey.fill(page.locator("#admin-event-create-form input").first(), `Audit ručni unos ${Date.now().toString(36)}`);
  const dateInput = page.locator("input[type='date']").first();
  await journey.fill(dateInput, date.iso);
  await journey.fill(page.locator("input[type='time']").first(), "20:00");
  await journey.fill(page.locator("input[type='time']").nth(1), "22:00");
  await journey.shot("admin-new-event-filled");
  journey.find(
    "a11y",
    "/admin/events/new",
    "Schedule and basic fields are labelled by a <Label> with no htmlFor and inputs with no id, so the label is visible but not programmatically associated — a screen reader reads an unlabelled field, and getByLabel cannot find it. The 'Naziv' field has no placeholder either, so it has no accessible name at all."
  );
  journey.find(
    "combinable",
    "/admin/events/new vs /admin/events/[id]",
    "The create form picks a city from a dropdown plus a free-text 'Novi grad' box; the edit form uses the geocoding autocomplete instead. Two different mental models for the same field."
  );
  journey.end();
});

test("editing an already published event", async ({ adminPage: page, adminApi }) => {
  const journey = new Journey("Editing a published event", page);
  journeys.push(journey);
  const event = await createPublishedEvent(adminApi, { title: `Audit uređivanje ${Date.now().toString(36)}` });

  journey.step("Find the event in the list");
  await page.goto("/admin/events");
  await journey.shot("admin-events-list");
  journey.find(
    "clicks",
    "/admin/events and /admin/sources/[id]",
    "Bulk actions exist on the events table (select rows, then category / status / shift dates / delete) and on the pending queue, which shares that table — but not on parsed candidates, where the volume actually is. A source with eight candidates has to be worked one card at a time."
  );
  journey.end();

  journey.step("Open it");
  await journey.click(page.getByRole("link", { name: new RegExp(event.title) }).first());
  await page.getByRole("heading", { name: event.title }).waitFor();
  await journey.shot("admin-event-edit");
  journey.end();

  journey.step("Change the time and save");
  await journey.fill(page.locator("input[type='time']").first(), "21:15");
  await journey.click(page.getByRole("button", { name: "Spremi", exact: true }));
  await page.getByText("Promjene spremljene").waitFor({ timeout: 30_000 });
  await journey.shot("admin-event-saved");
  journey.find(
    "state-loss",
    "/admin/events/[id]",
    "The form has no unsaved-changes guard: navigating away or following a breadcrumb discards every edit silently."
  );
  journey.end();
});

test("@phone the editorial screens on a phone", async ({ adminPage: page, ai }) => {
  const journey = new Journey("Editorial triage on a phone", page);
  journeys.push(journey);
  const { candidate, sourceText } = wellFormedCandidate({ title: `Audit mobilni ${Date.now().toString(36)}` });
  await ai.willReturn([candidate]);

  journey.step("Open the admin on a phone");
  await page.goto("/admin");
  await journey.shot("phone-admin-dashboard");
  journey.end();

  journey.step("Navigate to the sources screen through the drawer");
  await journey.click(page.getByRole("button", { name: "Otvori izbornik" }));
  await journey.shot("phone-drawer");
  await journey.click(page.getByRole("dialog", { name: "Administracijski izbornik" }).getByRole("link", { name: "Izvori", exact: true }));
  await page.getByRole("heading", { name: "Izvori", exact: true }).waitFor();
  await journey.shot("phone-sources");
  journey.find("mobile", "/admin/sources on a phone", "Both source forms stack above the table, so the list of recent sources is roughly two screens down.");
  journey.end();

  journey.step("Review a source on a phone");
  const manual = page.locator("#admin-source-screenshot-form");
  await journey.fill(manual.getByLabel(/^Tekst/), sourceText);
  await journey.click(manual.getByRole("checkbox", { name: /AI parser/ }));
  await journey.click(manual.getByRole("button", { name: "Kreiraj izvor" }));
  await page.getByRole("link", { name: /Audit mobilni/ }).first().waitFor({ timeout: 60_000 });
  await journey.click(page.getByRole("link", { name: /Audit mobilni/ }).first());
  await page.getByRole("heading", { name: "Parsirani kandidati" }).waitFor();
  await journey.click(page.getByRole("button", { name: /Audit mobilni/ }).first());
  await journey.shot("phone-candidate-expanded");
  journey.find(
    "mobile",
    "candidate card on a phone",
    "An expanded candidate is a long single column; the Kreiraj/Ignoriraj footer is at the very bottom, so acting on it means scrolling the whole card each time."
  );
  journey.end();
});
