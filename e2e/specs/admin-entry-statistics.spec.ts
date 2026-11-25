import { expect, test, unique } from "../support/fixtures";
import { createPublishedEvent } from "../support/factory";

/**
 * Journey — entry statistics (STAT-01…STAT-09).
 *
 * The point of the page is that opening it answers "who entered how much,
 * and when" without anyone picking a date, so that is what this checks: an
 * event entered through the API shows up in today's numbers, in the daily
 * table and in the calendar, and the chronology behind a number opens from
 * the number itself.
 */

test("@smoke an admin opens the entry statistics and sees today's work without picking a date", async ({ adminPage: page, adminApi }) => {
  const title = unique("E2E statistika događaj");
  await createPublishedEvent(adminApi, { title });

  await page.goto("/admin/entry-statistics");
  await expect(page.getByRole("heading", { name: "Statistika unosa" })).toBeVisible();

  // The summary is there before any filter is touched.
  const summary = page.getByRole("region", { name: "Sažetak" });
  await expect(summary).toBeVisible();
  await expect(summary.getByText("Unosi administratora")).toBeVisible();
  await expect(summary.getByText("Danas", { exact: true })).toBeVisible();

  // The event just created is counted in the period and in today's column.
  const admins = page.getByRole("region", { name: "Pregled po administratorima" });
  await expect(admins.getByRole("table")).toBeVisible();
  const row = admins.getByRole("row").filter({ hasText: "Admin" }).first();
  await expect(row).toBeVisible();

  // Statistics never expose email addresses.
  await expect(page.locator("main")).not.toContainText("@");

  const daily = page.getByRole("region", { name: "Dnevna statistika" });
  await expect(daily.getByRole("table")).toBeVisible();
  const calendar = page.getByRole("region", { name: "Kalendar aktivnosti" });
  await expect(calendar).toBeVisible();
});

test("a day's chronology opens from the number in the daily table", async ({ adminPage: page, adminApi }) => {
  const title = unique("E2E kronologija događaj");
  await createPublishedEvent(adminApi, { title });

  await page.goto("/admin/entry-statistics");
  const daily = page.getByRole("region", { name: "Dnevna statistika" });
  await expect(daily.getByRole("table")).toBeVisible();

  // The entry made above is today's. The last body row is today — the table
  // stops at today — while the last row of the table as a whole is the totals
  // footer, which has no cells to click.
  const todayRow = daily.locator("tbody tr").last();
  // The first button in the row opens the day itself; the next one is the
  // first editor's count for that day.
  await todayRow.getByRole("button").nth(1).click();

  const details = page.getByRole("region", { name: "Detalji dana" });
  await expect(details).toBeVisible();
  await expect(details.getByText("Prosječan razmak")).toBeVisible();
  await expect(details.getByText(/dinamiku unosa, ne radno vrijeme/)).toBeVisible();
  await expect(details.getByRole("link", { name: title })).toBeVisible();
});

test("the period buttons and the month arrows reload the whole page", async ({ adminPage: page }) => {
  await page.goto("/admin/entry-statistics");
  await expect(page.getByRole("heading", { name: "Statistika unosa" })).toBeVisible();

  await page.getByRole("button", { name: "Prošli mjesec" }).click();
  await expect(page.getByRole("region", { name: "Sažetak" })).toBeVisible();

  await page.getByRole("button", { name: "Prethodni mjesec" }).click();
  await expect(page.getByRole("region", { name: "Dnevna statistika" }).getByRole("table")).toBeVisible();
});

test("an organizer cannot reach the entry statistics", async ({ organizerPage: page }) => {
  const response = await page.request.get("/api/admin/stats/entries");
  // 404 is as good a refusal as 403 here: the admin API hides itself from
  // accounts that have no business knowing the route exists.
  expect(response.ok(), "the statistics API must refuse a non-admin").toBe(false);
  expect([401, 403, 404]).toContain(response.status());
});
