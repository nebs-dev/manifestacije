import { lookup } from "node:dns/promises";
import { isIPv4, isIPv6 } from "node:net";

const USER_AGENT = "Manifestacije/1.0 event-ingestion-bot (+https://manifestacije.hr)";
const TIMEOUT_MS = 12_000;
const MAX_REDIRECTS = 5;
const MAX_BYTES = 5 * 1024 * 1024;

export type PoliteFetchResult =
  | { outcome: "not-modified"; httpStatus: 304 }
  | { outcome: "ok"; httpStatus: number; body: string; etag: string | null; lastModified: string | null; finalUrl: string }
  | { outcome: "error"; error: string; httpStatus?: number };

// Same fetch shape AdminService.parseUrl/.reparseSource already use (bot UA,
// 12s timeout), extended for unattended polling: conditional GET (skip parse
// entirely on 304), a size cap, and SSRF hardening — a scheduled job fetches
// stored URLs with no human choosing them per-request, so it needs the checks
// a human clicking "parse" implicitly provides.
export async function politeFetch(
  url: string,
  opts?: { etag?: string | null; lastModified?: string | null },
): Promise<PoliteFetchResult> {
  let currentUrl = url;

  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount++) {
    const guard = await assertPublicHttpUrl(currentUrl);
    if (!guard.ok) return { outcome: "error", error: guard.reason };

    let response: Response;
    try {
      const headers: Record<string, string> = { "User-Agent": USER_AGENT };
      if (opts?.etag) headers["If-None-Match"] = opts.etag;
      if (opts?.lastModified) headers["If-Modified-Since"] = opts.lastModified;
      response = await fetch(currentUrl, { headers, redirect: "manual", signal: AbortSignal.timeout(TIMEOUT_MS) });
    } catch (err) {
      return { outcome: "error", error: err instanceof Error ? err.message : String(err) };
    }

    if (response.status >= 300 && response.status < 400 && response.headers.get("location")) {
      currentUrl = new URL(response.headers.get("location")!, currentUrl).toString();
      continue;
    }

    if (response.status === 304) return { outcome: "not-modified", httpStatus: 304 };
    if (!response.ok) return { outcome: "error", error: `HTTP ${response.status}`, httpStatus: response.status };

    const body = await readCapped(response, MAX_BYTES);
    if (body === null) return { outcome: "error", error: `Response exceeded ${MAX_BYTES} bytes`, httpStatus: response.status };

    return {
      outcome: "ok",
      httpStatus: response.status,
      body,
      etag: response.headers.get("etag"),
      lastModified: response.headers.get("last-modified"),
      finalUrl: currentUrl,
    };
  }

  return { outcome: "error", error: `Too many redirects (>${MAX_REDIRECTS})` };
}

/**
 * Checks that an image URL actually serves an image right now.
 *
 * Listings routinely advertise images their own storage no longer holds — the
 * aggregator's page still looks fine because its image proxy is serving a
 * cached copy, so the dead link is invisible from the outside and would reach
 * the admin as a broken box. Only headers are read, never the body.
 */
export async function imageIsReachable(url: string): Promise<boolean> {
  const guard = await assertPublicHttpUrl(url);
  if (!guard.ok) return false;

  try {
    const response = await fetch(url, {
      // Some CDNs answer HEAD with 405 while serving GET fine; a one-byte
      // range keeps this as cheap as HEAD without tripping that.
      headers: { "User-Agent": USER_AGENT, Range: "bytes=0-0" },
      redirect: "follow",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok && response.status !== 206) return false;
    const type = response.headers.get("content-type") ?? "";
    void response.body?.cancel();
    return type.startsWith("image/");
  } catch {
    return false;
  }
}

async function readCapped(response: Response, maxBytes: number): Promise<string | null> {
  const reader = response.body?.getReader();
  if (!reader) return response.text();

  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      void reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks.map((c) => Buffer.from(c))).toString("utf-8");
}

async function assertPublicHttpUrl(rawUrl: string): Promise<{ ok: true } | { ok: false; reason: string }> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return { ok: false, reason: "Invalid URL" };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, reason: `Disallowed protocol: ${url.protocol}` };
  }

  const hostname = url.hostname.toLowerCase();
  if (hostname === "localhost" || hostname.endsWith(".localhost")) {
    return { ok: false, reason: "Refusing to fetch localhost" };
  }

  let address: string;
  if (isIPv4(hostname) || isIPv6(hostname)) {
    address = hostname;
  } else {
    try {
      address = (await lookup(hostname)).address;
    } catch {
      return { ok: false, reason: `DNS lookup failed for ${hostname}` };
    }
  }

  if (isPrivateAddress(address)) {
    return { ok: false, reason: `Refusing to fetch private/internal address ${address}` };
  }
  return { ok: true };
}

function isPrivateAddress(address: string): boolean {
  if (isIPv4(address)) {
    const [a, b] = address.split(".").map(Number);
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    return false;
  }
  if (isIPv6(address)) {
    const normalized = address.toLowerCase();
    if (normalized === "::1") return true;
    if (normalized.startsWith("fe80:")) return true;
    if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true; // fc00::/7 (ULA)
    return false;
  }
  return true; // unrecognized shape — fail closed
}
