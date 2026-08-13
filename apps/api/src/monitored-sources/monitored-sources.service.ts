import { createHash } from "node:crypto";
import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { DiscoveredItemStatus, EventSourceType, EventStatus, MonitoredSourceCheckStatus, MonitoredSourceType } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AiEventParserService, ParsedEventCandidate, ParsedSourceResult } from "../ai-parser/ai-event-parser.service";
import { DuplicatesService } from "../duplicates/duplicates.service";
import { imageIsReachable, politeFetch } from "./source-fetch";
import { lookupVenueGeo } from "../common/croatia-geo";
import { normalizeUrl } from "./url-normalize";
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
const DAY_MS = 24 * 60 * 60 * 1000;
// Caps geocoder lookups per check. Distinct venues per listing are far fewer
// than candidates (the same hall hosts many events), so this is generous.
const MAX_GEOCODE_LOOKUPS = 25;
// How alike two titles must read before a candidate is flagged as already
// imported. Set high on purpose: the flag is only a warning, but a wrong one
// invites the admin to skip a genuinely new event, while a missed one just
// means a duplicate the Duplicates screen already catches.
const ALREADY_IMPORTED_TITLE_SIMILARITY = 0.8;

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
      if (contentHash === source.contentHash) {
        await this.recordSuccess(source.id, { status: "UNCHANGED", httpStatus: result.httpStatus, etag: result.etag, lastModified: result.lastModified, contentHash });
        await this.prisma.ingestionJob.update({ where: { id: job.id }, data: { status: "DONE", result: { outcome: "unchanged" } } });
        return;
      }

      const outcome = source.sourceType === MonitoredSourceType.LISTING_PAGE
        ? await this.processListingPage(source, html)
        : await this.processEventPage(source, html);

      await this.recordSuccess(source.id, { status: "OK", httpStatus: result.httpStatus, etag: result.etag, lastModified: result.lastModified, contentHash });
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
    let parsed = this.parser.extractEmbeddedEvents(html, source.url)
      ?? this.parser.extractJsonLdEvents(html, source.url)
      ?? await this.parser.parseBatchWithLlm({ rawHtml: html, sourceUrl: source.url });
    if (parsed.candidates.length === 0 && normalized.length >= 3) {
      const crawl = await this.parser.crawlListingSubPages(html, source.url);
      if (crawl.subTexts.length > 0) {
        parsed = await this.parser.parseBatchWithLlm({ rawText: crawl.subTexts.join("\n\n---\n\n"), sourceUrl: source.url });
      }
    }

    // A summary/calendar listing often gives only a title + rough date —
    // the real description/image/precise date usually live on that event's
    // own article page. Match thin candidates to a same-page link by title
    // word overlap and re-parse that page to fill in the gaps, capped like
    // crawlListingSubPages so this stays a bounded, polite number of extra
    // fetches per check rather than one per candidate.
    parsed = await this.enrichThinCandidates(source.id, parsed, allPageLinks);
    parsed = this.dropPastCandidates(parsed);
    parsed = this.stripGenericImages(parsed);
    parsed = await this.verifyImages(parsed, source.url);
    parsed = await this.fillMissingAddresses(parsed);
    parsed = await this.flagAlreadyImported(parsed);

    // Only create a review-queue row when there's actually something to
    // review — a zero-candidate result just means "checked, nothing found"
    // and belongs in this source's own run log, not in the shared admin
    // Izvori queue where it'd be one more empty row to click through.
    const eventSource = parsed.candidates.length > 0 ? await this.createDiscoverySource(source, html, parsed) : null;
    await this.prisma.discoveredSourceItem.updateMany({
      where: { monitoredSourceId: source.id, normalizedUrl: { in: normalized } },
      data: { status: DiscoveredItemStatus.PROCESSED, linkedEventSourceId: eventSource?.id },
    });

    return { outcome: "changed", itemsFound: normalized.length, itemsNew: newCount, candidatesCreated: parsed.candidates.length, eventSourceId: eventSource?.id };
  }

  private async processEventPage(source: { id: number; url: string }, html: string) {
    const normalizedUrl = normalizeUrl(source.url, source.url) ?? source.url;
    const existing = await this.prisma.discoveredSourceItem.findUnique({
      where: { monitoredSourceId_normalizedUrl: { monitoredSourceId: source.id, normalizedUrl } },
      include: { linkedEventSource: true },
    });

    const detailParsed = this.parser.extractJsonLdEvents(html, source.url)
      ?? await this.parser.parseBatchWithLlm({ rawHtml: html, sourceUrl: source.url });
    const parsed = await this.flagAlreadyImported(
      await this.verifyImages(
        this.stripGenericImages(
          this.dropPastCandidates(detailParsed)
        ),
        source.url,
      ),
    );
    // If this page was already linked to a published Event, carry the eventId
    // forward so the admin review screen can flag it as a possible update
    // instead of an unrelated new candidate (design doc §12).
    const linkedEventId = existing?.linkedEventSource?.eventId ?? undefined;
    // Same "don't queue empty reviews" rule as the listing-page path.
    const eventSource = parsed.candidates.length > 0 ? await this.createDiscoverySource(source, html, parsed, linkedEventId) : null;

    await this.prisma.discoveredSourceItem.upsert({
      where: { monitoredSourceId_normalizedUrl: { monitoredSourceId: source.id, normalizedUrl } },
      update: { lastSeenAt: new Date(), status: DiscoveredItemStatus.PROCESSED, linkedEventSourceId: eventSource?.id },
      create: { monitoredSourceId: source.id, normalizedUrl, sourceUrl: source.url, status: DiscoveredItemStatus.PROCESSED, linkedEventSourceId: eventSource?.id },
    });

    return { outcome: "changed", itemsFound: 1, itemsNew: existing ? 0 : 1, candidatesCreated: parsed.candidates.length, eventSourceId: eventSource?.id };
  }

  /** Nobody reviewing discovered candidates wants events that already
   *  happened — drop anything clearly over. Uses endsAt when present so a
   *  still-running multi-day event (started in the past, not yet finished)
   *  is kept; candidates with no parseable date at all are kept too since
   *  there's nothing to judge them against. */
  private dropPastCandidates(parsed: ParsedSourceResult): ParsedSourceResult {
    const now = Date.now();
    const candidates = parsed.candidates.filter((c) => {
      const relevantDate = c.endsAt || c.startsAt;
      if (!relevantDate) return true;
      const t = new Date(relevantDate).getTime();
      return Number.isNaN(t) || t >= now;
    });
    return { ...parsed, candidates };
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
    const missingCore: number[] = [];
    const missingAddressOnly: number[] = [];
    candidates.forEach((candidate, i) => {
      const hasRealImage = candidate.imageUrl && !this.isGenericImage(candidate.imageUrl);
      if (!hasRealImage || !candidate.startsAt || !candidate.description) missingCore.push(i);
      else if (!candidate.address) missingAddressOnly.push(i);
    });

    for (const i of [...missingCore, ...missingAddressOnly]) {
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
  /**
   * Marks candidates that look like an event we already published.
   *
   * Advisory only — nothing downstream reads the flag, and `_status` is left
   * untouched so every candidate stays importable. The matching is
   * deliberately strict (same calendar day, near-identical title, same city
   * when both are known): the expensive mistake is claiming something is a
   * duplicate when it is not, because that invites the admin to skip a real
   * new event. Anything uncertain is left unflagged and simply looks new.
   */
  private async flagAlreadyImported(parsed: ParsedSourceResult): Promise<ParsedSourceResult> {
    const dated = parsed.candidates
      .map((candidate, index) => ({ index, at: new Date(candidate.startsAt) }))
      .filter((entry) => !Number.isNaN(entry.at.getTime()));
    if (dated.length === 0) return parsed;

    const times = dated.map((entry) => entry.at.getTime());
    // One query spanning every candidate date, then compare in memory —
    // a per-candidate query would mean 20 round trips per check.
    const existing = await this.prisma.event.findMany({
      where: {
        startsAt: {
          gte: new Date(Math.min(...times) - DAY_MS),
          lte: new Date(Math.max(...times) + DAY_MS),
        },
        // A rejected or archived event is not a reason to wave the admin off
        // this candidate — they turned that one down, so the listing offering
        // it again is a decision to make afresh, not a duplicate to skip.
        status: { notIn: [EventStatus.REJECTED, EventStatus.ARCHIVED] },
      },
      select: { id: true, title: true, startsAt: true, cityName: true },
    });
    if (existing.length === 0) return parsed;

    const candidates = [...parsed.candidates];
    for (const { index, at } of dated) {
      const candidate = candidates[index];
      const match = existing.find((event) =>
        this.sameCalendarDay(event.startsAt, at)
        && this.sameCityWhenKnown(event.cityName, candidate.city)
        && this.duplicates.titleSimilarity(event.title, candidate.title) >= ALREADY_IMPORTED_TITLE_SIMILARITY);
      if (match) candidates[index] = { ...candidate, _existingEventId: match.id };
    }

    return { ...parsed, candidates };
  }

  private sameCalendarDay(a: Date, b: Date): boolean {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  }

  /** An unknown city on either side is not evidence of a different event, so
   *  it must not veto an otherwise convincing match. */
  private sameCityWhenKnown(a: string | null, b: string): boolean {
    const left = a?.trim().toLowerCase();
    const right = b?.trim().toLowerCase();
    if (!left || !right) return true;
    return left === right;
  }

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
    const needsReview = parsed.candidates.some((c) => c.missingFields.length > 0);
    return this.prisma.eventSource.create({
      data: {
        type: EventSourceType.SCRAPE_DISCOVERY,
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
    opts: { status: MonitoredSourceCheckStatus; httpStatus?: number; etag?: string | null; lastModified?: string | null; contentHash?: string },
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
