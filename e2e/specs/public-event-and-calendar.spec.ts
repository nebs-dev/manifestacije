import { expect, test, unique } from "../support/fixtures";
import { createPendingOrganizerEvent, createPublishedEvent } from "../support/factory";
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

test("the back link picks its destination up from ?returnTo on a cached page", async ({ page, adminApi }) => {
  const title = unique("E2E povratak");
  const event = await createPublishedEvent(adminApi, { title });

  // /eventi/[eventSlug] is statically generated (PERF-02), so the prerendered
  // shell carries the plain "Natrag" link and the client fills in the real
  // destination from the query string once it hydrates.
  const returnTo = "/kalendar?pogled=mjesec&grad=osijek";
  await page.goto(`/eventi/${event.slug}?returnTo=${encodeURIComponent(returnTo)}`);
  await expect(page.getByRole("heading", { name: title, level: 1 })).toBeVisible();

  const back = page.getByRole("link", { name: "Natrag na kalendar" }).first();
  await expect(back).toHaveAttribute("href", returnTo);
  await back.click();
  await expect(page).toHaveURL(/\/kalendar\?/);
  await expect(page.getByRole("heading", { name: "Digitalni kalendar događanja" })).toBeVisible();
});

// Chromium only: Draft Mode's own __prerender_bypass cookie is Secure, and
// WebKit — unlike Chromium — will not accept a Secure cookie over the suite's
// plain-http origin, so the journey cannot run there.
test("an editor previews an unpublished event on its real public page", async ({ page, adminApi, organizerApi }) => {
  const title = unique("E2E pregled skice");
  const pending = await createPendingOrganizerEvent(organizerApi, adminApi, title);

  // The public page 404s for everyone else; see the test above.
  const link = await adminApi.post(`/api/admin/events/${pending.id}/preview-link`);
  expect(link.ok()).toBe(true);
  const { slug, token } = (await link.json()) as { slug: string; token: string };

  // /api/preview validates the token against the API, turns on Draft Mode and
  // redirects. The Draft Mode cookie is what makes the cached page render for
  // this browser alone.
  await page.goto(`/api/preview?slug=${encodeURIComponent(slug)}&token=${encodeURIComponent(token)}`);

  await expect(page).toHaveURL(new RegExp(`/eventi/${encodeURIComponent(slug)}$`));
  await expect(page.getByRole("heading", { name: title, level: 1 })).toBeVisible();
  await expect(page.getByText(/Pregled za uredništvo/)).toBeVisible();
});

test("a preview link with a tampered token opens nothing", async ({ page, adminApi, organizerApi }) => {
  const pending = await createPendingOrganizerEvent(organizerApi, adminApi, unique("E2E krivi token"));
  const link = await adminApi.post(`/api/admin/events/${pending.id}/preview-link`);
  const { slug, token } = (await link.json()) as { slug: string; token: string };

  const response = await page.goto(`/api/preview?slug=${encodeURIComponent(slug)}&token=${token.slice(0, -2)}xx`);

  expect(response?.status(), "an invalid token must not start a preview session").toBe(404);
  // No Draft Mode cookie was set, so the page itself stays unreachable.
  const direct = await page.goto(`/eventi/${encodeURIComponent(slug)}`);
  expect(direct?.status()).toBe(404);
});

test("a preview session for one event does not open another event's draft", async ({ page, adminApi, organizerApi }) => {
  const draftA = await createPendingOrganizerEvent(organizerApi, adminApi, unique("E2E skica A"));
  const draftB = await createPendingOrganizerEvent(organizerApi, adminApi, unique("E2E skica B"));
  const publishedC = await createPublishedEvent(adminApi, { title: unique("E2E objavljen C") });

  const link = await adminApi.post(`/api/admin/events/${draftA.id}/preview-link`);
  const { slug: slugA, token } = (await link.json()) as { slug: string; token: string };

  // A real preview session for A, cookies and all.
  await page.goto(`/api/preview?slug=${encodeURIComponent(slugA)}&token=${encodeURIComponent(token)}`);
  await expect(page.getByText(/Pregled za uredništvo/)).toBeVisible();

  // The Draft Mode cookie is per-browser, not per-event. B's draft must stay
  // shut: the API checks the token against the slug it was issued for on every
  // fetch, so B is only ever asked for as a public event, and it has no public
  // page yet.
  const b = await page.goto(`/eventi/${encodeURIComponent(draftB.slug)}`);
  expect(b?.status(), "another event's draft must not open in A's preview session").toBe(404);
  await expect(page.getByRole("heading", { name: "Stranica nije pronađena" })).toBeVisible();

  // A published third event opens as its ordinary public page. The preview
  // session is bound to the slug it was issued for, so it carries none of A's
  // editorial framing onto C.
  const c = await page.goto(`/eventi/${encodeURIComponent(publishedC.slug)}`);
  expect(c?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("E2E objavljen C");
  await expect(page.getByText(/Pregled za uredništvo/)).toBeHidden();
});
