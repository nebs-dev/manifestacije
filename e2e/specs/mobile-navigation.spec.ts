import { expect, test, unique } from "../support/fixtures";
import { createPublishedEvent } from "../support/factory";

/**
 * Journey 9 — the phone. Editors do triage on a phone and organizers submit
 * from one, so the two shells have to be usable at 390px: the admin drawer has
 * to open, close and navigate, the organizer screens must not scroll sideways,
 * and tapping a row must still open it.
 *
 * Tagged @mobile, so these run on the Pixel 7 and iPhone 14 projects. They
 * also run in desktop Chromium, where the drawer is hidden and the assertions
 * below are written to hold either way.
 */

test("@mobile the admin drawer opens, navigates and closes", async ({ adminPage: page }) => {
  await page.goto("/admin");

  const openMenu = page.getByRole("button", { name: "Otvori izbornik" });
  if (!(await openMenu.isVisible())) {
    // Desktop: the sidebar is permanent, so there is nothing to open.
    await expect(page.getByRole("navigation", { name: "Administracija" }).first()).toBeVisible();
    return;
  }

  await openMenu.click();
  const drawer = page.getByRole("dialog", { name: "Administracijski izbornik" });
  await expect(drawer).toBeVisible();

  await drawer.getByRole("link", { name: "Izvori", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/sources/);
  await expect(drawer).toBeHidden();
  await expect(page.getByRole("heading", { name: "Izvori", exact: true })).toBeVisible();
});

test("@mobile an organizer reaches the submit form and the page does not scroll sideways", async ({ organizerPage: page }) => {
  await page.goto("/organizer/events");
  await expect(page.getByRole("heading", { name: "Događaji", exact: true })).toBeVisible();

  await page.getByRole("link", { name: "Pošalji link" }).first().click();
  await expect(page.getByRole("heading", { name: "Pošalji link ili tekst" })).toBeVisible();
  await expect(page.getByPlaceholder("Tekst pozivnice, email, opis…")).toBeVisible();

  // A horizontal overflow on a phone is the classic "unusable form" symptom.
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, "the page scrolls horizontally").toBeLessThanOrEqual(1);
});

test("@mobile an editor can open an event from the pending list on a phone", async ({ adminPage: page, adminApi }) => {
  const title = unique("E2E mobilni");
  const event = await createPublishedEvent(adminApi, { title });

  await page.goto("/admin/events");
  const row = page.getByRole("link", { name: new RegExp(title) }).first();
  await expect(row).toBeVisible();
  await row.click();

  await expect(page).toHaveURL(new RegExp(`/admin/events/${event.id}`));
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
});

test("@mobile the public event page fits the viewport", async ({ page, adminApi }) => {
  const title = unique("E2E javni mobilni");
  const event = await createPublishedEvent(adminApi, { title });

  await page.goto(`/eventi/${event.slug}`);
  await expect(page.getByRole("heading", { name: title, level: 1 })).toBeVisible();

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, "the public event page scrolls horizontally").toBeLessThanOrEqual(1);
});
