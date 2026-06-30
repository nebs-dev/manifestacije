# API Routes

| Kind | Method | Path | Access | Confidence | Evidence |
| --- | --- | --- | --- | --- | --- |
| nestjs | GET | `/admin/events/pending` | Auth-sensitive (Inferred) | High | `apps/api/src/admin/admin.controller.ts` |
| nestjs | GET | `/admin/events` | Auth-sensitive (Inferred) | High | `apps/api/src/admin/admin.controller.ts` |
| nestjs | GET | `/admin/events/:id` | Auth-sensitive (Inferred) | High | `apps/api/src/admin/admin.controller.ts` |
| nestjs | PUT | `/admin/events/:id` | Auth-sensitive (Inferred) | High | `apps/api/src/admin/admin.controller.ts` |
| nestjs | POST | `/admin/events/:id/approve` | Auth-sensitive (Inferred) | High | `apps/api/src/admin/admin.controller.ts` |
| nestjs | POST | `/admin/events/:id/reject` | Auth-sensitive (Inferred) | High | `apps/api/src/admin/admin.controller.ts` |
| nestjs | POST | `/admin/events/:id/publish` | Auth-sensitive (Inferred) | High | `apps/api/src/admin/admin.controller.ts` |
| nestjs | POST | `/admin/events/:id/archive` | Auth-sensitive (Inferred) | High | `apps/api/src/admin/admin.controller.ts` |
| nestjs | DELETE | `/admin/events/:id` | Auth-sensitive (Inferred) | High | `apps/api/src/admin/admin.controller.ts` |
| nestjs | GET | `/admin/organizers` | Auth-sensitive (Inferred) | High | `apps/api/src/admin/admin.controller.ts` |
| nestjs | POST | `/admin/organizers` | Auth-sensitive (Inferred) | High | `apps/api/src/admin/admin.controller.ts` |
| nestjs | PUT | `/admin/organizers/:id` | Auth-sensitive (Inferred) | High | `apps/api/src/admin/admin.controller.ts` |
| nestjs | POST | `/admin/organizers/:id/verify` | Auth-sensitive (Inferred) | High | `apps/api/src/admin/admin.controller.ts` |
| nestjs | POST | `/admin/organizers/:id/trust` | Auth-sensitive (Inferred) | High | `apps/api/src/admin/admin.controller.ts` |
| nestjs | DELETE | `/admin/organizers/:id` | Auth-sensitive (Inferred) | High | `apps/api/src/admin/admin.controller.ts` |
| nestjs | GET | `/admin/event-sources` | Auth-sensitive (Inferred) | High | `apps/api/src/admin/admin.controller.ts` |
| nestjs | POST | `/admin/event-sources/manual-email` | Auth-sensitive (Inferred) | High | `apps/api/src/admin/admin.controller.ts` |
| nestjs | POST | `/admin/event-sources/parse-url` | Auth-sensitive (Inferred) | High | `apps/api/src/admin/admin.controller.ts` |
| nestjs | GET | `/admin/event-sources/:id` | Auth-sensitive (Inferred) | High | `apps/api/src/admin/admin.controller.ts` |
| nestjs | POST | `/admin/event-sources/:id/reparse` | Auth-sensitive (Inferred) | High | `apps/api/src/admin/admin.controller.ts` |
| nestjs | POST | `/admin/event-sources/:id/create-event` | Auth-sensitive (Inferred) | High | `apps/api/src/admin/admin.controller.ts` |
| nestjs | POST | `/admin/event-sources/:id/ignore-candidate` | Auth-sensitive (Inferred) | High | `apps/api/src/admin/admin.controller.ts` |
| nestjs | DELETE | `/admin/event-sources/:id` | Auth-sensitive (Inferred) | High | `apps/api/src/admin/admin.controller.ts` |
| nestjs | GET | `/admin/duplicates` | Auth-sensitive (Inferred) | High | `apps/api/src/admin/admin.controller.ts` |
| nestjs | POST | `/admin/duplicates/:id/merge` | Auth-sensitive (Inferred) | High | `apps/api/src/admin/admin.controller.ts` |
| nestjs | POST | `/admin/duplicates/:id/dismiss` | Auth-sensitive (Inferred) | High | `apps/api/src/admin/admin.controller.ts` |
| nestjs | GET | `/admin/regions` | Auth-sensitive (Inferred) | High | `apps/api/src/admin/admin.controller.ts` |
| nestjs | GET | `/admin/categories` | Auth-sensitive (Inferred) | High | `apps/api/src/admin/admin.controller.ts` |
| nestjs | POST | `/auth/register` | Auth-sensitive (Inferred) | High | `apps/api/src/auth/auth.controller.ts` |
| nestjs | POST | `/auth/login` | Auth-sensitive (Inferred) | High | `apps/api/src/auth/auth.controller.ts` |
| nestjs | GET | `/auth/me` | Auth-sensitive (Inferred) | High | `apps/api/src/auth/auth.controller.ts` |
| nestjs | GET | `/organizer/profile` | Unknown | High | `apps/api/src/organizers/organizer.controller.ts` |
| nestjs | PUT | `/organizer/profile` | Unknown | High | `apps/api/src/organizers/organizer.controller.ts` |
| nestjs | GET | `/organizer/events` | Unknown | High | `apps/api/src/organizers/organizer.controller.ts` |
| nestjs | POST | `/organizer/events` | Unknown | High | `apps/api/src/organizers/organizer.controller.ts` |
| nestjs | PUT | `/organizer/events/:id` | Unknown | High | `apps/api/src/organizers/organizer.controller.ts` |
| nestjs | POST | `/organizer/events/submit-url` | Unknown | High | `apps/api/src/organizers/organizer.controller.ts` |
| nestjs | GET | `/public/events` | Public (Inferred) | High | `apps/api/src/public-feed/public-feed.controller.ts` |
| nestjs | GET | `/public/events/:slug` | Public (Inferred) | High | `apps/api/src/public-feed/public-feed.controller.ts` |
| nestjs | GET | `/public/regions` | Public (Inferred) | High | `apps/api/src/public-feed/public-feed.controller.ts` |
| nestjs | GET | `/public/regions/:slug/events` | Public (Inferred) | High | `apps/api/src/public-feed/public-feed.controller.ts` |
| nestjs | GET | `/public/cities/:slug/events` | Public (Inferred) | High | `apps/api/src/public-feed/public-feed.controller.ts` |
| nestjs | GET | `/public/categories` | Public (Inferred) | High | `apps/api/src/public-feed/public-feed.controller.ts` |
| nestjs | GET | `/public/categories/:slug/events` | Public (Inferred) | High | `apps/api/src/public-feed/public-feed.controller.ts` |
| nestjs | GET | `/public/map/events` | Public (Inferred) | High | `apps/api/src/public-feed/public-feed.controller.ts` |
| nestjs | GET | `/public/seo/sitemap-data` | Public (Inferred) | High | `apps/api/src/public-feed/public-feed.controller.ts` |
| next-app | PAGE | `/admin/categories` | Auth-sensitive (Inferred) | High | `apps/web/app/admin/categories/page.tsx` |
| next-app | PAGE | `/admin/duplicates` | Auth-sensitive (Inferred) | High | `apps/web/app/admin/duplicates/page.tsx` |
| next-app | PAGE | `/admin/events/:id` | Auth-sensitive (Inferred) | High | `apps/web/app/admin/events/[id]/page.tsx` |
| next-app | PAGE | `/admin/events` | Auth-sensitive (Inferred) | High | `apps/web/app/admin/events/page.tsx` |
| next-app | PAGE | `/admin/events/pending` | Auth-sensitive (Inferred) | High | `apps/web/app/admin/events/pending/page.tsx` |
| next-app | PAGE | `/admin/login` | Auth-sensitive (Inferred) | High | `apps/web/app/admin/login/page.tsx` |
| next-app | PAGE | `/admin/organizers` | Auth-sensitive (Inferred) | High | `apps/web/app/admin/organizers/page.tsx` |
| next-app | PAGE | `/admin` | Auth-sensitive (Inferred) | High | `apps/web/app/admin/page.tsx` |
| next-app | PAGE | `/admin/regions` | Auth-sensitive (Inferred) | High | `apps/web/app/admin/regions/page.tsx` |
| next-app | PAGE | `/admin/sources/:id` | Auth-sensitive (Inferred) | High | `apps/web/app/admin/sources/[id]/page.tsx` |
| next-app | PAGE | `/admin/sources` | Auth-sensitive (Inferred) | High | `apps/web/app/admin/sources/page.tsx` |
| next-app | PAGE | `/danas` | Unknown | High | `apps/web/app/danas/page.tsx` |
| next-app | PAGE | `/dodaj-event` | Unknown | High | `apps/web/app/dodaj-event/page.tsx` |
| next-app | PAGE | `/eventi/:eventSlug` | Unknown | High | `apps/web/app/eventi/[eventSlug]/page.tsx` |
| next-app | PAGE | `/eventi` | Unknown | High | `apps/web/app/eventi/page.tsx` |
| next-app | PAGE | `/gradovi/:citySlug` | Unknown | High | `apps/web/app/gradovi/[citySlug]/page.tsx` |
| next-app | PAGE | `/kalendar` | Unknown | High | `apps/web/app/kalendar/page.tsx` |
| next-app | PAGE | `/kategorije/:categorySlug` | Unknown | High | `apps/web/app/kategorije/[categorySlug]/page.tsx` |
| next-app | PAGE | `/mapa` | Unknown | High | `apps/web/app/mapa/page.tsx` |
| next-app | PAGE | `/organizer/events/:id` | Unknown | High | `apps/web/app/organizer/events/[id]/page.tsx` |
| next-app | PAGE | `/organizer/events/new` | Unknown | High | `apps/web/app/organizer/events/new/page.tsx` |
| next-app | PAGE | `/organizer/events` | Unknown | High | `apps/web/app/organizer/events/page.tsx` |
| next-app | PAGE | `/organizer/login` | Unknown | High | `apps/web/app/organizer/login/page.tsx` |
| next-app | PAGE | `/organizer/register` | Unknown | High | `apps/web/app/organizer/register/page.tsx` |
| next-app | PAGE | `/organizer/submit-link` | Unknown | High | `apps/web/app/organizer/submit-link/page.tsx` |
| next-app | PAGE | `/ovaj-vikend` | Unknown | High | `apps/web/app/ovaj-vikend/page.tsx` |
| next-app | PAGE | `/regije/:regionSlug` | Unknown | High | `apps/web/app/regije/[regionSlug]/page.tsx` |
| next-app | PAGE | `/regije` | Unknown | High | `apps/web/app/regije/page.tsx` |
