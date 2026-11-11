import { lookup } from "node:dns/promises";
import { isIPv4, isIPv6 } from "node:net";
import { isProductionRuntime } from "./runtime";

/**
 * Egress guard for every URL a user can make this server fetch.
 *
 * Why this exists. `/organizer/register` is open self-registration, and an
 * organizer can then submit a link that OrganizerService fetches server-side.
 * The fetched page is parsed into candidates the submitter can read back from
 * `GET /api/organizer/sources`, and when the page looks like a listing,
 * `crawlListingSubPages` follows up to ten links out of that very page and
 * stores 2000 characters of each one verbatim in `rawText` — which the same
 * endpoint returns. So an unguarded fetch here is not blind SSRF: it reads
 * internal addresses and hands the contents back.
 *
 * This is deliberately NOT in safe-url.ts. That module answers "is this link
 * safe to put in an href/src" and is applied to ticketUrl, imageUrl and
 * websiteUrl, which are stored and rendered, never fetched. Filtering hosts
 * there would reject legitimate stored links and still miss the fetch sites.
 * The check belongs at the egress point, which is what this file is.
 */

export class SsrfBlockedError extends Error {
  constructor(readonly reason: string) {
    super(reason);
    this.name = "SsrfBlockedError";
  }
}

/** What a caller shows the submitter. The detailed reason stays in the logs:
 *  telling someone which of their addresses resolved privately turns this
 *  endpoint into a probe for the internal network. */
export const SSRF_PUBLIC_MESSAGE = "Ta poveznica nije dopuštena.";

const MAX_REDIRECTS = 5;
/** Matches the caps politeFetch already applied to scheduled fetches. */
const DEFAULT_TIMEOUT_MS = 12_000;
const DEFAULT_MAX_BYTES = 5 * 1024 * 1024;

/* ------------------------------------------------------------------ *
 * Address classification
 * ------------------------------------------------------------------ */

/** Expands any IPv6 spelling into eight 16-bit groups, or null. */
function expandIPv6(address: string): number[] | null {
  const [head, tail] = address.split("::");
  const parse = (part: string): number[] => {
    if (!part) return [];
    return part.split(":").flatMap((group) => {
      // A trailing dotted quad ("::ffff:127.0.0.1") occupies two groups.
      if (group.includes(".")) {
        const octets = group.split(".").map(Number);
        if (octets.length !== 4 || octets.some((o) => !Number.isInteger(o) || o < 0 || o > 255)) return [NaN];
        return [(octets[0]! << 8) | octets[1]!, (octets[2]! << 8) | octets[3]!];
      }
      return [parseInt(group, 16)];
    });
  };
  const left = parse(head ?? "");
  const right = tail === undefined ? [] : parse(tail);
  if ([...left, ...right].some((group) => !Number.isInteger(group) || group < 0 || group > 0xffff)) return null;
  if (tail === undefined) return left.length === 8 ? left : null;
  const fill = 8 - left.length - right.length;
  if (fill < 0) return null;
  return [...left, ...Array<number>(fill).fill(0), ...right];
}

const toDotted = (high: number, low: number) => `${high >> 8}.${high & 0xff}.${low >> 8}.${low & 0xff}`;

/**
 * IPv6 addresses that carry an IPv4 address inside them. Each of these reaches
 * an IPv4 destination, so each has to be classified as that IPv4 address —
 * this is the gap that let `::ffff:127.0.0.1` and `::ffff:169.254.169.254`
 * through the previous check.
 */
function embeddedIPv4(groups: number[]): string | null {
  const [g0, g1, g2, g3, g4, g5, g6, g7] = groups as [number, number, number, number, number, number, number, number];
  // ::ffff:a.b.c.d (IPv4-mapped) and ::a.b.c.d (deprecated IPv4-compatible).
  if (g0 === 0 && g1 === 0 && g2 === 0 && g3 === 0 && g4 === 0 && (g5 === 0xffff || g5 === 0)) {
    if (g6 === 0 && g7 <= 1) return null; // :: and ::1 are their own cases
    return toDotted(g6, g7);
  }
  // 2002::/16 — 6to4, the IPv4 address is the next 32 bits.
  if (g0 === 0x2002) return toDotted(g1, g2);
  // 64:ff9b::/96 — NAT64 well-known prefix.
  if (g0 === 0x0064 && g1 === 0xff9b && g2 === 0 && g3 === 0 && g4 === 0 && g5 === 0) return toDotted(g6, g7);
  return null;
}

/** IPv4 ranges that must never be fetched. */
function blockedIPv4Reason(address: string): string | null {
  const [a, b] = address.split(".").map(Number) as [number, number, number, number];
  if (a === 0) return "this network (0.0.0.0/8)";
  if (a === 10) return "private (10/8)";
  if (a === 100 && b >= 64 && b <= 127) return "carrier-grade NAT (100.64/10)";
  if (a === 127) return "loopback (127/8)";
  if (a === 169 && b === 254) return "link-local / cloud metadata (169.254/16)";
  if (a === 172 && b >= 16 && b <= 31) return "private (172.16/12)";
  if (a === 192 && b === 0) return "IETF protocol assignments (192.0.0/24)";
  if (a === 192 && b === 168) return "private (192.168/16)";
  if (a === 198 && (b === 18 || b === 19)) return "benchmarking (198.18/15)";
  if (a >= 224) return "multicast or reserved (224/4, 240/4)";
  return null;
}

function blockedIPv6Reason(address: string): string | null {
  const groups = expandIPv6(address);
  if (!groups) return "unparseable IPv6 address";

  const embedded = embeddedIPv4(groups);
  if (embedded) {
    const reason = blockedIPv4Reason(embedded);
    return reason ? `IPv4-in-IPv6 ${embedded}: ${reason}` : null;
  }

  const [g0] = groups as [number];
  if (groups.every((group) => group === 0)) return "unspecified (::)";
  if (groups.slice(0, 7).every((group) => group === 0) && groups[7] === 1) return "loopback (::1)";
  if ((g0 & 0xffc0) === 0xfe80) return "link-local (fe80::/10)";
  if ((g0 & 0xfe00) === 0xfc00) return "unique local (fc00::/7)";
  if ((g0 & 0xff00) === 0xff00) return "multicast (ff00::/8)";
  return null;
}

/** null when the address may be fetched, otherwise why it may not be. */
export function blockedAddressReason(address: string): string | null {
  if (isIPv4(address)) return blockedIPv4Reason(address);
  if (isIPv6(address)) return blockedIPv6Reason(address);
  return "unrecognised address"; // fail closed
}

/* ------------------------------------------------------------------ *
 * Configuration
 * ------------------------------------------------------------------ */

/**
 * Hosts allowed to resolve privately, for local development and the
 * end-to-end suite, which serves its own fixture page from 127.0.0.1.
 *
 * Refused outright in a production runtime, the same way email.config.ts
 * refuses a logged-only delivery mode there: a misconfigured environment
 * variable must not be able to reopen this. Read on each call rather than
 * memoised so a test can change it.
 */
export function allowedPrivateHosts(): Set<string> {
  const raw = (process.env.SSRF_ALLOW_PRIVATE_HOSTS ?? "").split(",").map((entry) => entry.trim().toLowerCase()).filter(Boolean);
  if (!raw.length) return new Set();

  // Fail closed. An earlier version only refused when isProductionRuntime()
  // was true, which is "not production" rather than "is development" — an
  // unset NODE_ENV, or a deployment whose environment is spelled something
  // other than "production", would have silently honoured the list. The
  // runtime now has to say in so many words that it is development or test.
  if (process.env.NODE_ENV !== "development" && process.env.NODE_ENV !== "test") {
    throw new Error(
      "SSRF_ALLOW_PRIVATE_HOSTS is only honoured when NODE_ENV is development or test; " +
        `it is ${process.env.NODE_ENV ? `"${process.env.NODE_ENV}"` : "unset"}.`
    );
  }
  // Belt and braces: a deployed environment that also claims to be a test one.
  if (isProductionRuntime()) throw new Error("SSRF_ALLOW_PRIVATE_HOSTS must not be set in production.");

  return new Set(raw);
}

/* ------------------------------------------------------------------ *
 * URL checking
 * ------------------------------------------------------------------ */

export type SsrfVerdict = { ok: true } | { ok: false; reason: string };

export async function assertPublicHttpUrl(rawUrl: string): Promise<SsrfVerdict> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return { ok: false, reason: "Invalid URL" };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, reason: `Disallowed protocol: ${url.protocol}` };
  }

  // WHATWG parsing already folds 127.1, 2130706433, 0x7f.0.0.1 and
  // 017700000001 into 127.0.0.1, so shorthand spellings arrive normalised.
  // Brackets around a literal IPv6 host are not part of the address.
  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!hostname) return { ok: false, reason: "URL has no host" };

  const allowed = allowedPrivateHosts();
  if (allowed.has(hostname)) return { ok: true };

  if (hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local")) {
    return { ok: false, reason: `Refusing to fetch ${hostname}` };
  }

  let addresses: string[];
  if (isIPv4(hostname) || isIPv6(hostname)) {
    addresses = [hostname];
  } else {
    try {
      // `all: true`: a hostname can publish several A/AAAA records, and a
      // single-address lookup leaves the others unchecked while the connection
      // may use any of them.
      addresses = (await lookup(hostname, { all: true })).map((entry) => entry.address);
    } catch {
      return { ok: false, reason: `DNS lookup failed for ${hostname}` };
    }
    if (!addresses.length) return { ok: false, reason: `No addresses for ${hostname}` };
  }

  for (const address of addresses) {
    const reason = blockedAddressReason(address);
    if (reason) return { ok: false, reason: `Refusing to fetch ${hostname} -> ${address}: ${reason}` };
  }
  return { ok: true };
}

/* ------------------------------------------------------------------ *
 * Fetching
 * ------------------------------------------------------------------ */

/**
 * `fetch` for user-supplied URLs.
 *
 * Redirects are followed by hand, with every hop re-checked. The default
 * `redirect: "follow"` would make the guard cosmetic: a public URL answering
 * `302 Location: http://169.254.169.254/` is the standard way around a
 * first-hop-only check.
 *
 * Known residual risk: DNS rebinding. The name is resolved here and resolved
 * again by the connection, so an authoritative server that answers differently
 * within that window can still steer the socket. Closing it means pinning the
 * resolved address onto the connection, which needs the request to go through
 * node:https with a custom `lookup` instead of fetch. That is a transport
 * change for every call site and is deliberately left to a follow-up.
 */
export type SafeFetchOptions = RequestInit & {
  /** Whole-operation budget, redirects included. */
  timeoutMs?: number;
  /** Largest body accepted, in bytes. */
  maxBytes?: number;
};

/** Headers that must not survive a redirect to a different origin. */
const SENSITIVE_HEADERS = ["authorization", "cookie", "proxy-authorization"];

function stripSensitiveHeaders(init: RequestInit): RequestInit {
  const headers = new Headers(init.headers);
  for (const name of SENSITIVE_HEADERS) headers.delete(name);
  return { ...init, headers };
}

/**
 * Reads at most `maxBytes` and hands back a Response the caller can still use
 * normally. Without this the body is whatever the far end decides to send:
 * every caller here goes straight to .text() or .arrayBuffer(), so a hostile
 * or merely broken source could spend the process's memory. politeFetch
 * already capped its reads; this brings the rest in line.
 */
async function withCappedBody(response: Response, maxBytes: number): Promise<Response> {
  // 204/205/304 must not carry a body; reconstructing one would throw.
  if (!response.body || [204, 205, 304].includes(response.status)) return response;

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      void reader.cancel();
      throw new SsrfBlockedError(`Response exceeded ${maxBytes} bytes`);
    }
    chunks.push(value);
  }
  return new Response(Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))), {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
}

/**
 * `fetch` for user-supplied URLs.
 *
 * Redirects are followed by hand, with every hop re-checked. The default
 * `redirect: "follow"` would make the guard cosmetic: a public URL answering
 * `302 Location: http://<internal address>/` is the standard way around a
 * first-hop-only check.
 *
 * The timeout is a budget for the whole call rather than per request, so a
 * chain of slow redirects cannot add up to five times the caller's limit.
 *
 * Known residual risk, documented in docs/SECURITY_SSRF_FOLLOWUP.md: DNS
 * rebinding. The name is resolved here and resolved again when the socket is
 * opened, so an authoritative server answering differently inside that window
 * can still steer the connection. The usual remedy — pinning the validated
 * address with an undici Agent passed as `dispatcher` — was measured against
 * this project's runtimes and does not work on Node 24, which is what
 * production runs, so it is deliberately not applied here.
 */
export async function safeFetch(rawUrl: string, options: SafeFetchOptions = {}): Promise<Response> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, maxBytes = DEFAULT_MAX_BYTES, ...init } = options;
  const deadline = Date.now() + timeoutMs;
  const origin = new URL(rawUrl).origin;

  let current = rawUrl;
  let requestInit = init;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const verdict = await assertPublicHttpUrl(current);
    if (!verdict.ok) throw new SsrfBlockedError(verdict.reason);

    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new SsrfBlockedError("Timed out before the request could be made");

    // A plain AbortController rather than AbortSignal.any: that helper needs
    // Node 20.3, and the deployed build's Node version is chosen by the
    // platform rather than declared in this repository. A security fix must
    // not quietly raise the runtime floor.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new Error("Timed out")), remaining);
    const onCallerAbort = () => controller.abort((init.signal as AbortSignal | undefined)?.reason);
    init.signal?.addEventListener("abort", onCallerAbort, { once: true });
    if (init.signal?.aborted) onCallerAbort();

    let response: Response;
    try {
      response = await fetch(current, { ...requestInit, redirect: "manual", signal: controller.signal });
    } finally {
      clearTimeout(timer);
      init.signal?.removeEventListener("abort", onCallerAbort);
    }

    if (response.status < 300 || response.status >= 400) return withCappedBody(response, maxBytes);

    const location = response.headers.get("location");
    if (!location) return withCappedBody(response, maxBytes);
    void response.body?.cancel();

    let next: URL;
    try {
      next = new URL(location, current);
    } catch {
      throw new SsrfBlockedError(`Redirect to an unparseable location from ${current}`);
    }
    // Credentials must not follow a redirect off the origin they were meant
    // for. No caller sends any today; this keeps that from becoming a leak
    // the first time one does.
    if (next.origin !== origin) requestInit = stripSensitiveHeaders(requestInit);
    current = next.toString();
  }

  throw new SsrfBlockedError(`Too many redirects (>${MAX_REDIRECTS})`);
}
