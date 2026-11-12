import { expect, test, unique } from "../support/fixtures";
import { createPublishedEvent } from "../support/factory";
import { futureDate } from "../support/dates";

/**
 * Journey 8 — the public side: an event's own page, and finding it through the
 * calendar. These pages are statically generated and revalidated by the API
 * after a write, so they are also where a broken revalidation shows up.
 */

test("@smoke @critical a published event has its own page with the date, place and price", async ({ page, adminApi }) => {
  const title = unique("E2E javni događaj");
  const date = futureDate(18);
  const event = await createPublishedEvent(adminApi, { title, date, isFree: false, priceText: "15 EUR" });

  await page.goto(`/eventi/${event.slug}`);

  await expect(page.getByRole("heading", { name: title, level: 1 })).toBeVisible();
  await expect(page.getByText("Osijek").first()).toBeVisible();
  await expect(page.getByText("15 EUR").first()).toBeVisible();
  // The day of the month is the one assertion that catches a timezone slip.
  await expect(page.getByText(new RegExp(`\\b${date.day}\\.`)).first()).toBeVisible();
});

test("@smoke the calendar opens, moves a month forward and keeps that month in the URL", async ({ page }) => {
  await page.goto("/kalendar");
  await expect(page.getByRole("heading", { name: "Digitalni kalendar događanja" })).toBeVisible();

  await page.getByRole("button", { name: "mjesec", exact: true }).click();
  const heading = page.getByRole("heading", { level: 2 });
  const firstMonth = await heading.innerText();

  await page.getByRole("button", { name: "Sljedeći mjesec" }).first().click();
  await expect(heading).not.toHaveText(firstMonth);
  // The view is shareable: the chosen month and view live in the query string.
  await expect(page).toHaveURL(/pogled=mjesec/);
  await expect(page).toHaveURL(/datum=\d{4}-\d{2}-\d{2}/);
});

test("@critical an event in next month's calendar is reachable from it", async ({ page, adminApi }) => {
  const date = futureDate(40);
  const title = unique("E2E kalendar");
  const event = await createPublishedEvent(adminApi, { title, date });

  // Landing straight on the event's own day is what a shared calendar link does.
  await page.goto(`/kalendar?pogled=mjesec&datum=${date.iso}`);
  const card = page.getByRole("link").filter({ hasText: title }).first();
  await expect(card).toBeVisible();
  await card.click();

  await expect(page).toHaveURL(new RegExp(`/eventi/${event.slug}`));
  await expect(page.getByRole("heading", { name: title, level: 1 })).toBeVisible();
});

test("an unpublished event is not reachable on the public site", async ({ page, adminApi, organizerApi, organizer }) => {
  const title = unique("E2E nije objavljen");
  const created = await organizerApi.post("/api/organizer/events", {
    data: {
      title,
      description: "Čeka pregled.",
      startsAt: `${futureDate(22).iso}T19:00:00`,
      cityName: "Osijek",
      categoryId: (await (await adminApi.get("/api/public/categories")).json() as { id: number; slug: string }[]).find((c) => c.slug === "glazba")!.id,
    },
  });
  const pending = (await created.json()) as { slug: string; status: string };
  expect(pending.status).toBe("PENDING_REVIEW");
  expect(organizer.organizerId).toBeTruthy();

  const response = await page.goto(`/eventi/${pending.slug}`);
  expect(response?.status(), "a pending event must not be served publicly").toBe(404);
});
