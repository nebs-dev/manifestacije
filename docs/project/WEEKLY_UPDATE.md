# Weekly Update

Project: manifestacije
Range: last 7 days
Generated: 2026-08-25T10:55:51.229Z
Evidence: Kiroq events + git history + changed files + feature status + verification results

## Summary

This project recently changed around Public Discovery Pages, Auth / Access Control, Database / Schema, and Env / Config.  No Kiroq test/build verification evidence was recorded for this update. Public/tokenized or other sensitive flows should still be treated as needing explicit smoke review when listed below.

## What changed recently

- Public Discovery Pages
- Auth / Access Control
- Database / Schema
- Env / Config
- Verification / Tests
- Dependencies

## What is now stronger

- Data Imports has strong static implementation evidence.
- Locations has strong static implementation evidence.

## Still partial / needs verification

- AI/Crawler Discovery Surface: verification evidence not found or incomplete.
- Attribution / Lead Tracking: verification evidence not found or incomplete.

## Review areas

- Public routes: Public pages need crawler/human parity, unpublished-data, and 404 behavior review.
- Auth / JWT: Auth/JWT code exists; verify guards, session handling, secrets, and tenant boundaries.
- Database / Prisma: Schema/migration changes need data-shape and tenant-ownership review.
- Env / Config: Configuration and secrets need production coverage and committed-secret review.
- Webhook: Webhook handling needs signature/secret validation, replay protection, and invalid-payload behavior checks.
- Token / Report / Redirect: Tokenized report/redirect flows need expiry, signature or server validation, and guessability checks.

## Blocked or risky

- Runtime tests/builds are not fully verified by Kiroq.
- Auth / JWT: Auth/JWT code exists; verify guards, session handling, secrets, and tenant boundaries.
- Webhook: Webhook handling needs signature/secret validation, replay protection, and invalid-payload behavior checks.
- Database / Prisma: Schema/migration changes need data-shape and tenant-ownership review.
- Token / Report / Redirect: Tokenized report/redirect flows need expiry, signature or server validation, and guessability checks.

## Recommended next steps

1. Review public /b, report, robots, sitemap, llms, and discovery routes for crawler/human parity, 404 behavior, and unpublished-data exposure.
2. Verify webhook signature or secret validation and replay handling.
3. Check required production env var coverage between committed examples and deployment config.
4. Run target test/build commands manually or re-run Kiroq with --run-tests evidence.
