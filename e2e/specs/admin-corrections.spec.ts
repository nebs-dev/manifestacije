import { expect, test, unique } from "../support/fixtures";
import { createPublishedEvent } from "../support/factory";
import { futureDate, zagrebDayOf } from "../support/dates";
import { pickLocation } from "../support/flows";

/**
 * Journey 7 — the three things an editor fixes most often on a parsed event:
 * the date, the location and the price. Each has burned the project before
 * (wrong month from the parser, a venue with no address, a paid event showing
 * as free), so each is asserted through to what the public page renders.
 */

/** See organizer-manual-event.spec.ts: /api/geocode is a proxy to an external
 *  geocoder, and this is the only seam a browser test can intercept it at. */
async function stubGeocoder(page: import("@playwright/test").Page) {
  await page.route("**/api/geocode**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        {
          place_id: "e2e-korekcija",
          lat: "45.4870",
          lon: "18.4100",
          display_name: "Trg bana Jelačića 1, Đakovo, Osječko-baranjska, Hrvatska",
          address: {
            road: "Trg bana Jelačića",
            house_number: "1",
            city: "Đakovo",
            county: "Osječko-baranjska",
            state: "Osječko-baranjska",
            regionSlug: "slavonija-i-baranja",
          },
        },
      ]),
    })
  );
}

test("@smoke @critical an editor corrects the date, the venue and the pricing of a published event", async ({ adminPage: page, adminApi }) => {
  const title = unique("E2E korekcija");
  const wrong = futureDate(20);
  const right = futureDate(45);
  const event = await createPublishedEvent(adminApi, { title, date: wrong, isFree: true });
  await stubGeocoder(page);

  await page.goto(`/admin/events/${event.id}`);
  await expect(page.getByRole("heading", { name: title })).toBeVisible();

  // Date and times live in the schedule editor, whose inputs are typed but
  // unlabelled (no htmlFor/id pair) — see the UX audit.
  await page.locator("input[type='date']").first().fill(right.iso);
  await page.locator("input[type='time']").first().fill("20:30");
  await page.locator("input[type='time']").nth(1).fill("22:30");

  await page.getByPlaceholder("npr. Galerija Waldinger").fill("Kazalište Đakovo");
  await pickLocation(page, "Trg bana Jelačića", /Trg bana Jelačića 1/);

  await page.getByLabel("Način naplate").selectOption("PAID");
  await page.getByLabel("Cijena (tekst)").fill("12 EUR");

  await page.getByRole("button", { name: "Spremi", exact: true }).click();
  await expect(page.getByText("Promjene spremljene")).toBeVisible();

  // What the API now holds.
  await expect(async () => {
    const detail = (await (await adminApi.get(`/api/admin/events/${event.id}`)).json()) as {
      startsAt: string;
      endsAt: string | null;
      // The venue is a relation, not a column on Event: `venueName` in the
      // request body resolves to a Venue row, and the detail response returns
      // it as `venue.name`.
      venue: { name: string } | null;
      cityName: string | null;
      isFree: boolean | null;
      priceText: string | null;
      status: string;
    };
    expect(zagrebDayOf(detail.startsAt), "the corrected date did not stick").toBe(right.iso);
    expect(detail.venue?.name).toBe("Kazalište Đakovo");
    expect(detail.cityName).toBe("Đakovo");
    expect(detail.isFree).toBe(false);
    expect(detail.priceText).toBe("12 EUR");
    expect(detail.status, "a correction must not unpublish the event").toBe("PUBLISHED");
  }).toPass({ timeout: 15_000 });

  // And what a visitor sees: a paid event must never still read as free.
  await page.goto(`/eventi/${event.slug}`);
  await expect(page.getByRole("heading", { name: title, level: 1 })).toBeVisible();
  // Scoped to the event's own detail panel. The page also lists related
  // events, and a free one among those puts a "Besplatno" badge elsewhere on
  // the page that has nothing to do with this event's price.
  const details = page.getByRole("complementary").first();
  await expect(details.getByText("12 EUR")).toBeVisible();
  await expect(details.getByText("Besplatno")).toHaveCount(0);
});

test("@critical an all-day event keeps its date when the times are cleared", async ({ adminPage: page, adminApi }) => {
  const title = unique("E2E cijeli dan");
  const date = futureDate(33);
  const event = await createPublishedEvent(adminApi, { title, date });

  await page.goto(`/admin/events/${event.id}`);
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
  await page.getByRole("switch", { name: "Cijeli dan" }).first().click();
  await page.getByRole("button", { name: "Spremi", exact: true }).click();

  await expect(async () => {
    const detail = (await (await adminApi.get(`/api/admin/events/${event.id}`)).json()) as {
      isAllDay: boolean;
      startsAt: string;
    };
    expect(detail.isAllDay).toBe(true);
    // The calendar day must survive the switch to all-day; an off-by-one here
    // moves the event a day in every listing.
    expect(zagrebDayOf(detail.startsAt)).toBe(date.iso);
  }).toPass({ timeout: 15_000 });
});
