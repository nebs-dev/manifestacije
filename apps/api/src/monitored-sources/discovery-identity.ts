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

/** The candidate's first term, as an instant, or null when it has none. */
function firstTerm(candidate: IdentifiableCandidate): Date | null {
  const first = candidate.occurrences?.length
    ? [...candidate.occurrences].sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))[0]?.startsAt
    : candidate.startsAt;
  if (!first) return null;
  const parsed = new Date(first);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
}

/** The day a candidate's first term falls on, in Zagreb — "" when undated. */
export function firstTermDateKey(candidate: IdentifiableCandidate): string {
  const term = firstTerm(candidate);
  return term ? zagrebDateKey(term) : "";
}

/**
 * The term a candidate is keyed on: the day, plus the time of day when the
 * source states one.
 *
 * The time has to be in the key. A cinema shows the same film twice on the
 * same day, and in this very backlog there are screenings that differ in
 * nothing but the hour — keying on the date alone would make the second
 * showing an alias of the first, and once an editor published one the other
 * would be skipped forever as "already imported". Hiding a real event is the
 * failure this whole mechanism must not have.
 *
 * Using the time is only safe because the term is read at extraction time,
 * before enrichment can overwrite it: parsing one stored page twice through
 * the real provider returned the same 40 instants both times, while two full
 * pipeline runs over the same page disagreed on 44 of them.
 */
export function termKey(candidate: IdentifiableCandidate): string {
  const term = firstTerm(candidate);
  if (!term) return "";
  const day = zagrebDateKey(term);
  // A midnight instant is how an all-day or time-less event is represented,
  // and appending "00:00" to it would be inventing precision the source did
  // not give.
  const iso = term.toISOString();
  const wall = `${iso.slice(11, 13)}:${iso.slice(14, 16)}`;
  if (candidate.isAllDay === true) return day;
  return wall === "00:00" ? day : `${day}T${wall}Z`;
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
  const term = termKey(candidate);
  const detailUrl = ownDetailUrl(candidate, listingUrl);

  // A detail URL is used only when the *extraction* produced it — structured
  // data (JSON-LD, embedded JSON) carries a real per-event URL, and that is
  // deterministic. It must never come from enrichment, which resolves a URL
  // for some candidates and not others depending on a fetch cap and the
  // network; `stampCandidates` is what guarantees that, by running first.
  if (detailUrl) return `${scope}|url|${detailUrl}|${term}`;

  const title = squash(candidate.title);
  if (!title) return null;
  if (!term) return null;

  return `${scope}|ev|${title}|${term}|${squash(candidate.city)}`;
}

/**
 * Hash of the facts an editor would act on, for telling a changed event from
 * an unchanged one.
 *
 * Two fields an earlier version hashed are deliberately absent. `description`
 * is model-written prose and `imageUrl` is whichever picture the image stage
 * happened to resolve; neither changes what the event *is*, and letting a
 * reworded sentence count as a change re-queues an event the editor has
 * already dealt with. The schedule, the place, the price and the ticket link
 * are what matter.
 *
 * Like the identity key, this is taken from the extraction snapshot, before
 * enrichment, geocoding and image verification get to rewrite fields — see
 * `stampCandidates`.
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
  ].join("\u0000");
  return createHash("sha256").update(payload).digest("hex");
}

/** What a stamped candidate carries from extraction through the pipeline. */
export type IdentityStamp = { _discoveryKey?: string; _discoveryHash: string };

/**
 * Stamps every candidate with its identity and content hash at the moment of
 * extraction — the one point in the pipeline where the data is deterministic.
 *
 * This is the fix for the defect that shipped in PR #4. Identity used to be
 * computed at the end of `processListingPage`, after `enrichThinCandidates`,
 * `verifyImages` and `fillMissingAddresses`. Those three stages fetch over the
 * network, are capped, and merge whatever they get back into the candidate
 * (`candidate.startsAt || detail.startsAt`, `detail.venueName || …`,
 * `sourceUrl: match`). Two production checks of one unchanged page therefore
 * produced candidates differing in `venueName` (every pair), `startsAt`,
 * `sourceUrl` and `imageUrl` — and so a different identity and a different
 * hash, which re-queued all 34 events both times.
 *
 * The model itself was not the problem: parsing the same stored page twice
 * through the real provider returned 40 candidates with identical titles,
 * dates and times both times. The network-dependent stages after it were.
 *
 * Stamping here makes those stages free to improve a card without being able
 * to change what event it is, or whether it counts as changed.
 */
export function stampCandidates<T extends IdentifiableCandidate>(
  candidates: T[],
  listingUrl: string,
  scope = discoveryScope(listingUrl),
): (T & IdentityStamp)[] {
  return candidates.map((candidate) => ({
    ...candidate,
    _discoveryKey: discoveryIdentityKey(candidate, listingUrl, scope) ?? undefined,
    _discoveryHash: discoveryContentHash(candidate),
  }));
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

  // Order matters, and an earlier version had it wrong: it tested the content
  // hash first, so any difference at all put the event back in the queue even
  // when an identical card was already sitting there unread. That is the
  // duplicate this whole mechanism exists to prevent, so the question "is an
  // editor already looking at this?" is asked first.
  const waiting = record.lastEventSourceId !== null && liveEventSourceIds.has(record.lastEventSourceId);
  const decided = record.importedEventId !== null || record.ignoredAt !== null;
  if (!decided && waiting) return { action: "skip", reason: "unchanged" };

  if (record.contentHash !== contentHash) {
    // A change to an event somebody already published is an update for a
    // human to apply, not a new event, and saying which is the difference
    // between a useful card and a duplicate.
    return { action: "queue", reason: record.importedEventId ? "changed-after-import" : "changed" };
  }

  if (record.importedEventId) return { action: "skip", reason: "imported" };
  if (record.ignoredAt) return { action: "skip", reason: "ignored" };

  // Undecided, unchanged, and the row that carried it is gone: nobody ever
  // judged this event, so it has to be put back in front of someone.
  return { action: "queue", reason: "orphaned" };
}
