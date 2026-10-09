import type { INestApplication } from "@nestjs/common";

/**
 * How many reverse-proxy hops in front of the API may be trusted for the
 * client address (Express "trust proxy" as a hop count).
 *
 * Without this, Express reports the proxy's own socket address as `req.ip`.
 * On Railway that address rotates per request, so every rate-limit bucket
 * (keyed by `req.ip`) was effectively random: login brute-force protection
 * never accumulated per client, and unrelated clients could share buckets.
 *
 * A hop count, never `true`: with N hops Express takes the N-th address from
 * the right of X-Forwarded-For — the one appended by our own edge proxy — so
 * addresses a client puts in X-Forwarded-For itself are ignored.
 *
 * TRUST_PROXY_HOPS overrides (0 disables). Otherwise one hop is trusted when
 * running on Railway (its edge proxy appends the client IP) and none locally.
 */
export function resolveTrustProxyHops(env: NodeJS.ProcessEnv = process.env): number {
  const raw = env.TRUST_PROXY_HOPS?.trim();
  if (raw) {
    const hops = Number(raw);
    if (!Number.isInteger(hops) || hops < 0 || hops > 5) {
      throw new Error(`TRUST_PROXY_HOPS must be an integer between 0 and 5, got "${raw}"`);
    }
    return hops;
  }
  const onRailway = Boolean(env.RAILWAY_ENVIRONMENT || env.RAILWAY_ENVIRONMENT_NAME || env.RAILWAY_PROJECT_ID);
  return onRailway ? 1 : 0;
}

export function configureTrustProxy(app: INestApplication, env: NodeJS.ProcessEnv = process.env): number {
  const hops = resolveTrustProxyHops(env);
  // Express treats `false` as "no proxy"; a number is a hop count.
  app.getHttpAdapter().getInstance().set("trust proxy", hops > 0 ? hops : false);
  return hops;
}
