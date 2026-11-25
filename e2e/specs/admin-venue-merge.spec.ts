import { expect, test, unique } from "../support/fixtures";
import { createPublishedEvent } from "../support/factory";

/**
 * Journey — venue memory (VEN-06).
 *
 * Every event entered with a slightly different venue name creates another
 * venue row, each remembering its own address. This is the screen that puts
 * them back together: the duplicate is offered, the consequence is spelled
 * out, and only then do the events move.
 */

test("an admin merges a duplicate venue and the events move with it", async ({ adminPage: page, adminApi }) => {
  const venue = unique("E2E Oxygene");
  const duplicate = `Klub ${venue}`;

  // Two events in one city, entered with two spellings of the same place.
  await createPublishedEvent(adminApi, { title: unique("E2E mjesto A") });
  const kept = await adminApi.post("/api/admin/events", {
    data: {
      title: unique("E2E mjesto B"), description: "Sintetički događaj za end-to-end test.",
      startsAt: new Date(Date.now() + 86_400_000 * 20).toISOString(),
      cityName: "Osijek", venueName: venue, address: "Kapucinska 41", status: "PUBLISHED",
      categoryId: (await (await adminApi.get("/api/public/categories")).json() as { id: number; slug: string }[])
        .find(category => category.slug === "glazba")!.id,
    },
  });
  expect(kept.ok(), await kept.text()).toBe(true);
  const merged = await adminApi.post("/api/admin/events", {
    data: {
      title: unique("E2E mjesto C"), description: "Sintetički događaj za end-to-end test.",
      startsAt: new Date(Date.now() + 86_400_000 * 21).toISOString(),
      cityName: "Osijek", venueName: duplicate, status: "PUBLISHED",
      categoryId: (await (await adminApi.get("/api/public/categories")).json() as { id: number; slug: string }[])
        .find(category => category.slug === "glazba")!.id,
    },
  });
  expect(merged.ok(), await merged.text()).toBe(true);

  await page.goto("/admin/mjesta");
  await expect(page.getByRole("heading", { name: "Mjesta održavanja" })).toBeVisible();

  const duplicates = page.getByRole("region", { name: "Mogući duplikati" });
  const mergeButton = duplicates.getByRole("button", { name: new RegExp(`Spoji u .*${venue}`) }).first();
  await expect(mergeButton).toBeVisible();

  // Nothing happens until the consequence has been read and confirmed.
  await mergeButton.click();
  const confirm = page.getByRole("alertdialog", { name: "Potvrda spajanja" });
  await expect(confirm).toContainText("premjestit će se");
  await confirm.getByRole("button", { name: "Spoji", exact: true }).click();

  await expect(page.getByText(/Premješteno događaja/)).toBeVisible();

  // The duplicate is gone from the venue list and the kept venue holds both events.
  const all = page.getByRole("region", { name: "Sva mjesta" });
  await expect(all.getByRole("row", { name: new RegExp(duplicate) })).toHaveCount(0);
  await expect(all.getByRole("row", { name: new RegExp(venue) }).first()).toContainText("2");
});
