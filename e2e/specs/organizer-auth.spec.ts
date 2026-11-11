import { expect, test } from "../support/fixtures";
import { ORGANIZER_PASSWORD } from "../support/env";
import { signSession } from "../support/jwt";

/**
 * Journey 1 — registration, sign-in and getting around as an organizer.
 *
 * This is the one spec that drives the real login and registration forms.
 * Everywhere else the session is minted from the signing secret, because
 * /api/auth/{login,register} allow ten requests a minute per IP and every test
 * here shares 127.0.0.1 (see support/seed-accounts.ts).
 */

test("@smoke @critical a new organizer registers through the form and lands on their events", async ({ page }) => {
  const stamp = Date.now().toString(36);
  const email = `e2e-register-${stamp}@manifestacije.test`;

  await page.goto("/organizer/register");
  await expect(page.getByRole("heading", { name: /Registracija/ })).toBeVisible();

  // These fields are labelled by placeholder only: the <Label> elements in
  // apps/web carry no htmlFor and the inputs no id, so getByLabel cannot reach
  // them. That gap is written up in the UX audit; until it is closed, the
  // placeholder is the most stable accessible handle the form offers.
  await page.getByPlaceholder("Vaše ime i prezime").fill("E2E Test Osoba");
  await page.getByPlaceholder("Naziv organizatora / udruge").fill(`E2E Novi organizator ${stamp}`);
  await page.getByPlaceholder("Email").fill(email);
  await page.getByPlaceholder(/^Lozinka/).fill(ORGANIZER_PASSWORD);
  await page.getByRole("button", { name: "Registriraj se" }).click();

  await expect(page).toHaveURL(/\/organizer\/events/);
  await expect(page.getByRole("heading", { name: "Događaji", exact: true })).toBeVisible();
});

test("@critical a wrong password is refused with a message, not a blank screen", async ({ page, organizer }) => {
  await page.goto("/organizer/login");
  await page.getByPlaceholder("Email").fill(organizer.email);
  await page.getByPlaceholder(/^Lozinka/).fill("definitely-not-the-password");
  await page.getByRole("button", { name: "Prijava", exact: true }).click();

  // Scoped to the form: Next renders its own empty role="alert" route
  // announcer on every page, so an unscoped getByRole("alert") is ambiguous.
  await expect(page.locator("#organizer-login-form").getByRole("alert")).toContainText(/Pogrešan email ili lozinka/i);
  await expect(page).toHaveURL(/\/organizer\/login/);
});

test("an organizer who never set a password is offered the claim flow, not a wrong-password error", async ({ page, accounts }) => {
  // AUTH-01: an Organizer row with no linked User used to be a dead end —
  // generic "wrong password" on login and nothing at all from forgot-password.
  await page.goto("/organizer/login");
  await page.getByPlaceholder("Email").fill(accounts.unclaimed.email);
  await page.getByPlaceholder(/^Lozinka/).fill("anything-at-all");
  await page.getByRole("button", { name: "Prijava", exact: true }).click();

  const claimLink = page.getByRole("link", { name: "Preuzmi svoj profil" });
  await expect(claimLink).toBeVisible();
  await expect(claimLink).toHaveAttribute("href", `/organizatori/${accounts.unclaimed.slug}/preuzmi`);
});

test("@smoke a signed-in organizer can reach both ways of adding an event", async ({ organizerPage: page }) => {
  await page.goto("/organizer/events");

  await page.getByRole("link", { name: "Dodaj događaj" }).first().click();
  await expect(page).toHaveURL(/\/organizer\/events\/new/);
  await expect(page.getByRole("heading", { name: "Novi događaj" })).toBeVisible();

  await page.goto("/organizer/events");
  await page.getByRole("link", { name: "Pošalji link" }).first().click();
  await expect(page).toHaveURL(/\/organizer\/submit-link/);
  await expect(page.getByRole("heading", { name: "Pošalji link ili tekst" })).toBeVisible();
});

test("a session issued before a password reset is rejected and sent back to login", async ({ page, organizer }) => {
  // A token one authVersion behind is exactly what an old token looks like
  // after a reset; JwtAuthGuard must refuse it rather than serve the account.
  const stale = signSession({
    id: organizer.userId,
    email: organizer.email,
    role: "ORGANIZER",
    organizerId: organizer.organizerId,
    authVersion: organizer.authVersion + 1,
  });
  await page.addInitScript((token) => window.localStorage.setItem("orgToken", token as string), stale);

  await page.goto("/organizer/events");
  await expect(page).toHaveURL(/\/organizer\/login/);
});
