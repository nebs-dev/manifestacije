# Manifestacije.hr

Regional events-discovery platform for Slavonia and Baranja (Croatia). Live in production at [manifestacije.hr](https://manifestacije.hr).

## What it is

Manifestacije.hr aggregates local events (concerts, festivals, fairs, exhibitions, sports) for the Slavonia and Baranja region and makes them discoverable by city, category, date and map. It's a real, deployed product, not a demo -- actively ingesting and serving events in production.

## Scope

- Discovery: list, calendar and map views, filtered by city, category and date range
- Ingestion: URL/source parsers that normalize messy, real-world event data from external sites, with duplicate detection and merge/dismiss admin tooling
- Organizer workflows: registration, profile claims, event submission, and Resend-based contact sync tied to real user actions (not bulk-added)
- Admin: pending/approved event review, source monitoring and re-parsing, category/region management
- SEO: server-rendered public pages, sitemap, structured data (schema.org JSON-LD) and Search Console integration

## Architecture

- API: NestJS + PostgreSQL/Prisma, deployed on Railway
- Web: Next.js, deployed on Vercel
- Monorepo: pnpm workspaces (apps/api, apps/web, packages/shared)
- Auth with JWT, role-based access for admin/organizer flows, hashed password-reset tokens with single-use/expiry semantics

## Ownership

Built and operated end to end -- architecture, backend/frontend implementation, data ingestion pipeline, deployment and production operation.
