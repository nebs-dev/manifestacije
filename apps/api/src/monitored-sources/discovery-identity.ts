import { createHash } from "node:crypto";
import { normalizeDuplicateText } from "../duplicates/duplicate-matching";
import { zagrebDateKey } from "../common/zagreb-time";
import { normalizeUrl } from "./url-normalize";

/**
 * Identity for a discovered event, so one real event is extracted and queued
 * once instead of once per re-check.
 *
 * The page hash the checker already keeps is all-or-nothing: one changed byte
 * anywhere re-parses the whole listing and queues every event on it again. In
 * production that made 3 179 candidate cards out of 748 distinct events — the
 * same comedy was queued 40 times across 31 review rows. What is missing is an
 * identity per *event*, which is what this module computes.
 *
 * Three rules shape it, and each one exists to avoid losing a real event:
 *
 *  - **Scope is the source's host, not its row id.** A MonitoredSource is hard
 *    deleted and `DiscoveredSourceItem` cascades with it, so deleting a source
 *    used to erase the memory of everything it had ever found; re-adding it
 *    rediscovered the lot. A host string survives the delete and the re-add.
 *  - **The date is part of the key.** A weekly programme lists the same title
 *    on four nights, and those are four events. Two candidates only share an
 *    identity when they share a term.
 *  - **No date or no title means no identity.** 710 of those production
 *    candidates had no `startsAt` and 84 no title. Guessing an identity for
 *    them would merge events that merely read alike, so they are queued every
 *    time instead. Over-queueing costs a click; a wrong merge loses an event.
 */

export type IdentifiableCandidate = {
  title?: string;
  startsAt?: string;
  endsAt?: string;
  isAllDay?: boolean;
  occurrences?: { startsAt: string; endsAt?: string | null; isAllDay?: boolean }[];
  venueName?: string;
  address?: string;
  city?: string;
  category?: string;
  isFree?: boolean | null;
  priceText?: string;
  ticketUrl?: string;
  description?: string;
  imageUrl?: string;
  sourceUrl?: string;
};

/** The host a source's events are scoped to — stable across delete/re-add. */
export function discoveryScope(sourceUrl: string): string {
  try {
    return new URL(sourceUrl).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return sourceUrl.trim().toLowerCase();
  }
}

const squash = (value: string | undefined | null) => normalizeDuplicateText(value ?? "").replace(/\s+/g, " ").trim();

/**
 * Title reduced to a comparable form, stored alongside the identity.
 *
 * The identity key contains the event's term, which is what keeps four nights
 * of one play apart — but it also means a postponed event arrives with a brand
 * new key and no visible connection to the one already published. This key is
 * how that connection is found again: same host, same title, same city, other
 * date. Empty for a titleless candidate, which is then never matched.
 */
export function discoveryTitleKey(title: string | undefined | null): string {
  return squash(title);
}

/** The day a candidate's first term falls on, in Zagreb — "" when undated. */
export function firstTermDateKey(candidate: IdentifiableCandidate): string {
  const first = candidate.occurrences?.length
    ? [...candidate.occurrences].sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))[0]?.startsAt
    : candidate.startsAt;
  if (!first) return "";
  const parsed = new Date(first);
  return Number.isFinite(parsed.getTime()) ? zagrebDateKey(parsed) : "";
}

/**
 * The candidate's own detail page, when the listing gave it one. Mirrors
 * `MonitoredSourcesService.ownDetailUrl`: a same-page anchor or the listing
 * URL itself is not a detail page and must not key anything.
 */
function ownDetailUrl(candidate: IdentifiableCandidate, listingUrl: string): string | null {
  if (!candidate.sourceUrl) return null;
  const normalized = normalizeUrl(candidate.sourceUrl, listingUrl);
  if (!normalized) return null;
  // Both sides go through normalizeUrl: comparing a normalized candidate URL
  // against a raw listing URL made "…/tjedni-pregled" and "…/tjedni-pregled/"
  // look like different pages, and the listing then keyed itself as the detail
  // page of its own first event.
  const normalizedListing = normalizeUrl(listingUrl, listingUrl);
  if (!normalizedListing) return normalized;
  try {
    const own = new URL(normalized);
    const listing = new URL(normalizedListing);
    if (own.origin === listing.origin && own.pathname === listing.pathname) return null;
  } catch {
    /* an unparseable listing URL leaves the candidate's own URL standing */
  }
  return normalized;
}

/**
 * A stable key for one event from one host, or null when the candidate carries
 * too little to be identified — which means "queue it, every time".
 */
export function discoveryIdentityKey(
  candidate: IdentifiableCandidate,
  listingUrl: string,
  scope = discoveryScope(listingUrl),
): string | null {
  const dateKey = firstTermDateKey(candidate);
  const detailUrl = ownDetailUrl(candidate, listingUrl);

  // A detail URL is the strongest signal available, but it still cannot stand
  // alone: one page may announce several terms, and those are several events.
  if (detailUrl) return `${scope}|url|${detailUrl}|${dateKey}`;

  const title = squash(candidate.title);
  if (!title) return null;
  if (!dateKey) return null;

  return `${scope}|ev|${title}|${dateKey}|${squash(candidate.city)}`;
}

/**
 * Hash of the fields an editor would act on. Deliberately field-by-field and
 * in a fixed order: `JSON.stringify` over the whole candidate would fold in
 * `_status`, warnings, confidence and parser bookkeeping, and every one of
 * those wobbles between runs — which would report "changed" forever and undo
 * the deduplication.
 */
export function discoveryContentHash(candidate: IdentifiableCandidate): string {
  const terms = (candidate.occurrences ?? [])
    .map((occurrence) => [occurrence.startsAt, occurrence.endsAt ?? "", occurrence.isAllDay === true].join("~"))
    .sort();
  const payload = [
    squash(candidate.title),
    candidate.startsAt ?? "",
    candidate.endsAt ?? "",
    candidate.isAllDay === true ? "1" : "0",
    terms.join(";"),
    squash(candidate.venueName),
    squash(candidate.address),
    squash(candidate.city),
    candidate.category ?? "",
    candidate.isFree === null || candidate.isFree === undefined ? "" : String(candidate.isFree),
    (candidate.priceText ?? "").trim(),
    (candidate.ticketUrl ?? "").trim(),
    (candidate.description ?? "").replace(/\s+/g, " ").trim(),
    (candidate.imageUrl ?? "").trim(),
  ].join("\u0000");
  return createHash("sha256").update(payload).digest("hex");
}

/** What is already on record for one identity key. */
export type DiscoveryRecord = {
  identityKey: string;
  contentHash: string;
  importedEventId: number | null;
  ignoredAt: Date | null;
  lastEventSourceId: number | null;
};

export type DiscoveryDecision =
  | { action: "queue"; reason: "new" | "changed" | "changed-after-import" | "orphaned" | "unkeyed" }
  | { action: "skip"; reason: "unchanged" | "imported" | "ignored" };

/**
 * Whether a freshly parsed candidate belongs in the review queue.
 *
 * `liveEventSourceIds` is the set of review rows that still exist. A candidate
 * whose only row has been deleted has to be queued again even though nothing
 * about it changed — otherwise deleting a row would silently retire an event
 * nobody ever decided on.
 */
export function decideDiscovery(
  identityKey: string | null,
  contentHash: string,
  record: DiscoveryRecord | undefined,
  liveEventSourceIds: ReadonlySet<number>,
): DiscoveryDecision {
  if (!identityKey) return { action: "queue", reason: "unkeyed" };
  if (!record) return { action: "queue", reason: "new" };

  if (record.contentHash !== contentHash) {
    // The source changed its mind about an event that is already published.
    // That is an update for a human to apply, not a new event, and saying so
    // is the difference between a useful card and a duplicate.
    return { action: "queue", reason: record.importedEventId ? "changed-after-import" : "changed" };
  }

  if (record.importedEventId) return { action: "skip", reason: "imported" };
  if (record.ignoredAt) return { action: "skip", reason: "ignored" };
  if (record.lastEventSourceId && liveEventSourceIds.has(record.lastEventSourceId)) {
    return { action: "skip", reason: "unchanged" };
  }
  return { action: "queue", reason: "orphaned" };
}
