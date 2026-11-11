/**
 * One answer to "is this a production runtime", used by every guard that has
 * to behave differently there.
 *
 * It was previously inlined in email/email.config.ts. A second copy in the
 * SSRF guard would be a copy of a security-relevant predicate, which is
 * exactly the kind of thing that drifts, so both now read this.
 */
export function isProductionRuntime(): boolean {
  return (
    process.env.NODE_ENV === "production" ||
    process.env.VERCEL_ENV === "production" ||
    process.env.RAILWAY_ENVIRONMENT === "production" ||
    process.env.RAILWAY_ENVIRONMENT_NAME === "production"
  );
}
