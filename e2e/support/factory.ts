/**
 * Preconditions, built through the real API rather than by clicking.
 *
 * A test that is about the admin review screen should not spend forty seconds
 * and six clicks arranging a published event first — and if it did, a bug in
 * the create form would also fail every unrelated spec. So: arrange over HTTP,
 * act in the browser, assert in the browser. The HTTP calls here are our own
 * production endpoints with a real bearer token, not stubs.
 */
import { expect, type APIRequestContext } from "@playwright/test";
import { futureDate, localIso, type FixtureDate } from "./dates";

export type EventRecord = { id: number; slug: string; title: string; startsAt: string };

async function expectOk(response: Awaited<ReturnType<APIRequestContext["post"]>>, what: string) {
  if (!response.ok()) throw new Error(`${what} failed: HTTP ${response.status()} ${await response.text()}`);
  return response;
}

export async function categoryId(api: APIRequestContext, slug = "glazba"): Promise<number> {
  const response = await api.get("/api/public/categories");
  const categories = (await response.json()) as { id: number; slug: string }[];
  const match = categories.find((category) => category.slug === slug);
  if (!match) throw new Error(`Category ${slug} is missing — did prisma:seed run?`);
  return match.id;
}

/** A published, publicly visible event owned by the given organizer. */
export async function createPublishedEvent(
  adminApi: APIRequestContext,
  options: {
    title: string;
    organizerId?: number;
    date?: FixtureDate;
    cityName?: string;
    isFree?: boolean | null;
    priceText?: string;
    categorySlug?: string;
  }
): Promise<EventRecord> {
  const date = options.date ?? futureDate(21);
  const created = await expectOk(
    await adminApi.post("/api/admin/events", {
      data: {
        title: options.title,
        description: "Sintetički događaj za end-to-end test.",
        startsAt: localIso(date, "19:00"),
        endsAt: localIso(date, "21:00"),
        cityName: options.cityName ?? "Osijek",
        categoryId: await categoryId(adminApi, options.categorySlug ?? "glazba"),
        organizerId: options.organizerId,
        venueName: "Gradski park",
        address: "Trg Ante Starčevića 1",
        isFree: options.isFree ?? true,
        priceText: options.priceText ?? "",
        status: "PUBLISHED",
      },
    }),
    "admin event create"
  );
  const event = (await created.json()) as EventRecord;
  expect(event.id, "the API returned an event without an id").toBeTruthy();
  return event;
}

/** An organizer-submitted event sitting in the admin review queue. */
export async function createPendingOrganizerEvent(
  organizerApi: APIRequestContext,
  adminApi: APIRequestContext,
  title: string,
  date = futureDate(25)
): Promise<EventRecord> {
  const created = await expectOk(
    await organizerApi.post("/api/organizer/events", {
      data: {
        title,
        description: "Prijava koju je napravio end-to-end test.",
        startsAt: localIso(date, "18:00"),
        endsAt: localIso(date, "20:00"),
        cityName: "Osijek",
        categoryId: await categoryId(adminApi),
        venueName: "Dvorana",
      },
    }),
    "organizer event create"
  );
  return (await created.json()) as EventRecord;
}
