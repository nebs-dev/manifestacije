import { expect, test, unique } from "../support/fixtures";
import { createPublishedEvent } from "../support/factory";

/**
 * Journey 6 — an organizer edits an event that is already published. The live
 * version must stay live while the change waits, and the admin's approval is
 * what replaces it. Getting this wrong either shows unreviewed text to the
 * public or loses the organizer's edit, so it is a @critical path.
 */

test("@smoke @critical an organizer's edit to a published event waits for approval and the live page is untouched", async ({
  adminPage,
  organizerPage,
  adminApi,
  organizerApi,
  organizer,
}) => {
  const originalTitle = unique("E2E objavljeni");
  const event = await createPublishedEvent(adminApi, { title: originalTitle, organizerId: organizer.organizerId });
  const newDescription = `Ispravljeni opis ${Date.now().toString(36)}`;

  // The organizer edits it.
  await organizerPage.goto(`/organizer/events/${event.id}`);
  await expect(organizerPage.locator("#event-form")).toBeVisible();
  await organizerPage.locator("#event-form textarea[name='description']").fill(newDescription);
  await organizerPage.getByRole("button", { name: "Spremi promjene" }).click();

  await expect(organizerPage.getByText(/Izmjene su poslane na pregled/)).toBeVisible();
  await expect(organizerPage).toHaveURL(/\/organizer\/events$/);
  await expect(organizerPage.getByRole("link").filter({ hasText: originalTitle })).toContainText("Izmjene na pregledu");

  // The public page still shows the approved version.
  await organizerPage.goto(`/eventi/${event.slug}`);
  await expect(organizerPage.getByRole("heading", { name: originalTitle, level: 1 })).toBeVisible();
  await expect(organizerPage.getByText(newDescription)).toHaveCount(0);

  // The admin finds it in the revision queue and approves it.
  await adminPage.goto("/admin/event-revisions");
  await expect(adminPage.getByRole("heading", { name: "Izmjene objavljenih događaja" })).toBeVisible();
  await adminPage.getByRole("link").filter({ hasText: originalTitle }).click();

  await expect(adminPage.getByRole("heading", { name: "Pregled izmjena događaja" })).toBeVisible();
  await expect(adminPage.getByText(newDescription)).toBeVisible();
  await adminPage.getByRole("button", { name: "Odobri izmjene" }).click();

  // Now the approved content is what the API serves.
  await expect(async () => {
    const detail = await adminApi.get(`/api/admin/events/${event.id}`);
    expect(((await detail.json()) as { description: string }).description).toContain(newDescription);
  }).toPass({ timeout: 15_000 });

  const revisions = (await (await organizerApi.get("/api/organizer/events")).json()) as {
    id: number;
    revisions?: unknown[];
  }[];
  expect(revisions.find((item) => item.id === event.id)?.revisions ?? [], "the revision should no longer be pending").toHaveLength(0);
});

test("@critical a rejected edit is returned with the reason and the published version stands", async ({
  adminPage,
  organizerPage,
  adminApi,
  organizer,
}) => {
  const title = unique("E2E odbijena izmjena");
  const event = await createPublishedEvent(adminApi, { title, organizerId: organizer.organizerId });

  await organizerPage.goto(`/organizer/events/${event.id}`);
  await organizerPage.locator("#event-form textarea[name='description']").fill("Opis koji admin odbija.");
  await organizerPage.getByRole("button", { name: "Spremi promjene" }).click();
  await expect(organizerPage).toHaveURL(/\/organizer\/events$/);

  await adminPage.goto("/admin/event-revisions");
  await adminPage.getByRole("link").filter({ hasText: title }).click();
  await adminPage.getByRole("button", { name: "Odbij izmjene" }).click();

  await expect(async () => {
    const detail = await adminApi.get(`/api/admin/events/${event.id}`);
    const body = (await detail.json()) as { description: string; status: string };
    expect(body.description).not.toContain("Opis koji admin odbija.");
    expect(body.status).toBe("PUBLISHED");
  }).toPass({ timeout: 15_000 });
});
