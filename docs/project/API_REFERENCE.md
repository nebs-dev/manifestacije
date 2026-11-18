# API Reference

Grouped endpoint reference inferred from static route/controller evidence.

Request and response shapes are marked Unknown unless Kiroq can detect them directly.

## Admin

| Method | Path | Source | Access | Purpose | DTO evidence | Related DB models | Review notes | Confidence | Request | Response |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| GET | `/admin/pending-counts` | `apps/api/src/admin/admin.controller.ts` | Auth-sensitive (Inferred) | Unknown from static route evidence. | None | Unknown | None detected | High | Unknown | Unknown |
| POST | `/admin/events/bulk-categories` | `apps/api/src/admin/admin.controller.ts` | Auth-sensitive (Inferred) | Unknown from static route evidence. | None | `Event` | None detected | High | Unknown | Unknown |
| POST | `/admin/events/bulk-status` | `apps/api/src/admin/admin.controller.ts` | Auth-sensitive (Inferred) | Unknown from static route evidence. | None | `Event` | None detected | High | Unknown | Unknown |
| POST | `/admin/events/bulk-shift-dates` | `apps/api/src/admin/admin.controller.ts` | Auth-sensitive (Inferred) | Unknown from static route evidence. | None | `Event` | None detected | High | Unknown | Unknown |
| GET | `/admin/events/pending` | `apps/api/src/admin/admin.controller.ts` | Auth-sensitive (Inferred) | Unknown from static route evidence. | None | `Event` | None detected | High | Unknown | Unknown |
| GET | `/admin/events` | `apps/api/src/admin/admin.controller.ts` | Auth-sensitive (Inferred) | Unknown from static route evidence. | None | `Event` | None detected | High | Unknown | Unknown |
| POST | `/admin/events` | `apps/api/src/admin/admin.controller.ts` | Auth-sensitive (Inferred) | Unknown from static route evidence. | None | `Event` | None detected | High | Unknown | Unknown |
| GET | `/admin/events/:id` | `apps/api/src/admin/admin.controller.ts` | Auth-sensitive (Inferred) | Unknown from static route evidence. | None | `Event` | None detected | High | Unknown | Unknown |
| PUT | `/admin/events/:id` | `apps/api/src/admin/admin.controller.ts` | Auth-sensitive (Inferred) | Unknown from static route evidence. | None | `Event` | None detected | High | Unknown | Unknown |
| POST | `/admin/events/:id/approve` | `apps/api/src/admin/admin.controller.ts` | Auth-sensitive (Inferred) | Unknown from static route evidence. | None | `Event` | None detected | High | Unknown | Unknown |
| POST | `/admin/events/:id/reject` | `apps/api/src/admin/admin.controller.ts` | Auth-sensitive (Inferred) | Unknown from static route evidence. | None | `Event` | None detected | High | Unknown | Unknown |
| POST | `/admin/events/:id/publish` | `apps/api/src/admin/admin.controller.ts` | Auth-sensitive (Inferred) | Unknown from static route evidence. | None | `Event` | None detected | High | Unknown | Unknown |
| POST | `/admin/events/:id/archive` | `apps/api/src/admin/admin.controller.ts` | Auth-sensitive (Inferred) | Unknown from static route evidence. | None | `Event` | None detected | High | Unknown | Unknown |
| POST | `/admin/events/:id/duplicate` | `apps/api/src/admin/admin.controller.ts` | Auth-sensitive (Inferred) | Unknown from static route evidence. | None | `Event` | None detected | High | Unknown | Unknown |
| POST | `/admin/events/:id/split-weekly` | `apps/api/src/admin/admin.controller.ts` | Auth-sensitive (Inferred) | Unknown from static route evidence. | None | `Event` | None detected | High | Unknown | Unknown |
| DELETE | `/admin/events/:id` | `apps/api/src/admin/admin.controller.ts` | Auth-sensitive (Inferred) | Unknown from static route evidence. | None | `Event` | None detected | High | Unknown | Unknown |
| GET | `/admin/organizers` | `apps/api/src/admin/admin.controller.ts` | Auth-sensitive (Inferred) | Unknown from static route evidence. | None | `Organizer` | None detected | High | Unknown | Unknown |
| POST | `/admin/organizers` | `apps/api/src/admin/admin.controller.ts` | Auth-sensitive (Inferred) | Unknown from static route evidence. | None | `Organizer` | None detected | High | Unknown | Unknown |
| PUT | `/admin/organizers/:id` | `apps/api/src/admin/admin.controller.ts` | Auth-sensitive (Inferred) | Unknown from static route evidence. | None | `Organizer` | None detected | High | Unknown | Unknown |
| POST | `/admin/organizers/:id/verify` | `apps/api/src/admin/admin.controller.ts` | Auth-sensitive (Inferred) | Unknown from static route evidence. | None | `Organizer` | None detected | High | Unknown | Unknown |
| POST | `/admin/organizers/:id/trust` | `apps/api/src/admin/admin.controller.ts` | Auth-sensitive (Inferred) | Unknown from static route evidence. | None | `Organizer` | None detected | High | Unknown | Unknown |
| POST | `/admin/organizers/:id/reset-password` | `apps/api/src/admin/admin.controller.ts` | Auth-sensitive (Inferred) | Unknown from static route evidence. | None | `Organizer` | None detected | High | Unknown | Unknown |
| POST | `/admin/organizers/:id/send-claim-invite` | `apps/api/src/admin/admin.controller.ts` | Auth-sensitive (Inferred) | Unknown from static route evidence. | None | `Organizer` | None detected | High | Unknown | Unknown |
| POST | `/admin/organizers/bulk-invite-unclaimed` | `apps/api/src/admin/admin.controller.ts` | Auth-sensitive (Inferred) | Unknown from static route evidence. | None | `Organizer` | None detected | High | Unknown | Unknown |
| DELETE | `/admin/organizers/:id` | `apps/api/src/admin/admin.controller.ts` | Auth-sensitive (Inferred) | Unknown from static route evidence. | None | `Organizer` | None detected | High | Unknown | Unknown |
| GET | `/admin/users` | `apps/api/src/admin/admin.controller.ts` | Auth-sensitive (Inferred) | Unknown from static route evidence. | None | `User` | None detected | High | Unknown | Unknown |
| DELETE | `/admin/users/:id` | `apps/api/src/admin/admin.controller.ts` | Auth-sensitive (Inferred) | Unknown from static route evidence. | None | `User` | None detected | High | Unknown | Unknown |
| GET | `/admin/organizer-claims` | `apps/api/src/admin/admin.controller.ts` | Auth-sensitive (Inferred) | Unknown from static route evidence. | None | `Organizer`<br>`OrganizerClaim` | None detected | High | Unknown | Unknown |
| POST | `/admin/organizer-claims/:id/approve` | `apps/api/src/admin/admin.controller.ts` | Auth-sensitive (Inferred) | Unknown from static route evidence. | None | `Organizer`<br>`OrganizerClaim` | None detected | High | Unknown | Unknown |
| POST | `/admin/organizer-claims/:id/reject` | `apps/api/src/admin/admin.controller.ts` | Auth-sensitive (Inferred) | Unknown from static route evidence. | None | `Organizer`<br>`OrganizerClaim` | None detected | High | Unknown | Unknown |
| POST | `/admin/uploads/event-image` | `apps/api/src/admin/admin.controller.ts` | Auth-sensitive (Inferred) | Unknown from static route evidence. | None | `Event` | None detected | High | Unknown | Unknown |
| POST | `/admin/uploads/partner-logo` | `apps/api/src/admin/admin.controller.ts` | Auth-sensitive (Inferred) | Unknown from static route evidence. | None | `Partner` | None detected | High | Unknown | Unknown |
| GET | `/admin/event-sources` | `apps/api/src/admin/admin.controller.ts` | Auth-sensitive (Inferred) | Unknown from static route evidence. | None | `Event`<br>`EventSource` | None detected | High | Unknown | Unknown |
| POST | `/admin/event-sources/manual-email` | `apps/api/src/admin/admin.controller.ts` | Auth-sensitive (Inferred) | Unknown from static route evidence. | None | `Event`<br>`EventSource` | None detected | High | Unknown | Unknown |
| POST | `/admin/event-sources/parse-url` | `apps/api/src/admin/admin.controller.ts` | Auth-sensitive (Inferred) | Unknown from static route evidence. | None | `Event`<br>`EventSource` | None detected | High | Unknown | Unknown |
| GET | `/admin/event-sources/:id` | `apps/api/src/admin/admin.controller.ts` | Auth-sensitive (Inferred) | Unknown from static route evidence. | None | `Event`<br>`EventSource` | None detected | High | Unknown | Unknown |
| PUT | `/admin/event-sources/:id` | `apps/api/src/admin/admin.controller.ts` | Auth-sensitive (Inferred) | Unknown from static route evidence. | None | `Event`<br>`EventSource` | None detected | High | Unknown | Unknown |
| POST | `/admin/event-sources/:id/reparse` | `apps/api/src/admin/admin.controller.ts` | Auth-sensitive (Inferred) | Unknown from static route evidence. | None | `Event`<br>`EventSource` | None detected | High | Unknown | Unknown |
| POST | `/admin/event-sources/:id/create-event` | `apps/api/src/admin/admin.controller.ts` | Auth-sensitive (Inferred) | Unknown from static route evidence. | None | `Event`<br>`EventSource` | None detected | High | Unknown | Unknown |
| POST | `/admin/event-sources/:id/ignore-candidate` | `apps/api/src/admin/admin.controller.ts` | Auth-sensitive (Inferred) | Unknown from static route evidence. | None | `Event`<br>`EventSource` | None detected | High | Unknown | Unknown |
| DELETE | `/admin/event-sources/:id` | `apps/api/src/admin/admin.controller.ts` | Auth-sensitive (Inferred) | Unknown from static route evidence. | None | `Event`<br>`EventSource` | None detected | High | Unknown | Unknown |
| GET | `/admin/duplicates` | `apps/api/src/admin/admin.controller.ts` | Auth-sensitive (Inferred) | Unknown from static route evidence. | None | Unknown | None detected | High | Unknown | Unknown |
| POST | `/admin/duplicates/:id/merge` | `apps/api/src/admin/admin.controller.ts` | Auth-sensitive (Inferred) | Unknown from static route evidence. | None | Unknown | None detected | High | Unknown | Unknown |
| POST | `/admin/duplicates/:id/dismiss` | `apps/api/src/admin/admin.controller.ts` | Auth-sensitive (Inferred) | Unknown from static route evidence. | None | Unknown | None detected | High | Unknown | Unknown |
| GET | `/admin/regions` | `apps/api/src/admin/admin.controller.ts` | Auth-sensitive (Inferred) | Unknown from static route evidence. | None | `Region` | None detected | High | Unknown | Unknown |
| POST | `/admin/regions` | `apps/api/src/admin/admin.controller.ts` | Auth-sensitive (Inferred) | Unknown from static route evidence. | None | `Region` | None detected | High | Unknown | Unknown |
| DELETE | `/admin/regions/:id` | `apps/api/src/admin/admin.controller.ts` | Auth-sensitive (Inferred) | Unknown from static route evidence. | None | `Region` | None detected | High | Unknown | Unknown |
| POST | `/admin/counties` | `apps/api/src/admin/admin.controller.ts` | Auth-sensitive (Inferred) | Unknown from static route evidence. | None | Unknown | None detected | High | Unknown | Unknown |
| DELETE | `/admin/counties/:id` | `apps/api/src/admin/admin.controller.ts` | Auth-sensitive (Inferred) | Unknown from static route evidence. | None | Unknown | None detected | High | Unknown | Unknown |
| POST | `/admin/cities` | `apps/api/src/admin/admin.controller.ts` | Auth-sensitive (Inferred) | Unknown from static route evidence. | None | Unknown | None detected | High | Unknown | Unknown |
| PUT | `/admin/cities/:id` | `apps/api/src/admin/admin.controller.ts` | Auth-sensitive (Inferred) | Unknown from static route evidence. | None | Unknown | None detected | High | Unknown | Unknown |
| DELETE | `/admin/cities/:id` | `apps/api/src/admin/admin.controller.ts` | Auth-sensitive (Inferred) | Unknown from static route evidence. | None | Unknown | None detected | High | Unknown | Unknown |
| GET | `/admin/venues/search` | `apps/api/src/admin/admin.controller.ts` | Auth-sensitive (Inferred) | Unknown from static route evidence. | None | `Venue` | None detected | High | Unknown | Unknown |
| GET | `/admin/categories` | `apps/api/src/admin/admin.controller.ts` | Auth-sensitive (Inferred) | Unknown from static route evidence. | None | Unknown | None detected | High | Unknown | Unknown |
| POST | `/admin/categories` | `apps/api/src/admin/admin.controller.ts` | Auth-sensitive (Inferred) | Unknown from static route evidence. | None | Unknown | None detected | High | Unknown | Unknown |
| PUT | `/admin/categories/:id` | `apps/api/src/admin/admin.controller.ts` | Auth-sensitive (Inferred) | Unknown from static route evidence. | None | Unknown | None detected | High | Unknown | Unknown |
| DELETE | `/admin/categories/:id` | `apps/api/src/admin/admin.controller.ts` | Auth-sensitive (Inferred) | Unknown from static route evidence. | None | Unknown | None detected | High | Unknown | Unknown |
| GET | `/admin/partners` | `apps/api/src/admin/admin.controller.ts` | Auth-sensitive (Inferred) | Unknown from static route evidence. | None | `Partner` | None detected | High | Unknown | Unknown |
| POST | `/admin/partners` | `apps/api/src/admin/admin.controller.ts` | Auth-sensitive (Inferred) | Unknown from static route evidence. | None | `Partner` | None detected | High | Unknown | Unknown |
| PUT | `/admin/partners/:id` | `apps/api/src/admin/admin.controller.ts` | Auth-sensitive (Inferred) | Unknown from static route evidence. | None | `Partner` | None detected | High | Unknown | Unknown |
| DELETE | `/admin/partners/:id` | `apps/api/src/admin/admin.controller.ts` | Auth-sensitive (Inferred) | Unknown from static route evidence. | None | `Partner` | None detected | High | Unknown | Unknown |
| PAGE | `/admin/categories` | `apps/web/app/admin/categories/page.tsx` | Auth-sensitive (Inferred) | Unknown from static route evidence. | None | Unknown | None detected | High | Unknown | Unknown |
| PAGE | `/admin/duplicates` | `apps/web/app/admin/duplicates/page.tsx` | Auth-sensitive (Inferred) | Unknown from static route evidence. | None | Unknown | None detected | High | Unknown | Unknown |
| PAGE | `/admin/events/:id` | `apps/web/app/admin/events/[id]/page.tsx` | Auth-sensitive (Inferred) | Unknown from static route evidence. | None | `Event` | None detected | High | Unknown | Unknown |
| PAGE | `/admin/events/new` | `apps/web/app/admin/events/new/page.tsx` | Auth-sensitive (Inferred) | Unknown from static route evidence. | None | `Event` | None detected | High | Unknown | Unknown |
| PAGE | `/admin/events` | `apps/web/app/admin/events/page.tsx` | Auth-sensitive (Inferred) | Unknown from static route evidence. | None | `Event` | None detected | High | Unknown | Unknown |
| PAGE | `/admin/events/pending` | `apps/web/app/admin/events/pending/page.tsx` | Auth-sensitive (Inferred) | Unknown from static route evidence. | None | `Event` | None detected | High | Unknown | Unknown |
| PAGE | `/admin/login` | `apps/web/app/admin/login/page.tsx` | Auth-sensitive (Inferred) | Unknown from static route evidence. | None | Unknown | None detected | High | Unknown | Unknown |
| PAGE | `/admin/monitored-sources/:id` | `apps/web/app/admin/monitored-sources/[id]/page.tsx` | Auth-sensitive (Inferred) | Unknown from static route evidence. | None | `MonitoredSource` | None detected | High | Unknown | Unknown |
| PAGE | `/admin/monitored-sources` | `apps/web/app/admin/monitored-sources/page.tsx` | Auth-sensitive (Inferred) | Unknown from static route evidence. | None | `MonitoredSource` | None detected | High | Unknown | Unknown |
| PAGE | `/admin/organizer-claims` | `apps/web/app/admin/organizer-claims/page.tsx` | Auth-sensitive (Inferred) | Unknown from static route evidence. | None | `Organizer`<br>`OrganizerClaim` | None detected | High | Unknown | Unknown |
| PAGE | `/admin/organizers` | `apps/web/app/admin/organizers/page.tsx` | Auth-sensitive (Inferred) | Unknown from static route evidence. | None | `Organizer` | None detected | High | Unknown | Unknown |
| PAGE | `/admin` | `apps/web/app/admin/page.tsx` | Auth-sensitive (Inferred) | Unknown from static route evidence. | None | Unknown | None detected | High | Unknown | Unknown |
| PAGE | `/admin/partners` | `apps/web/app/admin/partners/page.tsx` | Auth-sensitive (Inferred) | Unknown from static route evidence. | None | `Partner` | None detected | High | Unknown | Unknown |
| PAGE | `/admin/regions` | `apps/web/app/admin/regions/page.tsx` | Auth-sensitive (Inferred) | Unknown from static route evidence. | None | `Region` | None detected | High | Unknown | Unknown |
| PAGE | `/admin/sources/:id` | `apps/web/app/admin/sources/[id]/page.tsx` | Auth-sensitive (Inferred) | Unknown from static route evidence. | None | Unknown | None detected | High | Unknown | Unknown |
| PAGE | `/admin/sources` | `apps/web/app/admin/sources/page.tsx` | Auth-sensitive (Inferred) | Unknown from static route evidence. | None | Unknown | None detected | High | Unknown | Unknown |
| PAGE | `/admin/users` | `apps/web/app/admin/users/page.tsx` | Auth-sensitive (Inferred) | Unknown from static route evidence. | None | `User` | None detected | High | Unknown | Unknown |

## Auth

| Method | Path | Source | Access | Purpose | DTO evidence | Related DB models | Review notes | Confidence | Request | Response |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| POST | `/auth/register` | `apps/api/src/auth/auth.controller.ts` | Auth-sensitive (Inferred) | Authentication or session flow (inferred). | None | Unknown | High: Auth/session/token source files detected | High | Unknown | Unknown |
| POST | `/auth/login` | `apps/api/src/auth/auth.controller.ts` | Auth-sensitive (Inferred) | Authentication or session flow (inferred). | None | Unknown | High: Auth/session/token source files detected | High | Unknown | Unknown |
| GET | `/auth/me` | `apps/api/src/auth/auth.controller.ts` | Auth-sensitive (Inferred) | Authentication or session flow (inferred). | None | Unknown | High: Auth/session/token source files detected | High | Unknown | Unknown |
| POST | `/auth/forgot-password` | `apps/api/src/auth/auth.controller.ts` | Auth-sensitive (Inferred) | Authentication or session flow (inferred). | None | Unknown | High: Auth/session/token source files detected | High | Unknown | Unknown |
| POST | `/auth/reset-password` | `apps/api/src/auth/auth.controller.ts` | Auth-sensitive (Inferred) | Authentication or session flow (inferred). | None | Unknown | High: Auth/session/token source files detected | High | Unknown | Unknown |

## Monitored Sources

| Method | Path | Source | Access | Purpose | DTO evidence | Related DB models | Review notes | Confidence | Request | Response |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| GET | `/admin/monitored-sources` | `apps/api/src/monitored-sources/monitored-sources.controller.ts` | Auth-sensitive (Inferred) | Unknown from static route evidence. | None | `MonitoredSource` | None detected | High | Unknown | Unknown |
| GET | `/admin/monitored-sources/:id` | `apps/api/src/monitored-sources/monitored-sources.controller.ts` | Auth-sensitive (Inferred) | Unknown from static route evidence. | None | `MonitoredSource` | None detected | High | Unknown | Unknown |
| GET | `/admin/monitored-sources/:id/runs` | `apps/api/src/monitored-sources/monitored-sources.controller.ts` | Auth-sensitive (Inferred) | Unknown from static route evidence. | None | `MonitoredSource` | None detected | High | Unknown | Unknown |
| POST | `/admin/monitored-sources` | `apps/api/src/monitored-sources/monitored-sources.controller.ts` | Auth-sensitive (Inferred) | Unknown from static route evidence. | None | `MonitoredSource` | None detected | High | Unknown | Unknown |
| PUT | `/admin/monitored-sources/:id` | `apps/api/src/monitored-sources/monitored-sources.controller.ts` | Auth-sensitive (Inferred) | Unknown from static route evidence. | None | `MonitoredSource` | None detected | High | Unknown | Unknown |
| DELETE | `/admin/monitored-sources/:id` | `apps/api/src/monitored-sources/monitored-sources.controller.ts` | Auth-sensitive (Inferred) | Unknown from static route evidence. | None | `MonitoredSource` | None detected | High | Unknown | Unknown |
| POST | `/admin/monitored-sources/:id/run` | `apps/api/src/monitored-sources/monitored-sources.controller.ts` | Auth-sensitive (Inferred) | Unknown from static route evidence. | None | `MonitoredSource` | None detected | High | Unknown | Unknown |

## Organizer Claims

| Method | Path | Source | Access | Purpose | DTO evidence | Related DB models | Review notes | Confidence | Request | Response |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| POST | `/organizer-claims/request` | `apps/api/src/organizer-claims/organizer-claim.controller.ts` | Unknown | Unknown from static route evidence. | None | `Organizer`<br>`OrganizerClaim` | None detected | High | Unknown | Unknown |
| POST | `/organizer-claims/request-by-email` | `apps/api/src/organizer-claims/organizer-claim.controller.ts` | Unknown | Unknown from static route evidence. | None | `Organizer`<br>`OrganizerClaim` | None detected | High | Unknown | Unknown |
| POST | `/organizer-claims/verify` | `apps/api/src/organizer-claims/organizer-claim.controller.ts` | Unknown | Unknown from static route evidence. | None | `Organizer`<br>`OrganizerClaim` | None detected | High | Unknown | Unknown |
| POST | `/organizer-claims/complete` | `apps/api/src/organizer-claims/organizer-claim.controller.ts` | Unknown | Unknown from static route evidence. | None | `Organizer`<br>`OrganizerClaim` | None detected | High | Unknown | Unknown |

## Organizers

| Method | Path | Source | Access | Purpose | DTO evidence | Related DB models | Review notes | Confidence | Request | Response |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| GET | `/organizer/profile` | `apps/api/src/organizers/organizer.controller.ts` | Unknown | Unknown from static route evidence. | None | `Organizer` | None detected | High | Unknown | Unknown |
| PUT | `/organizer/profile` | `apps/api/src/organizers/organizer.controller.ts` | Unknown | Unknown from static route evidence. | None | `Organizer` | None detected | High | Unknown | Unknown |
| GET | `/organizer/events` | `apps/api/src/organizers/organizer.controller.ts` | Unknown | Unknown from static route evidence. | None | `Organizer`<br>`Event` | None detected | High | Unknown | Unknown |
| GET | `/organizer/sources` | `apps/api/src/organizers/organizer.controller.ts` | Unknown | Unknown from static route evidence. | None | `Organizer` | None detected | High | Unknown | Unknown |
| POST | `/organizer/events` | `apps/api/src/organizers/organizer.controller.ts` | Unknown | Unknown from static route evidence. | None | `Organizer`<br>`Event` | None detected | High | Unknown | Unknown |
| PUT | `/organizer/events/:id` | `apps/api/src/organizers/organizer.controller.ts` | Unknown | Unknown from static route evidence. | None | `Organizer`<br>`Event` | None detected | High | Unknown | Unknown |
| DELETE | `/organizer/events/:id` | `apps/api/src/organizers/organizer.controller.ts` | Unknown | Unknown from static route evidence. | None | `Organizer`<br>`Event` | None detected | High | Unknown | Unknown |
| POST | `/organizer/events/submit-url` | `apps/api/src/organizers/organizer.controller.ts` | Unknown | Unknown from static route evidence. | None | `Organizer`<br>`Event` | None detected | High | Unknown | Unknown |
| POST | `/organizer/uploads/event-image` | `apps/api/src/organizers/organizer.controller.ts` | Unknown | Unknown from static route evidence. | None | `Organizer`<br>`Event` | None detected | High | Unknown | Unknown |

## Public Feed

| Method | Path | Source | Access | Purpose | DTO evidence | Related DB models | Review notes | Confidence | Request | Response |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| GET | `/public/events` | `apps/api/src/public-feed/public-feed.controller.ts` | Public (Inferred) | Unknown from static route evidence. | None | `Event` | Medium: Public or tokenized routes detected | High | Unknown | Unknown |
| GET | `/public/events/:slug` | `apps/api/src/public-feed/public-feed.controller.ts` | Public (Inferred) | Unknown from static route evidence. | None | `Event` | Medium: Public or tokenized routes detected | High | Unknown | Unknown |
| GET | `/public/organizers/:slug` | `apps/api/src/public-feed/public-feed.controller.ts` | Public (Inferred) | Unknown from static route evidence. | None | `Organizer` | Medium: Public or tokenized routes detected | High | Unknown | Unknown |
| GET | `/public/regions` | `apps/api/src/public-feed/public-feed.controller.ts` | Public (Inferred) | Unknown from static route evidence. | None | `Region` | Medium: Public or tokenized routes detected | High | Unknown | Unknown |
| GET | `/public/cities` | `apps/api/src/public-feed/public-feed.controller.ts` | Public (Inferred) | Unknown from static route evidence. | None | Unknown | Medium: Public or tokenized routes detected | High | Unknown | Unknown |
| GET | `/public/regions/:slug/events` | `apps/api/src/public-feed/public-feed.controller.ts` | Public (Inferred) | Unknown from static route evidence. | None | `Region`<br>`Event` | Medium: Public or tokenized routes detected | High | Unknown | Unknown |
| GET | `/public/cities/:slug/events` | `apps/api/src/public-feed/public-feed.controller.ts` | Public (Inferred) | Unknown from static route evidence. | None | `Event` | Medium: Public or tokenized routes detected | High | Unknown | Unknown |
| GET | `/public/categories` | `apps/api/src/public-feed/public-feed.controller.ts` | Public (Inferred) | Unknown from static route evidence. | None | Unknown | Medium: Public or tokenized routes detected | High | Unknown | Unknown |
| GET | `/public/partners` | `apps/api/src/public-feed/public-feed.controller.ts` | Public (Inferred) | Unknown from static route evidence. | None | `Partner` | Medium: Public or tokenized routes detected | High | Unknown | Unknown |
| GET | `/public/categories/:slug/events` | `apps/api/src/public-feed/public-feed.controller.ts` | Public (Inferred) | Unknown from static route evidence. | None | `Event` | Medium: Public or tokenized routes detected | High | Unknown | Unknown |
| GET | `/public/map/events` | `apps/api/src/public-feed/public-feed.controller.ts` | Public (Inferred) | Unknown from static route evidence. | None | `Event` | Medium: Public or tokenized routes detected | High | Unknown | Unknown |
| GET | `/public/seo/sitemap-data` | `apps/api/src/public-feed/public-feed.controller.ts` | Public (Inferred) | Unknown from static route evidence. | None | Unknown | Medium: Public or tokenized routes detected | High | Unknown | Unknown |

## Webhooks

| Method | Path | Source | Access | Purpose | DTO evidence | Related DB models | Review notes | Confidence | Request | Response |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| POST | `/webhooks/resend` | `apps/api/src/webhooks/resend-webhook.controller.ts` | Unknown | Webhook ingestion/processing (inferred). | None | Unknown | High: Webhook handler files detected | High | Unknown | Unknown |

## Api

| Method | Path | Source | Access | Purpose | DTO evidence | Related DB models | Review notes | Confidence | Request | Response |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| HTTP | `/api/geocode` | `apps/web/app/api/geocode/route.ts` | Unknown | Unknown from static route evidence. | None | Unknown | None detected | High | Unknown | Unknown |
| HTTP | `/api/revalidate` | `apps/web/app/api/revalidate/route.ts` | Unknown | Unknown from static route evidence. | None | Unknown | None detected | High | Unknown | Unknown |

## Danas

| Method | Path | Source | Access | Purpose | DTO evidence | Related DB models | Review notes | Confidence | Request | Response |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| PAGE | `/danas` | `apps/web/app/danas/page.tsx` | Unknown | Unknown from static route evidence. | None | Unknown | None detected | High | Unknown | Unknown |

## Dodaj Event

| Method | Path | Source | Access | Purpose | DTO evidence | Related DB models | Review notes | Confidence | Request | Response |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| PAGE | `/dodaj-event` | `apps/web/app/dodaj-event/page.tsx` | Unknown | Unknown from static route evidence. | None | `Event` | None detected | High | Unknown | Unknown |

## Eventi

| Method | Path | Source | Access | Purpose | DTO evidence | Related DB models | Review notes | Confidence | Request | Response |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| HTTP | `/eventi/:eventSlug/calendar.ics` | `apps/web/app/eventi/[eventSlug]/calendar.ics/route.ts` | Unknown | Unknown from static route evidence. | None | `Event` | None detected | High | Unknown | Unknown |
| PAGE | `/eventi/:eventSlug` | `apps/web/app/eventi/[eventSlug]/page.tsx` | Unknown | Unknown from static route evidence. | None | `Event` | None detected | High | Unknown | Unknown |
| PAGE | `/eventi` | `apps/web/app/eventi/page.tsx` | Unknown | Unknown from static route evidence. | None | `Event` | None detected | High | Unknown | Unknown |

## Forgot Password

| Method | Path | Source | Access | Purpose | DTO evidence | Related DB models | Review notes | Confidence | Request | Response |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| PAGE | `/forgot-password` | `apps/web/app/forgot-password/page.tsx` | Unknown | Unknown from static route evidence. | None | Unknown | None detected | High | Unknown | Unknown |

## Gradovi

| Method | Path | Source | Access | Purpose | DTO evidence | Related DB models | Review notes | Confidence | Request | Response |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| PAGE | `/gradovi/:citySlug/kategorije/:categorySlug` | `apps/web/app/gradovi/[citySlug]/kategorije/[categorySlug]/page.tsx` | Unknown | Unknown from static route evidence. | None | `City`<br>`Category` | None detected | High | Unknown | Unknown |
| PAGE | `/gradovi/:citySlug` | `apps/web/app/gradovi/[citySlug]/page.tsx` | Unknown | Unknown from static route evidence. | None | `City` | None detected | High | Unknown | Unknown |
| PAGE | `/gradovi` | `apps/web/app/gradovi/page.tsx` | Unknown | Unknown from static route evidence. | None | Unknown | None detected | High | Unknown | Unknown |

## Kalendar

| Method | Path | Source | Access | Purpose | DTO evidence | Related DB models | Review notes | Confidence | Request | Response |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| PAGE | `/kalendar` | `apps/web/app/kalendar/page.tsx` | Unknown | Unknown from static route evidence. | None | Unknown | None detected | High | Unknown | Unknown |

## Kamo Za Vikend

| Method | Path | Source | Access | Purpose | DTO evidence | Related DB models | Review notes | Confidence | Request | Response |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| PAGE | `/kamo-za-vikend/gradovi/:citySlug` | `apps/web/app/kamo-za-vikend/gradovi/[citySlug]/page.tsx` | Unknown | Unknown from static route evidence. | None | `City` | None detected | High | Unknown | Unknown |
| PAGE | `/kamo-za-vikend/regije/:regionSlug` | `apps/web/app/kamo-za-vikend/regije/[regionSlug]/page.tsx` | Unknown | Unknown from static route evidence. | None | `Region` | None detected | High | Unknown | Unknown |

## Kategorije

| Method | Path | Source | Access | Purpose | DTO evidence | Related DB models | Review notes | Confidence | Request | Response |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| PAGE | `/kategorije/:categorySlug` | `apps/web/app/kategorije/[categorySlug]/page.tsx` | Unknown | Unknown from static route evidence. | None | `Category` | None detected | High | Unknown | Unknown |

## Kolacici

| Method | Path | Source | Access | Purpose | DTO evidence | Related DB models | Review notes | Confidence | Request | Response |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| PAGE | `/kolacici` | `apps/web/app/kolacici/page.tsx` | Unknown | Unknown from static route evidence. | None | Unknown | None detected | High | Unknown | Unknown |

## Mapa

| Method | Path | Source | Access | Purpose | DTO evidence | Related DB models | Review notes | Confidence | Request | Response |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| PAGE | `/mapa` | `apps/web/app/mapa/page.tsx` | Unknown | Unknown from static route evidence. | None | Unknown | None detected | High | Unknown | Unknown |

## Organizatori

| Method | Path | Source | Access | Purpose | DTO evidence | Related DB models | Review notes | Confidence | Request | Response |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| PAGE | `/organizatori/:organizerSlug/preuzmi` | `apps/web/app/organizatori/[organizerSlug]/preuzmi/page.tsx` | Unknown | Unknown from static route evidence. | None | `Organizer` | None detected | High | Unknown | Unknown |

## Organizer

| Method | Path | Source | Access | Purpose | DTO evidence | Related DB models | Review notes | Confidence | Request | Response |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| PAGE | `/organizer/events/:id` | `apps/web/app/organizer/events/[id]/page.tsx` | Unknown | Unknown from static route evidence. | None | `Organizer`<br>`Event` | None detected | High | Unknown | Unknown |
| PAGE | `/organizer/events/new` | `apps/web/app/organizer/events/new/page.tsx` | Unknown | Unknown from static route evidence. | None | `Organizer`<br>`Event` | None detected | High | Unknown | Unknown |
| PAGE | `/organizer/events` | `apps/web/app/organizer/events/page.tsx` | Unknown | Unknown from static route evidence. | None | `Organizer`<br>`Event` | None detected | High | Unknown | Unknown |
| PAGE | `/organizer/login` | `apps/web/app/organizer/login/page.tsx` | Unknown | Unknown from static route evidence. | None | `Organizer` | None detected | High | Unknown | Unknown |
| PAGE | `/organizer/register` | `apps/web/app/organizer/register/page.tsx` | Unknown | Unknown from static route evidence. | None | `Organizer` | None detected | High | Unknown | Unknown |
| PAGE | `/organizer/submit-link` | `apps/web/app/organizer/submit-link/page.tsx` | Unknown | Unknown from static route evidence. | None | `Organizer` | None detected | High | Unknown | Unknown |

## Ovaj Vikend

| Method | Path | Source | Access | Purpose | DTO evidence | Related DB models | Review notes | Confidence | Request | Response |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| PAGE | `/ovaj-vikend` | `apps/web/app/ovaj-vikend/page.tsx` | Unknown | Unknown from static route evidence. | None | Unknown | None detected | High | Unknown | Unknown |

## Pravila Privatnosti

| Method | Path | Source | Access | Purpose | DTO evidence | Related DB models | Review notes | Confidence | Request | Response |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| PAGE | `/pravila-privatnosti` | `apps/web/app/pravila-privatnosti/page.tsx` | Unknown | Unknown from static route evidence. | None | Unknown | None detected | High | Unknown | Unknown |

## Preuzmi Profil

| Method | Path | Source | Access | Purpose | DTO evidence | Related DB models | Review notes | Confidence | Request | Response |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| PAGE | `/preuzmi-profil` | `apps/web/app/preuzmi-profil/page.tsx` | Unknown | Unknown from static route evidence. | None | Unknown | None detected | High | Unknown | Unknown |

## Pridruzi Se

| Method | Path | Source | Access | Purpose | DTO evidence | Related DB models | Review notes | Confidence | Request | Response |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| PAGE | `/pridruzi-se` | `apps/web/app/pridruzi-se/page.tsx` | Unknown | Unknown from static route evidence. | None | Unknown | None detected | High | Unknown | Unknown |

## Regije

| Method | Path | Source | Access | Purpose | DTO evidence | Related DB models | Review notes | Confidence | Request | Response |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| PAGE | `/regije/:regionSlug/kategorije/:categorySlug` | `apps/web/app/regije/[regionSlug]/kategorije/[categorySlug]/page.tsx` | Unknown | Unknown from static route evidence. | None | `Region`<br>`Category` | None detected | High | Unknown | Unknown |
| PAGE | `/regije/:regionSlug` | `apps/web/app/regije/[regionSlug]/page.tsx` | Unknown | Unknown from static route evidence. | None | `Region` | None detected | High | Unknown | Unknown |
| PAGE | `/regije` | `apps/web/app/regije/page.tsx` | Unknown | Unknown from static route evidence. | None | Unknown | None detected | High | Unknown | Unknown |

## Reset Password

| Method | Path | Source | Access | Purpose | DTO evidence | Related DB models | Review notes | Confidence | Request | Response |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| PAGE | `/reset-password` | `apps/web/app/reset-password/page.tsx` | Unknown | Unknown from static route evidence. | None | Unknown | None detected | High | Unknown | Unknown |

## Uvjeti Koristenja

| Method | Path | Source | Access | Purpose | DTO evidence | Related DB models | Review notes | Confidence | Request | Response |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| PAGE | `/uvjeti-koristenja` | `apps/web/app/uvjeti-koristenja/page.tsx` | Unknown | Unknown from static route evidence. | None | Unknown | None detected | High | Unknown | Unknown |
