import { createHash } from "node:crypto";
import { normalizeUrl } from "./url-normalize";

/**
 * A fingerprint of the parts of a page that can actually change an event.
 *
 * The checker used to compare `sha256(rawHtml)`. Two fetches of the Osijek
 * cinema's weekly programme ten minutes apart produced the same 314 079 bytes
 * with different hashes — a nonce, a session token, a rotating advert — so
 * every check declared the page "changed", re-parsed all of it and queued
 * every event on it again. The extracted text of those same two fetches was
 * byte-identical (5 249 characters, both runs).
 *
 * So the fingerprint is taken over what the parser actually reads:
 *
 *  - the extracted, normalised text — the input the model is given, so any
 *    real change to a title, date, time, venue or price moves it;
 *  - the set of event sub-links — a detail page appearing or disappearing is
 *    a change even when the surrounding text is untouched;
 *  - the structured payloads (JSON-LD, embedded event JSON) in canonical
 *    form, so a site that renders nothing scrapeable is still watched, and a
 *    reordering of the same facts is not mistaken for a change.
 *
 * What it deliberately cannot see is a change made only on a detail page the
 * listing links to. `MonitoredSourcesService` covers that with a staleness
 * floor: a source is parsed in full at least every `FULL_PARSE_AFTER_DAYS`
 * days whatever the fingerprint says.
 */

/** Canonical JSON: object keys sorted, so key order is not a change. */
function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(",")}}`;
}

/**
 * The structured event data a page carries, in canonical form.
 *
 * Both shapes the parser understands are collected: schema.org JSON-LD and
 * the JSON payloads JS-rendered sites stream into the document. Parsing them
 * here rather than hashing the raw script bodies is what makes a re-serialised
 * but identical payload compare equal.
 */
export function structuredPayloads(html: string): string[] {
  const payloads: string[] = [];

  const ldRe = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = ldRe.exec(html)) !== null) {
    const body = match[1].trim();
    if (!body) continue;
    try {
      payloads.push(canonical(JSON.parse(body)));
    } catch {
      // Unparseable JSON-LD still counts as content: hash it as written, or a
      // site with broken markup would look unchanging forever.
      payloads.push(body.replace(/\s+/g, " "));
    }
  }

  // Next.js streams its payload as escaped JSON string chunks; the exact
  // chunk boundaries shift between builds, so the decoded string is what is
  // compared, not the chunks.
  const flightRe = /self\.__next_f\.push\(\[\d+,\s*"((?:\\.|[^"\\])*)"\]\)/g;
  let flight = "";
  while ((match = flightRe.exec(html)) !== null) {
    try {
      flight += JSON.parse(`"${match[1]}"`);
    } catch {
      /* a chunk that will not decode adds nothing to compare */
    }
  }
  if (flight) payloads.push(flight.replace(/\s+/g, " "));

  return payloads.sort();
}

/** The event sub-links a page offers, normalised and de-duplicated. */
export function linkFingerprintParts(links: string[], baseUrl: string): string[] {
  return [
    ...new Set(links.map((link) => normalizeUrl(link, baseUrl)).filter((u): u is string => u !== null)),
  ].sort();
}

/**
 * The fingerprint itself. `text` is the extracted page text the parser would
 * send to the model, `links` the raw sub-links it found.
 */
export function contentFingerprint(input: { text: string; links: string[]; html: string; baseUrl: string }): string {
  const parts = [
    "v1",
    input.text.trim(),
    linkFingerprintParts(input.links, input.baseUrl).join("\n"),
    structuredPayloads(input.html).join("\n"),
  ];
  return createHash("sha256").update(parts.join("\u0000")).digest("hex");
}
