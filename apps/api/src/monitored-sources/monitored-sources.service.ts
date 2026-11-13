import { candidateNeedsReview } from "../ai-parser/date-evidence";
import { createHash } from "node:crypto";
import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { DiscoveredEvent, DiscoveredItemStatus, EventSourceType, MonitoredSourceCheckStatus, MonitoredSourceType } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AiEventParserService, ListingParseStats, ParsedEventCandidate, ParsedSourceResult } from "../ai-parser/ai-event-parser.service";
import { DuplicatesService } from "../duplicates/duplicates.service";
import { dropPastCandidates, flagAlreadyImported } from "../ai-parser/candidate-filters";
import { imageIsReachable, politeFetch } from "./source-fetch";
import { lookupVenueGeo } from "../common/croatia-geo";
import { zagrebDateKey } from "../common/zagreb-time";
import { normalizeUrl } from "./url-normalize";
import { decideDiscovery, discoveryScope, discoveryTitleKey, stampCandidates } from "./discovery-identity";
import { contentFingerprint } from "./content-fingerprint";

/** Two names for the same place, allowing for casing and diacritics. */
const squashedEqual = (a: string | null | undefined, b: string | null | undefined) =>
  discoveryTitleKey(a) === discoveryTitleKey(b);

/**
 * "This event, at this exact time, in this town, from this site" — the handle
 * used to carry an editor's decision across a change in how identity keys are
 * built.
 *
 * The term is matched exactly, not by day. Matching by day looked tempting
 * and is wrong: a cinema shows the same film twice in an evening, so a
 * decision taken on the 18:00 screening would silently swallow the 20:00 one,
 * and a source that moves an event by an hour would never be able to tell
 * anybody. Exact-term matching bridges the only difference this is meant to
 * bridge — the shape of the key — and nothing else.
 */
const termIdentity = (scope: string, titleKey: string, city: string | null | undefined, startsAt: string | null | undefined) => {
  const instant = startsAt ? new Date(startsAt) : null;
  const term = instant && Number.isFinite(instant.getTime()) ? instant.toISOString() : "";
  return `${scope}|${titleKey}|${discoveryTitleKey(city)}|${term}`;
};
import { CreateMonitoredSourceDto, UpdateMonitoredSourceDto } from "./monitored-sources.dto";

const MAX_CONSECUTIVE_FAILURES_BEFORE_DISABLE = 10;
const MAX_BACKOFF_MULTIPLIER = 8;
const STALE_LOCK_MINUTES = 60;
// Run at most this many checks concurrently per cron tick — keeps outbound
// fetches spread out instead of hammering several domains at once.
const CHECK_CONCURRENCY = 3;
// Caps extra per-candidate detail-page fetches during enrichment (§9/§18 of
// the design doc) — one check stays a bounded, polite number of requests.
// Sized to cover a whole listing page rather than part of it: a typical page
// yields ~18-20 events, and stopping at 10 meant the tail never got its
// detail fetch, which is where the street address lives on most sites.
// Checks are daily per source, so this is ~20 requests/day/site.
const MAX_ENRICH_FETCHES = 20;
// Caps AJAX-paginated listing fetches per check — same politeness reasoning
// as the other MAX_* caps, applied to a source's own "page=N" pagination.
const MAX_AJAX_PAGES = 5;
// Caps geocoder lookups per check. Distinct venues per listing are far fewer
// than candidates (the same hall hosts many events), so this is generous.
const MAX_GEOCODE_LOOKUPS = 25;
// How long a source may go without a full parse while its fingerprint keeps
// matching. The fingerprint reads the listing only, so a change made on a
// linked detail page is invisible to it; this bounds how long such a change
// can stay hidden. Checks are daily at the default interval, so this is one
// full parse a week for a page that never changes.
const FULL_PARSE_AFTER_DAYS = 7;

const STOPWORDS = new Set([
  "za", "od", "do", "na", "sa", "iz", "kod", "pod", "nad", "pri", "bez",
  "kroz", "prema", "the", "and", "in", "of", "at", "on", "to",
]);

function sha256(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

@Injectable()
export class MonitoredSourcesService {
  private readonly logger = new Logger(MonitoredSourcesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly parser: AiEventParserService,
    private readonly duplicates: DuplicatesService,
  ) {}

  list() {
    return this.prisma.monitoredSource.findMany({
      include: { organizer: true },
      orderBy: { nextCheckAt: "asc" },
    });
  }

  async get(id: number) {
    const source = await this.prisma.monitoredSource.findUnique({ where: { id }, include: { organizer: true } });
    if (!source) throw new NotFoundException("Monitored source not found");
    return source;
  }

  /** Recent check runs for one source — the run log an admin needs to see
   *  *why* a source is failing, not just that it is (§16 of the design doc). */
  runs(id: number, take = 20) {
    return this.prisma.ingestionJob.findMany({
      where: { type: "SOURCE_CHECK", payload: { path: ["monitoredSourceId"], equals: id } },
      orderBy: { createdAt: "desc" },
      take,
    });
  }

  create(dto: CreateMonitoredSourceDto) {
    return this.prisma.monitoredSource.create({
      data: {
        name: dto.name.trim(),
        url: dto.url.trim(),
        sourceType: dto.sourceType,
        organizerId: dto.organizerId,
        checkIntervalMinutes: dto.checkIntervalMinutes ?? 1440,
        nextCheckAt: new Date(),
      },
    });
  }

  async update(id: number, dto: UpdateMonitoredSourceDto) {
    await this.get(id);
    return this.prisma.monitoredSource.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        url: dto.url?.trim(),
        sourceType: dto.sourceType,
        organizerId: dto.organizerId,
        checkIntervalMinutes: dto.checkIntervalMinutes,
        isActive: dto.isActive,
      },
    });
  }

  async delete(id: number) {
    await this.get(id);
    return this.prisma.monitoredSource.delete({ where: { id } });
  }

  /** Admin "Run now" — bypasses `nextCheckAt`/lock reuse concerns of the cron
   *  batch and checks a single source immediately, still going through the
   *  same claim/release lock so it can't race a concurrently running cron tick. */
  async runNow(id: number) {
    await this.get(id);
    const claimed = await this.claim(id);
    if (!claimed) throw new NotFoundException("Source is already being checked");
    return this.checkClaimedSource(claimed);
  }

  // Cron entrypoint — every 5 minutes, pick up whatever is due. The interval
  // granularity lives on each MonitoredSource (checkIntervalMinutes), not here;
  // this tick just decides "is anything due right now."
  @Cron(CronExpression.EVERY_5_MINUTES)
  async runDueChecks() {
    const due = await this.dueSources();
    if (due.length === 0) return;
    this.logger.log(`${due.length} monitored source(s) due for check`);

    for (let i = 0; i < due.length; i += CHECK_CONCURRENCY) {
      const batch = due.slice(i, i + CHECK_CONCURRENCY);
      await Promise.all(
        batch.map(async (source) => {
          const claimed = await this.claim(source.id);
          if (!claimed) return; // lost the claim race to another process
          try {
            await this.checkClaimedSource(claimed);
          } catch (err) {
            this.logger.error(`Unhandled error checking source ${source.id}`, err instanceof Error ? err.stack : String(err));
          }
        }),
      );
    }
  }

  private async dueSources() {
    const now = new Date();
    const staleThreshold = new Date(now.getTime() - STALE_LOCK_MINUTES * 60_000);
    return this.prisma.monitoredSource.findMany({
      where: {
        isActive: true,
        nextCheckAt: { lte: now },
        OR: [{ checkingSince: null }, { checkingSince: { lt: staleThreshold } }],
      },
      orderBy: { nextCheckAt: "asc" },
    });
  }

  /** Atomic claim — the actual overlap-prevention mechanism (§7 of the design
   *  doc). Returns the freshly-claimed row, or null if another process already
   *  has it (lost the race between the due-query and this update). */
  private async claim(id: number) {
    const staleThreshold = new Date(Date.now() - STALE_LOCK_MINUTES * 60_000);
    const result = await this.prisma.monitoredSource.updateMany({
      where: { id, OR: [{ checkingSince: null }, { checkingSince: { lt: staleThreshold } }] },
      data: { checkingSince: new Date() },
    });
    if (result.count !== 1) return null;
    return this.prisma.monitoredSource.findUniqueOrThrow({ where: { id } });
  }

  private async checkClaimedSource(source: NonNullable<Awaited<ReturnType<MonitoredSourcesService["claim"]>>>) {
    const job = await this.prisma.ingestionJob.create({
      data: { type: "SOURCE_CHECK", status: "RUNNING", payload: { monitoredSourceId: source.id, sourceType: source.sourceType, url: source.url } },
    });

    try {
      const result = await politeFetch(source.url, { etag: source.etag, lastModified: source.lastModified });

      if (result.outcome === "error") {
        await this.recordFailure(source.id, result.error, "httpStatus" in result ? result.httpStatus : undefined);
        await this.prisma.ingestionJob.update({ where: { id: job.id }, data: { status: "FAILED", error: result.error } });
        return;
      }

      if (result.outcome === "not-modified") {
        await this.recordSuccess(source.id, { status: "UNCHANGED", httpStatus: 304 });
        await this.prisma.ingestionJob.update({ where: { id: job.id }, data: { status: "DONE", result: { outcome: "not-modified" } } });
        return;
      }

      const html = await this.collectHtml(source.url, result.body);
      const contentHash = sha256(html);
      const fingerprint = this.fingerprintOf(source.url, html);

      // A fingerprint over the page's readable content, its event links and
      // its structured payloads, rather than over the raw bytes. Two fetches
      // of the same cinema programme ten minutes apart differed only in a
      // nonce, which the byte hash read as "changed" and which cost a full
      // re-parse and 34 duplicate review cards, twice.
      //
      // The staleness floor is the price of that: a change made only on a
      // detail page moves nothing on the listing, so a source is parsed in
      // full at least every FULL_PARSE_AFTER_DAYS days regardless.
      const stale = !source.lastFullParseAt
        || Date.now() - source.lastFullParseAt.getTime() > FULL_PARSE_AFTER_DAYS * 86_400_000;
      if (fingerprint === source.contentFingerprint && !stale) {
        await this.recordSuccess(source.id, { status: "UNCHANGED", httpStatus: result.httpStatus, etag: result.etag, lastModified: result.lastModified, contentHash, fingerprint });
        await this.prisma.ingestionJob.update({ where: { id: job.id }, data: { status: "DONE", result: { outcome: "unchanged", reason: "fingerprint" } } });
        return;
      }

      const outcome = source.sourceType === MonitoredSourceType.LISTING_PAGE
        ? await this.processListingPage(source, html)
        : await this.processEventPage(source, html);

      await this.recordSuccess(source.id, { status: "OK", httpStatus: result.httpStatus, etag: result.etag, lastModified: result.lastModified, contentHash, fingerprint, fullParse: true });
      await this.prisma.ingestionJob.update({ where: { id: job.id }, data: { status: "DONE", result: outcome } });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await this.recordFailure(source.id, message);
      await this.prisma.ingestionJob.update({ where: { id: job.id }, data: { status: "FAILED", error: message } }).catch(() => undefined);
    } finally {
      await this.prisma.monitoredSource.update({ where: { id: source.id }, data: { checkingSince: null } });
    }
  }

  /** Many listing pages (WordPress "WP Event Manager" and similar grid
   *  plugins in particular) render only a skeleton server-side and load the
   *  actual event cards via a JS call to a JSON AJAX endpoint after the page
   *  loads — invisible to a plain HTTP fetch of the page URL. When a
   *  MonitoredSource is pointed at that AJAX endpoint directly instead (a
   *  URL an admin can find via the site's own network requests), the
   *  response is `{ html: "...", max_num_pages: N, ... }` rather than a raw
   *  page — unwrap it, and if the source URL has its own "page" query param
   *  and the endpoint reports more pages, fetch those too (capped) and
   *  concatenate, so the existing link-extraction/parsing code sees the full
   *  listing regardless of how many AJAX pages it's split across. */
  private async collectHtml(sourceUrl: string, firstBody: string): Promise<string> {
    const trimmed = firstBody.trim();
    if (!trimmed.startsWith("{")) {
      const expanded = await this.expandAjaxListing(sourceUrl, firstBody);
      return expanded ?? firstBody;
    }

    let data: { html?: unknown; max_num_pages?: unknown };
    try {
      data = JSON.parse(trimmed);
    } catch {
      return firstBody;
    }
    if (typeof data.html !== "string") return firstBody;

    const pages = [data.html];
    let url: URL;
    try {
      url = new URL(sourceUrl);
    } catch {
      return pages.join("\n\n---\n\n");
    }
    if (!url.searchParams.has("page")) return pages.join("\n\n---\n\n");

    const maxPages = Math.min(Number(data.max_num_pages) || 1, MAX_AJAX_PAGES);
    for (let page = 2; page <= maxPages; page++) {
      url.searchParams.set("page", String(page));
      const result = await politeFetch(url.toString());
      if (result.outcome !== "ok") break;
      try {
        const pageData = JSON.parse(result.body.trim()) as { html?: unknown };
        if (typeof pageData.html === "string") pages.push(pageData.html);
        else break;
      } catch {
        break;
      }
    }
    return pages.join("\n\n---\n\n");
  }

  /** The same "the listing is a JS-filled shell" problem as above, but from
   *  the admin's side of it: they point a MonitoredSource at the human-facing
   *  listing URL (the one they can actually see in a browser) rather than at
   *  an AJAX endpoint they'd have to dig out of devtools. WP Event Manager —
   *  common on Croatian tourist-board sites — leaves the query it's about to
   *  run in the container's data-* attributes, so the endpoint can be
   *  reconstructed from the shell itself rather than configured per site. */
  private async expandAjaxListing(sourceUrl: string, html: string): Promise<string | null> {
    const container = html.match(/<div[^>]*\bclass=["'][^"']*\bevent_listings\b[^"']*["'][^>]*>/i);
    if (!container) return null;

    let endpoint: URL;
    try {
      endpoint = new URL("/wp-admin/admin-ajax.php", sourceUrl);
    } catch {
      return null;
    }
    endpoint.searchParams.set("action", "event_manager_get_listings");
    for (const [, key, value] of container[0].matchAll(/\bdata-([a-z_]+)=["']([^"']*)["']/gi)) {
      if (value) endpoint.searchParams.set(key, value);
    }

    const pages: string[] = [];
    let maxPages = 1;
    for (let page = 1; page <= Math.min(maxPages, MAX_AJAX_PAGES); page++) {
      endpoint.searchParams.set("page", String(page));
      const result = await politeFetch(endpoint.toString());
      if (result.outcome !== "ok") break;
      let data: { html?: unknown; max_num_pages?: unknown };
      try {
        data = JSON.parse(result.body.trim());
      } catch {
        break;
      }
      if (typeof data.html !== "string") break;
      pages.push(data.html);
      if (page === 1) maxPages = Math.max(Number(data.max_num_pages) || 1, 1);
    }

    return pages.length > 0 ? pages.join("\n\n---\n\n") : null;
  }

  private async processListingPage(source: { id: number; url: string }, html: string) {
    const links = this.parser.extractEventSubLinks(html, source.url);
    const normalized = [...new Set(links.map((link) => normalizeUrl(link, source.url)).filter((u): u is string => u !== null))];
    // Enrichment matches one already-known candidate to its own detail-page
    // link — it doesn't need "is this a repeated listing pattern" (the
    // grouped `links` above), just "does any link on the page match this
    // title," so use the full unfiltered set (see extractAllPageLinks' doc).
    const allPageLinks = this.parser.extractAllPageLinks(html, source.url);

    let newCount = 0;
    for (const normalizedUrl of normalized) {
      const upserted = await this.prisma.discoveredSourceItem.upsert({
        where: { monitoredSourceId_normalizedUrl: { monitoredSourceId: source.id, normalizedUrl } },
        update: { lastSeenAt: new Date() },
        create: { monitoredSourceId: source.id, normalizedUrl, sourceUrl: normalizedUrl, status: DiscoveredItemStatus.NEW },
      });
      if (upserted.status === DiscoveredItemStatus.NEW && upserted.createdAt.getTime() === upserted.updatedAt.getTime()) newCount++;
    }

    // Try the page's own content first — many listing/calendar pages (e.g. a
    // tourist board's "kalendar manifestacija") already list full event
    // details inline as plain text rather than linking out to separate
    // per-event pages. Crawling sub-links is only worth the extra fetches
    // and a second LLM call when the page itself turns out to be a thin
    // directory of teasers with nothing real on it.
    // JS-rendered sites embed their full event data as JSON in the page and
    // render nothing scrapeable, and schema.org markup states the same facts
    // structurally — either beats anything an LLM can recover from the
    // rendered shell, and costs no LLM call.
    // The page's own structured data costs no model call and states the facts
    // the model would otherwise have to re-derive, so it still goes first. Only
    // when neither is present does the text get read, and then by window: a
    // long listing does not fit in one call, and a blind prefix of it read the
    // wrong third of a month calendar (see `listing-windows.ts`).
    let listing: ListingParseStats | null = null;
    let parsed = this.parser.extractEmbeddedEvents(html, source.url)
      ?? this.parser.extractJsonLdEvents(html, source.url);
    if (!parsed) {
      const read = await this.parser.parseListingWithLlm({ rawHtml: html, sourceUrl: source.url });
      parsed = read.result;
      listing = read.stats;
    }
    if (parsed.candidates.length === 0 && normalized.length >= 3) {
      const crawl = await this.parser.crawlListingSubPages(html, source.url);
      if (crawl.subTexts.length > 0) {
        parsed = await this.parser.parseBatchWithLlm({ rawText: crawl.subTexts.join("\n\n---\n\n"), sourceUrl: source.url });
      }
    }

    // Identity and change-detection are stamped HERE, on the extraction, and
    // never recomputed. Everything below this line fetches over the network,
    // is capped, and merges what it gets back into the candidate — so letting
    // any of it influence identity is what made two checks of one unchanged
    // page queue all 34 events twice.
    parsed = { ...parsed, candidates: stampCandidates(parsed.candidates, parsed.sourceUrl || source.url) };

    // A summary/calendar listing often gives only a title + rough date —
    // the real description/image/precise date usually live on that event's
    // own article page. Match thin candidates to a same-page link by title
    // word overlap and re-parse that page to fill in the gaps, capped like
    // crawlListingSubPages so this stays a bounded, polite number of extra
    // fetches per check rather than one per candidate.
    parsed = await this.enrichThinCandidates(source.id, parsed, allPageLinks);
    parsed = dropPastCandidates(parsed);
    parsed = this.stripGenericImages(parsed);
    parsed = await this.verifyImages(parsed, source.url);
    parsed = await this.fillMissingAddresses(parsed);
    parsed = await flagAlreadyImported(this.prisma, this.duplicates, parsed);

    // Everything the page offered is now parsed. Which of it an editor has
    // not already seen is a separate question, and the one that decides how
    // big the review queue gets.
    const triage = await this.triageByIdentity(source, parsed);

    // Only create a review-queue row when there's actually something to
    // review — a zero-candidate result, or one where every event is already
    // on record unchanged, just means "checked, nothing new" and belongs in
    // this source's own run log, not in the shared admin Izvori queue where
    // it'd be one more row to click through.
    const eventSource = triage.queued.candidates.length > 0
      ? await this.createDiscoverySource(source, html, triage.queued)
      : null;
    await this.recordDiscoveredEvents(source, triage, eventSource?.id);
    await this.prisma.discoveredSourceItem.updateMany({
      where: { monitoredSourceId: source.id, normalizedUrl: { in: normalized } },
      data: { status: DiscoveredItemStatus.PROCESSED, linkedEventSourceId: eventSource?.id },
    });

    return {
      outcome: "changed",
      itemsFound: normalized.length,
      itemsNew: newCount,
      candidatesFound: parsed.candidates.length,
      candidatesCreated: triage.queued.candidates.length,
      candidatesSkipped: parsed.candidates.length - triage.queued.candidates.length,
      skipReasons: triage.skipReasons,
      eventSourceId: eventSource?.id,
      // Null whenever the page's own structured data answered and no model
      // call was needed at all.
      listing,
    };
  }

  /**
   * Splits a fresh parse into "an editor needs to see this" and "already on
   * record", using the per-event identity in discovery-identity.ts.
   *
   * This is the deduplication. Without it one changed byte on a listing page
   * re-queues every event on that page: production accumulated 3 179 candidate
   * cards for 748 distinct events, 40 cards for one comedy. The identity is
   * deliberately conservative — an undated or untitled candidate gets no key
   * and is queued every time, because over-queueing costs a click and a wrong
   * merge loses an event.
   */
  /**
   * The fingerprint of a fetched page, built from what the parser reads.
   *
   * Kept next to the check so the listing path and the event-page path cannot
   * drift apart: both gate on exactly the text, links and structured payloads
   * that decide what candidates come out.
   */
  private fingerprintOf(sourceUrl: string, html: string): string {
    const text = this.parser.textForFingerprint(html);
    const links = this.parser.extractEventSubLinks(html, sourceUrl);
    return contentFingerprint({ text, links, html, baseUrl: sourceUrl });
  }

  /**
   * Decided identities for the days this extraction covers, indexed by what
   * the event is rather than by its key.
   *
   * Only `importedEventId`/`ignoredAt` rows are loaded: this exists to keep
   * an editor's decision working across a change in how keys are built, not
   * to deduplicate on a looser rule than the key itself.
   */
  private async decidedByDay(scope: string, assessed: { titleKey: string; candidate: { city?: string; startsAt?: string } }[]) {
    const titleKeys = [...new Set(assessed.map((item) => item.titleKey).filter(Boolean))];
    if (!titleKeys.length) return new Map<string, DiscoveredEvent>();

    const rows = await this.prisma.discoveredEvent.findMany({
      where: {
        sourceScope: scope,
        titleKey: { in: titleKeys },
        OR: [{ importedEventId: { not: null } }, { ignoredAt: { not: null } }],
      },
      take: 500,
    });

    const index = new Map<string, DiscoveredEvent>();
    for (const row of rows) {
      const key = termIdentity(scope, row.titleKey, row.cityName, row.startsAt?.toISOString());
      // An imported decision outranks an ignored one for the same term: the
      // event exists on the site, so "already published" is the truer answer.
      const held = index.get(key);
      if (!held || (!held.importedEventId && row.importedEventId)) index.set(key, row);
    }
    return index;
  }

  private async triageByIdentity(source: { id: number; url: string }, parsed: ParsedSourceResult) {
    const scope = discoveryScope(source.url);
    // Read off the stamp rather than recomputed: by the time triage runs, the
    // candidate has been through enrichment, geocoding and image verification,
    // and its startsAt, venueName, sourceUrl and imageUrl may all have moved.
    // `stampCandidates` is called on the extraction, before any of that.
    const assessed = parsed.candidates.map((candidate) => {
      const stamped = candidate as typeof candidate & { _discoveryKey?: string; _discoveryHash?: string };
      if (stamped._discoveryHash === undefined) {
        throw new Error("Candidate reached triage without an identity stamp — stampCandidates must run on the extraction");
      }
      return {
        candidate,
        identityKey: stamped._discoveryKey ?? null,
        titleKey: discoveryTitleKey(candidate.title),
        contentHash: stamped._discoveryHash,
      };
    });

    const keys = assessed.map((item) => item.identityKey).filter((key): key is string => key !== null);
    // Keys are computed from the extraction; the 1 260 identities seeded from
    // the historical backlog were computed from candidates that had already
    // been through enrichment, so some of them carry a different key for the
    // same event. Where that happens the key lookup misses and the event
    // would be offered again — including the 43 an editor has published and
    // the 69 they rejected.
    //
    // So a decided identity is also findable by what it is rather than by its
    // key: same host, same title, same city, same day. Deliberately limited
    // to decided rows — an undecided one being offered once more costs a
    // click, while re-offering a rejected event wastes the decision.
    const decidedFallbacks = await this.decidedByDay(scope, assessed);
    const records = keys.length
      ? await this.prisma.discoveredEvent.findMany({ where: { identityKey: { in: keys } } })
      : [];
    const byKey = new Map(records.map((record) => [record.identityKey, record]));
    for (const item of assessed) {
      if (!item.identityKey || byKey.has(item.identityKey)) continue;
      const fallback = decidedFallbacks.get(termIdentity(scope, item.titleKey, item.candidate.city, item.candidate.startsAt));
      // Adopt the decision under the key this run computed, so the next check
      // finds it directly and the fallback is needed once, not forever.
      if (fallback) byKey.set(item.identityKey, { ...fallback, identityKey: item.identityKey, contentHash: item.contentHash });
    }

    // A record pointing at a review row that has since been deleted must not
    // keep its event out of the queue — nobody ever decided on it.
    const referenced = [...new Set(records.map((record) => record.lastEventSourceId).filter((id): id is number => id !== null))];
    const live = referenced.length
      ? await this.prisma.eventSource.findMany({ where: { id: { in: referenced } }, select: { id: true } })
      : [];
    const liveIds = new Set(live.map((row) => row.id));

    // A date that moves produces a new identity — deliberately, because four
    // nights of one play are four events. The cost is that a postponed event
    // arrives looking brand new next to the one already published under the
    // same name. Same host, same title, same city, already imported: enough
    // to put a hint on the card, never enough to block the import.
    const titleKeys = [...new Set(assessed.map((item) => item.titleKey).filter(Boolean))];
    const siblings = titleKeys.length
      ? await this.prisma.discoveredEvent.findMany({
          where: { sourceScope: scope, titleKey: { in: titleKeys }, importedEventId: { not: null } },
          select: { titleKey: true, cityName: true, importedEventId: true, startsAt: true },
          take: 200,
        })
      : [];

    const queued: typeof assessed = [];
    const skipped: typeof assessed = [];
    const skipReasons: Record<string, number> = {};
    const queueReasons: Record<string, number> = {};

    for (const item of assessed) {
      const decision = decideDiscovery(item.identityKey, item.contentHash, byKey.get(item.identityKey ?? ""), liveIds);
      if (decision.action === "queue") {
        queueReasons[decision.reason] = (queueReasons[decision.reason] ?? 0) + 1;
        // An event the source has changed after it was already published is an
        // update, not a find. Say so on the card, or the editor reads it as a
        // duplicate of the event they published last week and ignores it.
        if (decision.reason === "changed-after-import") {
          const eventId = byKey.get(item.identityKey!)!.importedEventId!;
          queued.push({
            ...item,
            candidate: {
              ...item.candidate,
              _discoveryKey: item.identityKey ?? undefined,
              _existingEventId: item.candidate._existingEventId ?? eventId,
              warnings: [
                ...item.candidate.warnings,
                `Izvor je promijenio podatke za već objavljeni događaj #${eventId}. Provjerite i uredite postojeći događaj umjesto da kreirate novi.`,
              ],
            },
          });
          continue;
        }

        // A new identity whose title is already published at this host on a
        // different date. The wording has to be true of both readings — a
        // postponed event and a genuine extra term — because nothing here can
        // tell them apart, and only the editor can.
        const sibling = item.titleKey
          ? siblings.find(
              (row) =>
                row.titleKey === item.titleKey &&
                squashedEqual(row.cityName, item.candidate.city) &&
                row.startsAt?.toISOString() !== item.candidate.startsAt,
            )
          : undefined;
        if (sibling?.importedEventId) {
          queued.push({
            ...item,
            candidate: {
              ...item.candidate,
              _discoveryKey: item.identityKey ?? undefined,
              _existingEventId: item.candidate._existingEventId ?? sibling.importedEventId,
              warnings: [
                ...item.candidate.warnings,
                `Događaj istog naslova već je objavljen kao #${sibling.importedEventId}, s drugim datumom. Provjerite je li ovo novi termin ili je izvor promijenio datum.`,
              ],
            },
          });
          continue;
        }

        queued.push({ ...item, candidate: { ...item.candidate, _discoveryKey: item.identityKey ?? undefined } });
      } else {
        skipReasons[decision.reason] = (skipReasons[decision.reason] ?? 0) + 1;
        skipped.push(item);
      }
    }

    if (skipped.length) {
      this.logger.log(
        `Source ${source.id}: ${queued.length} of ${assessed.length} candidate(s) queued, ${skipped.length} already on record (${JSON.stringify(skipReasons)})`
      );
    }

    return {
      queued: { ...parsed, candidates: queued.map((item) => item.candidate) },
      queuedAssessments: queued,
      skipped,
      skipReasons,
      queueReasons,
    };
  }

  /**
   * Writes back what this check saw. Queued events get their new content hash
   * and the row that carries them; skipped ones only get `lastSeenAt` bumped,
   * so a later orphan check can still tell a decided event from a forgotten
   * one.
   */
  private async recordDiscoveredEvents(
    source: { id: number; url: string },
    triage: Awaited<ReturnType<MonitoredSourcesService["triageByIdentity"]>>,
    eventSourceId: number | undefined,
  ) {
    const scope = discoveryScope(source.url);
    const now = new Date();

    for (const item of triage.queuedAssessments) {
      if (!item.identityKey) continue;
      const startsAt = item.candidate.startsAt ? new Date(item.candidate.startsAt) : null;
      await this.prisma.discoveredEvent.upsert({
        where: { identityKey: item.identityKey },
        create: {
          identityKey: item.identityKey,
          sourceScope: scope,
          monitoredSourceId: source.id,
          contentHash: item.contentHash,
          title: item.candidate.title || "(bez naslova)",
          titleKey: item.titleKey,
          startsAt: startsAt && Number.isFinite(startsAt.getTime()) ? startsAt : null,
          cityName: item.candidate.city || null,
          detailUrl: item.candidate.sourceUrl || null,
          lastEventSourceId: eventSourceId,
        },
        update: {
          contentHash: item.contentHash,
          title: item.candidate.title || "(bez naslova)",
          titleKey: item.titleKey,
          startsAt: startsAt && Number.isFinite(startsAt.getTime()) ? startsAt : null,
          cityName: item.candidate.city || null,
          detailUrl: item.candidate.sourceUrl || null,
          lastSeenAt: now,
          lastEventSourceId: eventSourceId,
          timesSeen: { increment: 1 },
          timesQueued: { increment: 1 },
          // Re-queued because the source changed: the old decision no longer
          // covers the new content, so it goes back on the pending list.
          ignoredAt: null,
          monitoredSourceId: source.id,
        },
      });
    }

    const seenKeys = triage.skipped.map((item) => item.identityKey).filter((key): key is string => key !== null);
    if (seenKeys.length) {
      await this.prisma.discoveredEvent.updateMany({
        where: { identityKey: { in: seenKeys } },
        data: { lastSeenAt: now, timesSeen: { increment: 1 }, monitoredSourceId: source.id },
      });
    }
  }

  private async processEventPage(source: { id: number; url: string }, html: string) {
    const normalizedUrl = normalizeUrl(source.url, source.url) ?? source.url;
    const existing = await this.prisma.discoveredSourceItem.findUnique({
      where: { monitoredSourceId_normalizedUrl: { monitoredSourceId: source.id, normalizedUrl } },
      include: { linkedEventSource: true },
    });

    const extracted = this.parser.extractJsonLdEvents(html, source.url)
      ?? await this.parser.parseBatchWithLlm({ rawHtml: html, sourceUrl: source.url });
    // Same rule as the listing path: stamp the extraction, then let the
    // network-dependent stages below improve the card without being able to
    // change what event it is.
    const detailParsed: ParsedSourceResult = {
      ...extracted,
      candidates: stampCandidates(extracted.candidates, extracted.sourceUrl || source.url),
    };
    const parsed = await flagAlreadyImported(
      this.prisma,
      this.duplicates,
      await this.verifyImages(
        this.stripGenericImages(
          dropPastCandidates(detailParsed)
        ),
        source.url,
      ),
    );
    // If this page was already linked to a published Event, carry the eventId
    // forward so the admin review screen can flag it as a possible update
    // instead of an unrelated new candidate (design doc §12).
    const linkedEventId = existing?.linkedEventSource?.eventId ?? undefined;
    // An EVENT_PAGE is re-checked on the same schedule as a listing, and its
    // page hash changes for the same incidental reasons, so it needs the same
    // gate: a page whose event has not changed produces no new review row.
    const triage = await this.triageByIdentity(source, parsed);
    // Same "don't queue empty reviews" rule as the listing-page path.
    const eventSource = triage.queued.candidates.length > 0
      ? await this.createDiscoverySource(source, html, triage.queued, linkedEventId)
      : null;
    await this.recordDiscoveredEvents(source, triage, eventSource?.id);

    await this.prisma.discoveredSourceItem.upsert({
      where: { monitoredSourceId_normalizedUrl: { monitoredSourceId: source.id, normalizedUrl } },
      update: { lastSeenAt: new Date(), status: DiscoveredItemStatus.PROCESSED, linkedEventSourceId: eventSource?.id },
      create: { monitoredSourceId: source.id, normalizedUrl, sourceUrl: source.url, status: DiscoveredItemStatus.PROCESSED, linkedEventSourceId: eventSource?.id },
    });

    return {
      outcome: "changed",
      itemsFound: 1,
      itemsNew: existing ? 0 : 1,
      candidatesFound: parsed.candidates.length,
      candidatesCreated: triage.queued.candidates.length,
      candidatesSkipped: parsed.candidates.length - triage.queued.candidates.length,
      skipReasons: triage.skipReasons,
      eventSourceId: eventSource?.id,
    };
  }

  /**
   * Parses a detail page, reusing the previous result when the page has not
   * changed.
   *
   * Sources are checked daily but event pages are written once and then sit
   * still, so re-parsing every one of them each day pays for the same answer
   * over and over. The page hash decides: identical bytes mean the stored
   * parse is still correct, and the model is never called.
   */
  private async parseDetailCached(sourceId: number, detailUrl: string, body: string): Promise<ParsedEventCandidate | undefined> {
    const normalizedUrl = normalizeUrl(detailUrl, detailUrl) ?? detailUrl;
    const hash = sha256(body);

    const existing = await this.prisma.discoveredSourceItem.findUnique({
      where: { monitoredSourceId_normalizedUrl: { monitoredSourceId: sourceId, normalizedUrl } },
    });
    if (existing?.contentHash === hash && existing.parsedDetail) {
      return existing.parsedDetail as unknown as ParsedEventCandidate;
    }

    const detail = (this.parser.extractJsonLdEvents(body, detailUrl)
      ?? await this.parser.parseBatchWithLlm({ rawHtml: body, sourceUrl: detailUrl })).candidates[0];
    if (!detail) return undefined;

    await this.prisma.discoveredSourceItem.upsert({
      where: { monitoredSourceId_normalizedUrl: { monitoredSourceId: sourceId, normalizedUrl } },
      update: { contentHash: hash, parsedDetail: detail as unknown as object, lastSeenAt: new Date() },
      create: {
        monitoredSourceId: sourceId,
        normalizedUrl,
        sourceUrl: detailUrl,
        contentHash: hash,
        parsedDetail: detail as unknown as object,
        status: DiscoveredItemStatus.PROCESSED,
      },
    });
    return detail;
  }

  private async enrichThinCandidates(sourceId: number, parsed: ParsedSourceResult, links: string[]): Promise<ParsedSourceResult> {
    const candidates = [...parsed.candidates];
    let fetched = 0;

    // Budget the fetches by what's actually missing. A candidate with no
    // image/date/description is unusable and worth a detail fetch; one that
    // only lacks a street address is already reviewable, and addresses are
    // the field detail pages most often don't carry anyway — enriching those
    // first would spend the whole budget for nothing.
    // A candidate with no date at all goes first within that budget. It is the
    // one kind the deduplication cannot key, so it is re-queued on every
    // single check until something gives it a date — and on a month-calendar
    // listing, where the day is a bare "8." heading and never part of the
    // entry, that is most of the page. The date is on the detail page, so
    // spending the first fetches there turns recurring inbox noise into real
    // events, at no extra cost: the cap and the fetch count are unchanged.
    const missingDate: number[] = [];
    const missingCore: number[] = [];
    const missingAddressOnly: number[] = [];
    candidates.forEach((candidate, i) => {
      const hasRealImage = candidate.imageUrl && !this.isGenericImage(candidate.imageUrl);
      if (!candidate.startsAt) missingDate.push(i);
      else if (!hasRealImage || !candidate.description) missingCore.push(i);
      else if (!candidate.address) missingAddressOnly.push(i);
    });

    for (const i of [...missingDate, ...missingCore, ...missingAddressOnly]) {
      if (fetched >= MAX_ENRICH_FETCHES) break;
      const candidate = candidates[i];
      const hasRealImage = candidate.imageUrl && !this.isGenericImage(candidate.imageUrl);

      // An aggregator that carries the event's own origin URL hands us the
      // detail page outright — no title-to-slug guessing, and it points at
      // the organiser's own listing, which is where the address actually
      // lives. Fall back to matching a same-page link only without one.
      const match = this.ownDetailUrl(candidate.sourceUrl, parsed.sourceUrl)
        ?? this.findMatchingLink(candidate.title, links);
      if (!match) continue;
      fetched++;

      // One retry — a transient timeout/network hiccup on the detail-page
      // fetch otherwise silently leaves an already-known-thin candidate
      // exactly as thin as before, with no second chance.
      let detailResult = await politeFetch(match);
      if (detailResult.outcome !== "ok") detailResult = await politeFetch(match);
      if (detailResult.outcome !== "ok") continue;
      // Enrichment is best-effort: a detail page the parser chokes on must
      // not take down the whole check and discard every other candidate the
      // listing already yielded.
      let detail: ParsedEventCandidate | undefined;
      try {
        detail = await this.parseDetailCached(sourceId, match, detailResult.body);
      } catch {
        continue;
      }
      if (!detail) continue;

      // A real image already carried by the listing's structured data beats
      // anything scraped off the detail page — sites increasingly serve a
      // per-event *generated* og:image (title text on a branded background),
      // which looks specific enough to pass any filename check but is not
      // the event's poster.
      const detailImage = detail.imageUrl && !this.isGenericImage(detail.imageUrl) ? detail.imageUrl : "";
      const matchedImage = (hasRealImage ? candidate.imageUrl : "") || detailImage || this.findMatchingImage(candidate.title, detailResult.body, match);

      candidates[i] = {
        ...candidate,
        description: detail.description || candidate.description,
        imageUrl: matchedImage,
        startsAt: candidate.startsAt || detail.startsAt,
        endsAt: candidate.endsAt || detail.endsAt,
        occurrences: candidate.occurrences?.length ? candidate.occurrences : detail.occurrences,
        venueName: candidate.venueName || detail.venueName,
        address: candidate.address || detail.address,
        ticketUrl: candidate.ticketUrl || detail.ticketUrl,
        sourceUrl: match,
        missingFields: detail.missingFields.length ? detail.missingFields : candidate.missingFields,
        confidence: Math.max(candidate.confidence, detail.confidence),
      };
    }

    return { ...parsed, candidates };
  }

  /** Fuzzy-matches a candidate title to a discovered link by comparing
   *  significant words against the link's last path segment — the only
   *  signal available without a real per-site config (design doc §9: no
   *  bespoke scraper per site). Requires 2+ shared words and >=50% overlap
   *  to avoid matching on a single common word. */
  private findMatchingLink(title: string, links: string[]): string | null {
    const titleWords = new Set(this.significantWords(title));
    if (titleWords.size === 0) return null;

    let best: { link: string; score: number } | null = null;
    for (const link of links) {
      let slug: string;
      try {
        slug = new URL(link).pathname.split("/").filter(Boolean).pop() ?? "";
      } catch {
        continue;
      }
      const slugWords = new Set(this.significantWords(slug.replace(/-\d+$/, "").replace(/-/g, " ")));
      const overlap = [...titleWords].filter((w) => slugWords.has(w)).length;
      const score = overlap / titleWords.size;
      if (overlap >= 2 && score >= 0.5 && (!best || score > best.score)) best = { link, score };
    }
    return best?.link ?? null;
  }

  /** Sites often set a site-wide fallback og:image ("og-default.png", a logo,
   *  a "no image" placeholder) that satisfies "does this candidate have an
   *  imageUrl" without being a real per-event photo — treat those as no
   *  image at all so enrichment still tries to find the real one. */
  private isGenericImage(url: string): boolean {
    if (!url) return true;
    let path: string;
    let filename: string;
    try {
      path = new URL(url).pathname;
      filename = path.split("/").pop() ?? "";
    } catch {
      path = url;
      filename = url;
    }
    // Generated social cards (/api/og/<slug>, /opengraph-image) carry a
    // per-event name, so only the path shape gives them away — they render
    // the title over a template rather than showing the actual poster.
    if (/\/(api\/)?(og|opengraph)(-image)?(\/|$)/i.test(path)) return true;
    return /(og-?default|og-?image|placeholder|fallback|generic|no-?image|default-?image|logo)/i.test(filename);
  }

  /** An aggregator's per-event "original_url" is only useful for enrichment
   *  when it's a real off-listing page: same-page anchors and the listing URL
   *  itself would just re-fetch what we already parsed. */
  private ownDetailUrl(candidateUrl: string, listingUrl: string): string | null {
    if (!candidateUrl) return null;
    let candidate: URL;
    try {
      candidate = new URL(candidateUrl);
    } catch {
      return null;
    }
    if (candidate.protocol !== "http:" && candidate.protocol !== "https:") return null;
    try {
      const listing = new URL(listingUrl);
      if (candidate.origin === listing.origin && candidate.pathname === listing.pathname) return null;
    } catch {
      /* listing URL unparseable — the candidate URL still stands on its own */
    }
    return candidate.toString();
  }

  /** Same word-overlap technique as findMatchingLink, applied to <img> file
   *  names instead of page links — for sites that don't set an og:image meta
   *  tag but do name the uploaded photo after the event (e.g.
   *  "/foto/naslovna/dobro world cup 2026.jpg" for "DOBRO World Cup Osijek"). */
  private findMatchingImage(title: string, html: string, baseUrl: string): string {
    const titleWords = new Set(this.significantWords(title));
    if (titleWords.size === 0) return "";

    let best: { src: string; score: number } | null = null;
    const imgRe = /<img\b[^>]*\bsrc=["']([^"']+)["']/gi;
    let m: RegExpExecArray | null;
    while ((m = imgRe.exec(html)) !== null) {
      const src = m[1].trim();
      const filename = src.split("/").pop() ?? "";
      const nameWords = new Set(this.significantWords(filename.replace(/\.\w+$/, "").replace(/[_-]/g, " ")));
      if (nameWords.size === 0) continue;
      const overlap = [...titleWords].filter((w) => nameWords.has(w)).length;
      // Filenames are usually an abbreviated version of the title (a few
      // keywords, not the full sentence) — score against the filename's own
      // word count, not the title's, or a short-but-correct filename would
      // never clear the bar.
      const score = overlap / nameWords.size;
      if (overlap >= 2 && score >= 0.5 && (!best || score > best.score)) best = { src, score };
    }
    if (!best) return "";
    try {
      return new URL(best.src, baseUrl).toString();
    } catch {
      return "";
    }
  }

  /** Final safety net — collapses any site-wide fallback image that survived
   *  enrichment (no matching link found, detail fetch failed, or this is an
   *  event page where enrichment never runs at all) so the review screen
   *  shows "no image" instead of a fake per-event photo. */
  /**
   * Drops image URLs that no longer resolve, and recovers what it can.
   *
   * An aggregator can advertise an image its storage has since deleted while
   * its own pages still render it from an image-proxy cache. Passing that URL
   * through unchecked hands the admin a broken image with no explanation, so
   * verify it, retry through the source site's own proxy (which is what its
   * pages are really showing), and only then give up and clear the field —
   * "Nema slike" is honest, a broken box is not.
   */
  /**
   * Resolves a street address for candidates that only name their venue.
   *
   * The geocoder has to find the venue anyway to place a map pin, so the
   * address comes for free — and doing it here rather than at approval means
   * the admin reviews a filled-in form instead of an empty Adresa field they
   * have to look up by hand. Coordinates are kept too, so approval doesn't
   * repeat the lookup.
   */
  private async fillMissingAddresses(parsed: ParsedSourceResult): Promise<ParsedSourceResult> {
    const resolved = new Map<string, { lat: number; lng: number; formattedAddress?: string } | null>();
    const candidates = [...parsed.candidates];
    let lookups = 0;

    for (let i = 0; i < candidates.length; i++) {
      const candidate = candidates[i];
      if (candidate.address || !candidate.venueName || !candidate.city) continue;

      const key = `${candidate.venueName}|${candidate.city}`.toLowerCase();
      if (!resolved.has(key)) {
        if (lookups >= MAX_GEOCODE_LOOKUPS) break;
        lookups++;
        resolved.set(key, await lookupVenueGeo({ venueName: candidate.venueName, cityName: candidate.city }, null).catch(() => null));
      }

      const hit = resolved.get(key);
      if (!hit?.formattedAddress) continue;
      candidates[i] = { ...candidate, address: hit.formattedAddress, lat: candidate.lat ?? hit.lat, lng: candidate.lng ?? hit.lng };
    }

    return { ...parsed, candidates };
  }

  private async verifyImages(parsed: ParsedSourceResult, sourceUrl: string): Promise<ParsedSourceResult> {
    const checked = new Map<string, string>();
    const candidates = [...parsed.candidates];

    for (let i = 0; i < candidates.length; i++) {
      const original = candidates[i].imageUrl;
      if (!original) continue;

      let resolved = checked.get(original);
      if (resolved === undefined) {
        resolved = (await imageIsReachable(original))
          ? original
          : (await this.viaSourceImageProxy(original, sourceUrl)) ?? "";
        checked.set(original, resolved);
      }
      if (resolved !== original) candidates[i] = { ...candidates[i], imageUrl: resolved };
    }

    return { ...parsed, candidates };
  }

  /** Next.js sites expose /_next/image, which keeps serving an optimised copy
   *  after the original is gone. Worth one attempt before declaring the image
   *  lost, since it is the very copy the source site itself displays. */
  private async viaSourceImageProxy(imageUrl: string, sourceUrl: string): Promise<string | null> {
    let proxied: string;
    try {
      proxied = `${new URL(sourceUrl).origin}/_next/image?url=${encodeURIComponent(imageUrl)}&w=1200&q=75`;
    } catch {
      return null;
    }
    return (await imageIsReachable(proxied)) ? proxied : null;
  }

  private stripGenericImages(parsed: ParsedSourceResult): ParsedSourceResult {
    const candidates = parsed.candidates.map((c) =>
      c.imageUrl && this.isGenericImage(c.imageUrl) ? { ...c, imageUrl: "" } : c
    );
    return { ...parsed, candidates };
  }

  private significantWords(text: string): string[] {
    return text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length > 2 && !STOPWORDS.has(w));
  }

  private createDiscoverySource(source: { id: number; url: string; organizerId?: number | null }, rawHtml: string, parsed: ParsedSourceResult, eventId?: number) {
    const avgConfidence = parsed.candidates.length
      ? parsed.candidates.reduce((sum, c) => sum + c.confidence, 0) / parsed.candidates.length
      : 0;
    const needsReview = parsed.candidates.some(candidateNeedsReview);
    return this.prisma.eventSource.create({
      data: {
        type: EventSourceType.SCRAPE_DISCOVERY,
        // Provenance, so a deleted source no longer leaves anonymous rows in
        // the queue. SET NULL on delete, never cascade: the candidates and the
        // decisions taken on them have to outlive the source.
        monitoredSourceId: source.id,
        sourceUrl: source.url,
        rawHtml,
        organizerId: source.organizerId ?? undefined,
        eventId,
        parsedJson: parsed as object,
        confidence: avgConfidence,
        status: needsReview ? "NEEDS_REVIEW" : "PARSED",
      },
    });
  }

  private async recordSuccess(
    id: number,
    opts: {
      status: MonitoredSourceCheckStatus;
      httpStatus?: number;
      etag?: string | null;
      lastModified?: string | null;
      contentHash?: string;
      fingerprint?: string;
      /** Set only when the page was actually parsed, which resets the staleness floor. */
      fullParse?: boolean;
    },
  ) {
    const now = new Date();
    const source = await this.prisma.monitoredSource.findUniqueOrThrow({ where: { id } });
    await this.prisma.monitoredSource.update({
      where: { id },
      data: {
        lastCheckedAt: now,
        lastSuccessAt: now,
        lastStatus: opts.status,
        lastHttpStatus: opts.httpStatus,
        etag: opts.etag ?? source.etag,
        lastModified: opts.lastModified ?? source.lastModified,
        contentFingerprint: opts.fingerprint ?? source.contentFingerprint,
        lastFullParseAt: opts.fullParse ? now : source.lastFullParseAt,
        contentHash: opts.contentHash ?? source.contentHash,
        consecutiveFailures: 0,
        lastError: null,
        nextCheckAt: new Date(now.getTime() + source.checkIntervalMinutes * 60_000),
      },
    });
  }

  private async recordFailure(id: number, error: string, httpStatus?: number) {
    const now = new Date();
    const source = await this.prisma.monitoredSource.findUniqueOrThrow({ where: { id } });
    const consecutiveFailures = source.consecutiveFailures + 1;
    const backoffMultiplier = Math.min(2 ** consecutiveFailures, MAX_BACKOFF_MULTIPLIER);
    const autoDisable = consecutiveFailures >= MAX_CONSECUTIVE_FAILURES_BEFORE_DISABLE;

    if (autoDisable) {
      this.logger.warn(`Monitored source ${id} disabled after ${consecutiveFailures} consecutive failures: ${error}`);
    }

    await this.prisma.monitoredSource.update({
      where: { id },
      data: {
        lastCheckedAt: now,
        lastStatus: MonitoredSourceCheckStatus.ERROR,
        lastHttpStatus: httpStatus,
        consecutiveFailures,
        lastError: error,
        isActive: autoDisable ? false : undefined,
        nextCheckAt: new Date(now.getTime() + source.checkIntervalMinutes * backoffMultiplier * 60_000),
      },
    });
  }
}
