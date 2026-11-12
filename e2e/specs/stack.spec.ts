import { expect, test } from "@playwright/test";
import { API_URL } from "../support/env";

/**
 * The cheapest possible check that the harness itself is wired up: both real
 * servers answer, and the API is talking to the disposable database.
 */
test("@smoke the API, the database and the web app are all up", async ({ page, request }) => {
  const health = await request.get(`${API_URL}/api/health`);
  expect(health.ok()).toBeTruthy();
  expect(await health.json()).toMatchObject({ db: "ok" });

  await page.goto("/");
  await expect(page).toHaveTitle(/Manifestacije/i);
});
