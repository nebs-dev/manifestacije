# API Routes

| Kind | Method | Path | Access | Confidence | Evidence |
| --- | --- | --- | --- | --- | --- |
| nestjs | GET | `/admin/pending-counts` | Auth-sensitive (Inferred) | ▮▮▮ High | `apps/api/src/admin/admin.controller.ts` |
| nestjs | POST | `/admin/events/bulk-categories` | Auth-sensitive (Inferred) | ▮▮▮ High | `apps/api/src/admin/admin.controller.ts` |
| nestjs | POST | `/admin/events/bulk-status` | Auth-sensitive (Inferred) | ▮▮▮ High | `apps/api/src/admin/admin.controller.ts` |
| nestjs | POST | `/admin/events/bulk-shift-dates` | Auth-sensitive (Inferred) | ▮▮▮ High | `apps/api/src/admin/admin.controller.ts` |
| nestjs | GET | `/admin/events/pending` | Auth-sensitive (Inferred) | ▮▮▮ High | `apps/api/src/admin/admin.controller.ts` |
| nestjs | GET | `/admin/events` | Auth-sensitive (Inferred) | ▮▮▮ High | `apps/api/src/admin/admin.controller.ts` |
| nestjs | POST | `/admin/events` | Auth-sensitive (Inferred) | ▮▮▮ High | `apps/api/src/admin/admin.controller.ts` |
| nestjs | GET | `/admin/events/:id` | Auth-sensitive (Inferred) | ▮▮▮ High | `apps/api/src/admin/admin.controller.ts` |
| nestjs | PUT | `/admin/events/:id` | Auth-sensitive (Inferred) | ▮▮▮ High | `apps/api/src/admin/admin.controller.ts` |
| nestjs | POST | `/admin/events/:id/approve` | Auth-sensitive (Inferred) | ▮▮▮ High | `apps/api/src/admin/admin.controller.ts` |
| nestjs | POST | `/admin/events/:id/reject` | Auth-sensitive (Inferred) | ▮▮▮ High | `apps/api/src/admin/admin.controller.ts` |
| nestjs | POST | `/admin/events/:id/publish` | Auth-sensitive (Inferred) | ▮▮▮ High | `apps/api/src/admin/admin.controller.ts` |
| nestjs | POST | `/admin/events/:id/archive` | Auth-sensitive (Inferred) | ▮▮▮ High | `apps/api/src/admin/admin.controller.ts` |
| nestjs | POST | `/admin/events/:id/duplicate` | Auth-sensitive (Inferred) | ▮▮▮ High | `apps/api/src/admin/admin.controller.ts` |
| nestjs | POST | `/admin/events/:id/split-weekly` | Auth-sensitive (Inferred) | ▮▮▮ High | `apps/api/src/admin/admin.controller.ts` |
| nestjs | DELETE | `/admin/events/:id` | Auth-sensitive (Inferred) | ▮▮▮ High | `apps/api/src/admin/admin.controller.ts` |
| nestjs | GET | `/admin/organizers` | Auth-sensitive (Inferred) | ▮▮▮ High | `apps/api/src/admin/admin.controller.ts` |
| nestjs | POST | `/admin/organizers` | Auth-sensitive (Inferred) | ▮▮▮ High | `apps/api/src/admin/admin.controller.ts` |
| nestjs | PUT | `/admin/organizers/:id` | Auth-sensitive (Inferred) | ▮▮▮ High | `apps/api/src/admin/admin.controller.ts` |
| nestjs | POST | `/admin/organizers/:id/verify` | Auth-sensitive (Inferred) | ▮▮▮ High | `apps/api/src/admin/admin.controller.ts` |
| nestjs | POST | `/admin/organizers/:id/trust` | Auth-sensitive (Inferred) | ▮▮▮ High | `apps/api/src/admin/admin.controller.ts` |
| nestjs | POST | `/admin/organizers/:id/reset-password` | Auth-sensitive (Inferred) | ▮▮▮ High | `apps/api/src/admin/admin.controller.ts` |
| nestjs | POST | `/admin/organizers/:id/send-claim-invite` | Auth-sensitive (Inferred) | ▮▮▮ High | `apps/api/src/admin/admin.controller.ts` |
| nestjs | POST | `/admin/organizers/bulk-invite-unclaimed` | Auth-sensitive (Inferred) | ▮▮▮ High | `apps/api/src/admin/admin.controller.ts` |
| nestjs | DELETE | `/admin/organizers/:id` | Auth-sensitive (Inferred) | ▮▮▮ High | `apps/api/src/admin/admin.controller.ts` |
| nestjs | GET | `/admin/users` | Auth-sensitive (Inferred) | ▮▮▮ High | `apps/api/src/admin/admin.controller.ts` |
| nestjs | DELETE | `/admin/users/:id` | Auth-sensitive (Inferred) | ▮▮▮ High | `apps/api/src/admin/admin.controller.ts` |
| nestjs | GET | `/admin/organizer-claims` | Auth-sensitive (Inferred) | ▮▮▮ High | `apps/api/src/admin/admin.controller.ts` |
| nestjs | POST | `/admin/organizer-claims/:id/approve` | Auth-sensitive (Inferred) | ▮▮▮ High | `apps/api/src/admin/admin.controller.ts` |
| nestjs | POST | `/admin/organizer-claims/:id/reject` | Auth-sensitive (Inferred) | ▮▮▮ High | `apps/api/src/admin/admin.controller.ts` |
| nestjs | POST | `/admin/uploads/event-image` | Auth-sensitive (Inferred) | ▮▮▮ High | `apps/api/src/admin/admin.controller.ts` |
| nestjs | POST | `/admin/uploads/partner-logo` | Auth-sensitive (Inferred) | ▮▮▮ High | `apps/api/src/admin/admin.controller.ts` |
| nestjs | GET | `/admin/event-sources` | Auth-sensitive (Inferred) | ▮▮▮ High | `apps/api/src/admin/admin.controller.ts` |
| nestjs | POST | `/admin/event-sources/manual-email` | Auth-sensitive (Inferred) | ▮▮▮ High | `apps/api/src/admin/admin.controller.ts` |
| nestjs | POST | `/admin/event-sources/parse-url` | Auth-sensitive (Inferred) | ▮▮▮ High | `apps/api/src/admin/admin.controller.ts` |
| nestjs | GET | `/admin/event-sources/:id` | Auth-sensitive (Inferred) | ▮▮▮ High | `apps/api/src/admin/admin.controller.ts` |
| nestjs | PUT | `/admin/event-sources/:id` | Auth-sensitive (Inferred) | ▮▮▮ High | `apps/api/src/admin/admin.controller.ts` |
| nestjs | POST | `/admin/event-sources/:id/reparse` | Auth-sensitive (Inferred) | ▮▮▮ High | `apps/api/src/admin/admin.controller.ts` |
| nestjs | POST | `/admin/event-sources/:id/create-event` | Auth-sensitive (Inferred) | ▮▮▮ High | `apps/api/src/admin/admin.controller.ts` |
| nestjs | POST | `/admin/event-sources/:id/ignore-candidate` | Auth-sensitive (Inferred) | ▮▮▮ High | `apps/api/src/admin/admin.controller.ts` |
| nestjs | DELETE | `/admin/event-sources/:id` | Auth-sensitive (Inferred) | ▮▮▮ High | `apps/api/src/admin/admin.controller.ts` |
| nestjs | GET | `/admin/duplicates` | Auth-sensitive (Inferred) | ▮▮▮ High | `apps/api/src/admin/admin.controller.ts` |
| nestjs | POST | `/admin/duplicates/:id/merge` | Auth-sensitive (Inferred) | ▮▮▮ High | `apps/api/src/admin/admin.controller.ts` |
| nestjs | POST | `/admin/duplicates/:id/dismiss` | Auth-sensitive (Inferred) | ▮▮▮ High | `apps/api/src/admin/admin.controller.ts` |
| nestjs | GET | `/admin/regions` | Auth-sensitive (Inferred) | ▮▮▮ High | `apps/api/src/admin/admin.controller.ts` |
| nestjs | POST | `/admin/regions` | Auth-sensitive (Inferred) | ▮▮▮ High | `apps/api/src/admin/admin.controller.ts` |
| nestjs | DELETE | `/admin/regions/:id` | Auth-sensitive (Inferred) | ▮▮▮ High | `apps/api/src/admin/admin.controller.ts` |
| nestjs | POST | `/admin/counties` | Auth-sensitive (Inferred) | ▮▮▮ High | `apps/api/src/admin/admin.controller.ts` |
| nestjs | DELETE | `/admin/counties/:id` | Auth-sensitive (Inferred) | ▮▮▮ High | `apps/api/src/admin/admin.controller.ts` |
| nestjs | POST | `/admin/cities` | Auth-sensitive (Inferred) | ▮▮▮ High | `apps/api/src/admin/admin.controller.ts` |
| nestjs | PUT | `/admin/cities/:id` | Auth-sensitive (Inferred) | ▮▮▮ High | `apps/api/src/admin/admin.controller.ts` |
| nestjs | DELETE | `/admin/cities/:id` | Auth-sensitive (Inferred) | ▮▮▮ High | `apps/api/src/admin/admin.controller.ts` |
| nestjs | GET | `/admin/venues/search` | Auth-sensitive (Inferred) | ▮▮▮ High | `apps/api/src/admin/admin.controller.ts` |
| nestjs | GET | `/admin/categories` | Auth-sensitive (Inferred) | ▮▮▮ High | `apps/api/src/admin/admin.controller.ts` |
| nestjs | POST | `/admin/categories` | Auth-sensitive (Inferred) | ▮▮▮ High | `apps/api/src/admin/admin.controller.ts` |
| nestjs | PUT | `/admin/categories/:id` | Auth-sensitive (Inferred) | ▮▮▮ High | `apps/api/src/admin/admin.controller.ts` |
| nestjs | DELETE | `/admin/categories/:id` | Auth-sensitive (Inferred) | ▮▮▮ High | `apps/api/src/admin/admin.controller.ts` |
| nestjs | GET | `/admin/partners` | Auth-sensitive (Inferred) | ▮▮▮ High | `apps/api/src/admin/admin.controller.ts` |
| nestjs | POST | `/admin/partners` | Auth-sensitive (Inferred) | ▮▮▮ High | `apps/api/src/admin/admin.controller.ts` |
| nestjs | PUT | `/admin/partners/:id` | Auth-sensitive (Inferred) | ▮▮▮ High | `apps/api/src/admin/admin.controller.ts` |
| nestjs | DELETE | `/admin/partners/:id` | Auth-sensitive (Inferred) | ▮▮▮ High | `apps/api/src/admin/admin.controller.ts` |
| nestjs | POST | `/auth/register` | Auth-sensitive (Inferred) | ▮▮▮ High | `apps/api/src/auth/auth.controller.ts` |
| nestjs | POST | `/auth/login` | Auth-sensitive (Inferred) | ▮▮▮ High | `apps/api/src/auth/auth.controller.ts` |
| nestjs | GET | `/auth/me` | Auth-sensitive (Inferred) | ▮▮▮ High | `apps/api/src/auth/auth.controller.ts` |
| nestjs | POST | `/auth/forgot-password` | Auth-sensitive (Inferred) | ▮▮▮ High | `apps/api/src/auth/auth.controller.ts` |
| nestjs | POST | `/auth/reset-password` | Auth-sensitive (Inferred) | ▮▮▮ High | `apps/api/src/auth/auth.controller.ts` |
| nestjs | GET | `/admin/monitored-sources` | Auth-sensitive (Inferred) | ▮▮▮ High | `apps/api/src/monitored-sources/monitored-sources.controller.ts` |
| nestjs | GET | `/admin/monitored-sources/:id` | Auth-sensitive (Inferred) | ▮▮▮ High | `apps/api/src/monitored-sources/monitored-sources.controller.ts` |
| nestjs | GET | `/admin/monitored-sources/:id/runs` | Auth-sensitive (Inferred) | ▮▮▮ High | `apps/api/src/monitored-sources/monitored-sources.controller.ts` |
| nestjs | POST | `/admin/monitored-sources` | Auth-sensitive (Inferred) | ▮▮▮ High | `apps/api/src/monitored-sources/monitored-sources.controller.ts` |
| nestjs | PUT | `/admin/monitored-sources/:id` | Auth-sensitive (Inferred) | ▮▮▮ High | `apps/api/src/monitored-sources/monitored-sources.controller.ts` |
| nestjs | DELETE | `/admin/monitored-sources/:id` | Auth-sensitive (Inferred) | ▮▮▮ High | `apps/api/src/monitored-sources/monitored-sources.controller.ts` |
| nestjs | POST | `/admin/monitored-sources/:id/run` | Auth-sensitive (Inferred) | ▮▮▮ High | `apps/api/src/monitored-sources/monitored-sources.controller.ts` |
| nestjs | POST | `/organizer-claims/request` | Unknown | ▮▮▮ High | `apps/api/src/organizer-claims/organizer-claim.controller.ts` |
| nestjs | POST | `/organizer-claims/request-by-email` | Unknown | ▮▮▮ High | `apps/api/src/organizer-claims/organizer-claim.controller.ts` |
| nestjs | POST | `/organizer-claims/verify` | Unknown | ▮▮▮ High | `apps/api/src/organizer-claims/organizer-claim.controller.ts` |
| nestjs | POST | `/organizer-claims/complete` | Unknown | ▮▮▮ High | `apps/api/src/organizer-claims/organizer-claim.controller.ts` |
| nestjs | GET | `/organizer/profile` | Unknown | ▮▮▮ High | `apps/api/src/organizers/organizer.controller.ts` |
| nestjs | PUT | `/organizer/profile` | Unknown | ▮▮▮ High | `apps/api/src/organizers/organizer.controller.ts` |
| nestjs | GET | `/organizer/events` | Unknown | ▮▮▮ High | `apps/api/src/organizers/organizer.controller.ts` |
| nestjs | GET | `/organizer/sources` | Unknown | ▮▮▮ High | `apps/api/src/organizers/organizer.controller.ts` |
| nestjs | POST | `/organizer/events` | Unknown | ▮▮▮ High | `apps/api/src/organizers/organizer.controller.ts` |
| nestjs | PUT | `/organizer/events/:id` | Unknown | ▮▮▮ High | `apps/api/src/organizers/organizer.controller.ts` |
| nestjs | DELETE | `/organizer/events/:id` | Unknown | ▮▮▮ High | `apps/api/src/organizers/organizer.controller.ts` |
| nestjs | POST | `/organizer/events/submit-url` | Unknown | ▮▮▮ High | `apps/api/src/organizers/organizer.controller.ts` |
| nestjs | POST | `/organizer/uploads/event-image` | Unknown | ▮▮▮ High | `apps/api/src/organizers/organizer.controller.ts` |
| nestjs | GET | `/public/events` | Public (Inferred) | ▮▮▮ High | `apps/api/src/public-feed/public-feed.controller.ts` |
| nestjs | GET | `/public/events/:slug` | Public (Inferred) | ▮▮▮ High | `apps/api/src/public-feed/public-feed.controller.ts` |
| nestjs | GET | `/public/organizers/:slug` | Public (Inferred) | ▮▮▮ High | `apps/api/src/public-feed/public-feed.controller.ts` |
| nestjs | GET | `/public/regions` | Public (Inferred) | ▮▮▮ High | `apps/api/src/public-feed/public-feed.controller.ts` |
| nestjs | GET | `/public/cities` | Public (Inferred) | ▮▮▮ High | `apps/api/src/public-feed/public-feed.controller.ts` |
| nestjs | GET | `/public/regions/:slug/events` | Public (Inferred) | ▮▮▮ High | `apps/api/src/public-feed/public-feed.controller.ts` |
| nestjs | GET | `/public/cities/:slug/events` | Public (Inferred) | ▮▮▮ High | `apps/api/src/public-feed/public-feed.controller.ts` |
| nestjs | GET | `/public/categories` | Public (Inferred) | ▮▮▮ High | `apps/api/src/public-feed/public-feed.controller.ts` |
| nestjs | GET | `/public/partners` | Public (Inferred) | ▮▮▮ High | `apps/api/src/public-feed/public-feed.controller.ts` |
| nestjs | GET | `/public/categories/:slug/events` | Public (Inferred) | ▮▮▮ High | `apps/api/src/public-feed/public-feed.controller.ts` |
| nestjs | GET | `/public/map/events` | Public (Inferred) | ▮▮▮ High | `apps/api/src/public-feed/public-feed.controller.ts` |
| nestjs | GET | `/public/seo/sitemap-data` | Public (Inferred) | ▮▮▮ High | `apps/api/src/public-feed/public-feed.controller.ts` |
| nestjs | POST | `/webhooks/resend` | Unknown | ▮▮▮ High | `apps/api/src/webhooks/resend-webhook.controller.ts` |
| next-app | PAGE | `/admin/categories` | Auth-sensitive (Inferred) | ▮▮▮ High | `apps/web/app/admin/categories/page.tsx` |
| next-app | PAGE | `/admin/duplicates` | Auth-sensitive (Inferred) | ▮▮▮ High | `apps/web/app/admin/duplicates/page.tsx` |
| next-app | PAGE | `/admin/events/:id` | Auth-sensitive (Inferred) | ▮▮▮ High | `apps/web/app/admin/events/[id]/page.tsx` |
| next-app | PAGE | `/admin/events/new` | Auth-sensitive (Inferred) | ▮▮▮ High | `apps/web/app/admin/events/new/page.tsx` |
| next-app | PAGE | `/admin/events` | Auth-sensitive (Inferred) | ▮▮▮ High | `apps/web/app/admin/events/page.tsx` |
| next-app | PAGE | `/admin/events/pending` | Auth-sensitive (Inferred) | ▮▮▮ High | `apps/web/app/admin/events/pending/page.tsx` |
| next-app | PAGE | `/admin/login` | Auth-sensitive (Inferred) | ▮▮▮ High | `apps/web/app/admin/login/page.tsx` |
| next-app | PAGE | `/admin/monitored-sources/:id` | Auth-sensitive (Inferred) | ▮▮▮ High | `apps/web/app/admin/monitored-sources/[id]/page.tsx` |
| next-app | PAGE | `/admin/monitored-sources` | Auth-sensitive (Inferred) | ▮▮▮ High | `apps/web/app/admin/monitored-sources/page.tsx` |
| next-app | PAGE | `/admin/organizer-claims` | Auth-sensitive (Inferred) | ▮▮▮ High | `apps/web/app/admin/organizer-claims/page.tsx` |
| next-app | PAGE | `/admin/organizers` | Auth-sensitive (Inferred) | ▮▮▮ High | `apps/web/app/admin/organizers/page.tsx` |
| next-app | PAGE | `/admin` | Auth-sensitive (Inferred) | ▮▮▮ High | `apps/web/app/admin/page.tsx` |
| next-app | PAGE | `/admin/partners` | Auth-sensitive (Inferred) | ▮▮▮ High | `apps/web/app/admin/partners/page.tsx` |
| next-app | PAGE | `/admin/regions` | Auth-sensitive (Inferred) | ▮▮▮ High | `apps/web/app/admin/regions/page.tsx` |
| next-app | PAGE | `/admin/sources/:id` | Auth-sensitive (Inferred) | ▮▮▮ High | `apps/web/app/admin/sources/[id]/page.tsx` |
| next-app | PAGE | `/admin/sources` | Auth-sensitive (Inferred) | ▮▮▮ High | `apps/web/app/admin/sources/page.tsx` |
| next-app | PAGE | `/admin/users` | Auth-sensitive (Inferred) | ▮▮▮ High | `apps/web/app/admin/users/page.tsx` |
| next-app | HTTP | `/api/geocode` | Unknown | ▮▮▮ High | `apps/web/app/api/geocode/route.ts` |
| next-app | HTTP | `/api/revalidate` | Unknown | ▮▮▮ High | `apps/web/app/api/revalidate/route.ts` |
| next-app | PAGE | `/danas` | Unknown | ▮▮▮ High | `apps/web/app/danas/page.tsx` |
| next-app | PAGE | `/dodaj-event` | Unknown | ▮▮▮ High | `apps/web/app/dodaj-event/page.tsx` |
| next-app | HTTP | `/eventi/:eventSlug/calendar.ics` | Unknown | ▮▮▮ High | `apps/web/app/eventi/[eventSlug]/calendar.ics/route.ts` |
| next-app | PAGE | `/eventi/:eventSlug` | Unknown | ▮▮▮ High | `apps/web/app/eventi/[eventSlug]/page.tsx` |
| next-app | PAGE | `/eventi` | Unknown | ▮▮▮ High | `apps/web/app/eventi/page.tsx` |
| next-app | PAGE | `/forgot-password` | Unknown | ▮▮▮ High | `apps/web/app/forgot-password/page.tsx` |
| next-app | PAGE | `/gradovi/:citySlug/kategorije/:categorySlug` | Unknown | ▮▮▮ High | `apps/web/app/gradovi/[citySlug]/kategorije/[categorySlug]/page.tsx` |
| next-app | PAGE | `/gradovi/:citySlug` | Unknown | ▮▮▮ High | `apps/web/app/gradovi/[citySlug]/page.tsx` |
| next-app | PAGE | `/gradovi` | Unknown | ▮▮▮ High | `apps/web/app/gradovi/page.tsx` |
| next-app | PAGE | `/kalendar` | Unknown | ▮▮▮ High | `apps/web/app/kalendar/page.tsx` |
| next-app | PAGE | `/kamo-za-vikend/gradovi/:citySlug` | Unknown | ▮▮▮ High | `apps/web/app/kamo-za-vikend/gradovi/[citySlug]/page.tsx` |
| next-app | PAGE | `/kamo-za-vikend/regije/:regionSlug` | Unknown | ▮▮▮ High | `apps/web/app/kamo-za-vikend/regije/[regionSlug]/page.tsx` |
| next-app | PAGE | `/kategorije/:categorySlug` | Unknown | ▮▮▮ High | `apps/web/app/kategorije/[categorySlug]/page.tsx` |
| next-app | PAGE | `/kolacici` | Unknown | ▮▮▮ High | `apps/web/app/kolacici/page.tsx` |
| next-app | PAGE | `/mapa` | Unknown | ▮▮▮ High | `apps/web/app/mapa/page.tsx` |
| next-app | PAGE | `/organizatori/:organizerSlug/preuzmi` | Unknown | ▮▮▮ High | `apps/web/app/organizatori/[organizerSlug]/preuzmi/page.tsx` |
| next-app | PAGE | `/organizer/events/:id` | Unknown | ▮▮▮ High | `apps/web/app/organizer/events/[id]/page.tsx` |
| next-app | PAGE | `/organizer/events/new` | Unknown | ▮▮▮ High | `apps/web/app/organizer/events/new/page.tsx` |
| next-app | PAGE | `/organizer/events` | Unknown | ▮▮▮ High | `apps/web/app/organizer/events/page.tsx` |
| next-app | PAGE | `/organizer/login` | Unknown | ▮▮▮ High | `apps/web/app/organizer/login/page.tsx` |
| next-app | PAGE | `/organizer/register` | Unknown | ▮▮▮ High | `apps/web/app/organizer/register/page.tsx` |
| next-app | PAGE | `/organizer/submit-link` | Unknown | ▮▮▮ High | `apps/web/app/organizer/submit-link/page.tsx` |
| next-app | PAGE | `/ovaj-vikend` | Unknown | ▮▮▮ High | `apps/web/app/ovaj-vikend/page.tsx` |
| next-app | PAGE | `/pravila-privatnosti` | Unknown | ▮▮▮ High | `apps/web/app/pravila-privatnosti/page.tsx` |
| next-app | PAGE | `/preuzmi-profil` | Unknown | ▮▮▮ High | `apps/web/app/preuzmi-profil/page.tsx` |
| next-app | PAGE | `/pridruzi-se` | Unknown | ▮▮▮ High | `apps/web/app/pridruzi-se/page.tsx` |
| next-app | PAGE | `/regije/:regionSlug/kategorije/:categorySlug` | Unknown | ▮▮▮ High | `apps/web/app/regije/[regionSlug]/kategorije/[categorySlug]/page.tsx` |
| next-app | PAGE | `/regije/:regionSlug` | Unknown | ▮▮▮ High | `apps/web/app/regije/[regionSlug]/page.tsx` |
| next-app | PAGE | `/regije` | Unknown | ▮▮▮ High | `apps/web/app/regije/page.tsx` |
| next-app | PAGE | `/reset-password` | Unknown | ▮▮▮ High | `apps/web/app/reset-password/page.tsx` |
| next-app | PAGE | `/uvjeti-koristenja` | Unknown | ▮▮▮ High | `apps/web/app/uvjeti-koristenja/page.tsx` |
