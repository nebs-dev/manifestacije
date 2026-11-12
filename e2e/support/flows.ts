/**
 * Small interactions that several specs have to get past but none of them is
 * about.
 */
import type { Locator, Page } from "@playwright/test";

/**
 * Confirms the duplicate warning if it appears.
 *
 * Duplicate detection does not key on the title alone — two events on the same
 * date, in the same city, at the same venue look alike enough to be flagged
 * even with different names. The suite shares one database, so a spec can trip
 * the warning on rows an earlier spec created; which rows exist depends on what
 * ran before, and that made the admin publish test fail only in the browser
 * that happened to run second. Duplicate detection has its own coverage; here
 * it is noise, so it is acknowledged and dismissed.
 */
export async function confirmDuplicateIfOffered(page: Page, timeout = 4000): Promise<boolean> {
  const confirm = page.getByRole("button", { name: /Svejedno kreiraj|Svejedno spremi/ });
  // Waits rather than polling once: the check is a round trip, so the dialog
  // appears a moment after the click and an immediate isVisible() misses it.
  try {
    await confirm.waitFor({ state: "visible", timeout });
  } catch {
    return false;
  }
  await confirm.click();
  return true;
}

/**
 * Types into the location combobox and picks a suggestion.
 *
 * The input is scrolled into view first, deliberately: the suggestion list is
 * positioned from the input's rectangle and is not rendered at all when the
 * input lies outside the visual viewport. WebKit lays these forms out taller
 * than Chromium, so the same field sits below the fold there and the list never
 * appeared — identical behaviour in both engines once the field is on screen.
 */
export async function pickLocation(page: Page, query: string, option: RegExp): Promise<void> {
  const box: Locator = page.getByRole("combobox", { name: /Pretraži adresu|Pretraži/ }).first();
  await box.scrollIntoViewIfNeeded();
  await box.fill(query);
  // `.last()`: the admin form also offers venues already saved in the
  // database, and it lists those remembered ones first. A venue an earlier
  // spec created can therefore match the same text, so the geocoder's own
  // result — always last — is the one to click.
  await page.getByRole("option", { name: option }).last().click();
}
