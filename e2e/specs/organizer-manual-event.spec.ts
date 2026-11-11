import { expect, test, unique } from "../support/fixtures";
import { futureDate } from "../support/dates";
import { confirmDuplicateIfOffered, pickLocation } from "../support/flows";

/**
 * Journey 2 — an organizer fills the form by hand and the event arrives in the
 * admin queue as PENDING_REVIEW rather than published.
 */

/**
 * Intercepts the geocoder. /api/geocode is a Next route whose only job is to
 * forward to Google Places or, with no key, to OpenStreetMap Nominatim — so
 * this stubs an external provider at the one seam it can be reached from, not
 * one of our own application APIs. Hitting the live service from a test suite
 * would be slow, rate-limited and, for Nominatim, against its usage policy.
 */
async function stubGeocoder(page: import("@playwright/test").Page) {
  await page.route("**/api/geocode**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      // Nominatim's shape, which is what the route returns for either provider.
      body: JSON.stringify([
        {
          place_id: "e2e-1",
          lat: "45.5607",
          lon: "18.6758",
          display_name: "Trg Ante Starčevića 1, Osijek, Osječko-baranjska, Hrvatska",
          address: {
            road: "Trg Ante Starčevića",
            house_number: "1",
            city: "Osijek",
            county: "Osječko-baranjska",
            state: "Osječko-baranjska",
            regionSlug: "slavonija-i-baranja",
          },
        },
      ]),
    });
  });
}

test("@smoke @critical an organizer submits a manual event and it waits for review", async ({ organizerPage: page, organizerApi }) => {
  const title = unique("E2E ručni unos");
  const date = futureDate(28);
  await stubGeocoder(page);

  await page.goto("/organizer/events/new");
  await expect(page.getByRole("heading", { name: "Novi događaj" })).toBeVisible();

  await page.getByPlaceholder("npr. Jazz večer u Galeriji").fill(title);
  await page.locator("#event-form textarea[name='description']").fill("Opis koji je unio end-to-end test.");

  // The schedule editor's date and time inputs have visible labels but no
  // htmlFor/id pair, so they are reached by type within the schedule block.
  const schedule = page.locator("#event-form").locator("input[type='date']").first();
  await schedule.fill(date.iso);
  await page.locator("#event-form input[type='time']").first().fill("19:00");
  await page.locator("#event-form input[type='time']").nth(1).fill("21:00");

  await page.getByPlaceholder("npr. Galerija Waldinger").fill("Galerija Waldinger");

  // The combobox debounces for 400ms and needs three characters before it
  // searches; the option text comes from the stubbed geocoder above.
  await pickLocation(page, "Trg Ante Starčevića", /Trg Ante Starčevića 1/);

  await page.getByRole("checkbox", { name: "Glazba" }).check();

  await page.getByRole("button", { name: "Pošalji na pregled" }).click();
  await confirmDuplicateIfOffered(page);

  await expect(page).toHaveURL(/\/organizer\/events$/);
  const row = page.getByRole("link").filter({ hasText: title });
  await expect(row).toBeVisible();
  await expect(row).toContainText("Na pregledu");

  // And the server agrees — the organizer cannot publish their own event.
  const events = (await (await organizerApi.get("/api/organizer/events")).json()) as { title: string; status: string }[];
  expect(events.find((event) => event.title === title)?.status).toBe("PENDING_REVIEW");
});

test("the form refuses an incomplete schedule instead of saving a broken event", async ({ organizerPage: page }) => {
  const title = unique("E2E bez vremena");
  await stubGeocoder(page);

  await page.goto("/organizer/events/new");
  await page.getByPlaceholder("npr. Jazz večer u Galeriji").fill(title);
  // A date with no start time: the editor must object rather than invent one.
  await page.locator("#event-form input[type='date']").first().fill(futureDate(14).iso);
  await page.getByRole("button", { name: "Pošalji na pregled" }).click();

  await expect(page.getByText(/Neispravan raspored|vrijeme/i).first()).toBeVisible();
  await expect(page).toHaveURL(/\/organizer\/events\/new/);
});
