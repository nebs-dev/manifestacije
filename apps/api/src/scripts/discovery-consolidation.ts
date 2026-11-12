import { PrismaClient } from "@prisma/client";
import {
  discoveryContentHash,
  discoveryIdentityKey,
  discoveryScope,
  discoveryTitleKey,
  type IdentifiableCandidate,
} from "../monitored-sources/discovery-identity";

/**
 * Consolidation of the discovery backlog, read-only by default.
 *
 * The per-event identity added in discovery-identity.ts stops *new* duplicates
 * being queued, but it knows nothing about what the queue already holds: 325
 * review rows, 3 179 candidate cards, 748 distinct events. Without a seed, the
 * first check after deploy treats every one of those events as new and queues
 * it again — including the 43 already published.
 *
 * So this script does two separable things:
 *
 *   - **report** (default): what the identity rules make of the existing
 *     backlog. How many cards collapse, how many rows become fully redundant,
 *     how many candidates carry too little to be identified at all.
 *   - **--apply**: seeds `DiscoveredEvent` from that history, so the first
 *     check recognises what editors have already created, ignored or been
 *     shown. Upserts only into `DiscoveredEvent`.
 *
 * What it never does, in either mode: delete or edit an `EventSource`, a
 * candidate, an `Event` or a `MonitoredSource`. Collapsing the existing queue
 * is a judgement about an editor's unfinished work, so the report names the
 * redundant rows and a human decides. `--apply` is idempotent: running it
 * twice changes nothing the second time.
 *
 * Usage: pnpm --filter api discovery:consolidate
 *        pnpm --filter api discovery:consolidate -- --json
 *        pnpm --filter api discovery:consolidate -- --apply
 */

type StoredCandidate = IdentifiableCandidate & {
  _status?: string;
  _eventId?: number;
  _existingEventId?: number;
};

type Assessed = {
  eventSourceId: number;
  monitoredSourceId: number | null;
  createdAt: Date;
  index: number;
  identityKey: string | null;
  contentHash: string;
  candidate: StoredCandidate;
  scope: string;
};

export type ConsolidationReport = {
  rows: number;
  candidates: number;
  identified: number;
  unidentified: number;
  distinctEvents: number;
  duplicateCards: number;
  duplicateShare: number;
  decided: { created: number; ignored: number };
  /** Rows whose every candidate is a duplicate of one seen in an earlier row. */
  redundantRows: { id: number; createdAt: string; candidates: number }[];
  /** The worst offenders, for the human reading the report. */
  topRepeated: { title: string; copies: number; rows: number }[];
};

/** Pulls the identity out of one stored candidate as the checker would today. */
export function assessStored(
  rows: { id: number; monitoredSourceId: number | null; sourceUrl: string | null; createdAt: Date; parsedJson: unknown }[],
): Assessed[] {
  const assessed: Assessed[] = [];
  for (const row of rows) {
    const parsed = row.parsedJson as { candidates?: StoredCandidate[]; sourceUrl?: string } | null;
    const candidates = Array.isArray(parsed?.candidates) ? parsed!.candidates : [];
    const listingUrl = parsed?.sourceUrl || row.sourceUrl || "";
    const scope = discoveryScope(listingUrl);
    candidates.forEach((candidate, index) => {
      assessed.push({
        eventSourceId: row.id,
        monitoredSourceId: row.monitoredSourceId,
        createdAt: row.createdAt,
        index,
        identityKey: discoveryIdentityKey(candidate, listingUrl, scope),
        contentHash: discoveryContentHash(candidate),
        candidate,
        scope,
      });
    });
  }
  return assessed;
}

export function buildReport(assessed: Assessed[]): ConsolidationReport {
  const identified = assessed.filter((item) => item.identityKey !== null);
  const byKey = new Map<string, Assessed[]>();
  for (const item of identified) {
    const list = byKey.get(item.identityKey!) ?? [];
    list.push(item);
    byKey.set(item.identityKey!, list);
  }

  // A row is redundant only if every candidate on it also appears in an
  // *earlier* row. Oldest-first, so the first sighting is the one that counts.
  const ordered = [...assessed].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.eventSourceId - b.eventSourceId || a.index - b.index
  );
  const seen = new Set<string>();
  const rowFresh = new Map<number, { fresh: number; total: number; createdAt: Date }>();
  for (const item of ordered) {
    const entry = rowFresh.get(item.eventSourceId) ?? { fresh: 0, total: 0, createdAt: item.createdAt };
    entry.total += 1;
    // An unidentifiable candidate is never counted as redundant: nothing
    // proves it is the same event as anything else.
    if (!item.identityKey || !seen.has(item.identityKey)) entry.fresh += 1;
    if (item.identityKey) seen.add(item.identityKey);
    rowFresh.set(item.eventSourceId, entry);
  }

  const titleCounts = new Map<string, { copies: number; rows: Set<number> }>();
  for (const item of assessed) {
    const title = (item.candidate.title ?? "").trim().toLowerCase();
    if (!title) continue;
    const entry = titleCounts.get(title) ?? { copies: 0, rows: new Set<number>() };
    entry.copies += 1;
    entry.rows.add(item.eventSourceId);
    titleCounts.set(title, entry);
  }

  return {
    rows: rowFresh.size,
    candidates: assessed.length,
    identified: identified.length,
    unidentified: assessed.length - identified.length,
    distinctEvents: byKey.size,
    duplicateCards: identified.length - byKey.size,
    duplicateShare: assessed.length
      ? Math.round(((identified.length - byKey.size) / assessed.length) * 1000) / 10
      : 0,
    decided: {
      created: assessed.filter((item) => item.candidate._status === "created").length,
      ignored: assessed.filter((item) => item.candidate._status === "ignored").length,
    },
    redundantRows: [...rowFresh.entries()]
      .filter(([, entry]) => entry.total > 0 && entry.fresh === 0)
      .map(([id, entry]) => ({ id, createdAt: entry.createdAt.toISOString().slice(0, 10), candidates: entry.total }))
      .sort((a, b) => b.candidates - a.candidates),
    topRepeated: [...titleCounts.entries()]
      .map(([title, entry]) => ({ title: title.slice(0, 60), copies: entry.copies, rows: entry.rows.size }))
      .filter((row) => row.copies > 1)
      .sort((a, b) => b.copies - a.copies)
      .slice(0, 15),
  };
}

/**
 * One `DiscoveredEvent` per identity, built from the backlog.
 *
 * The *newest* sighting supplies the content hash — that is what a fresh check
 * will be compared against — while the oldest supplies `firstSeenAt`. A
 * decision taken on any sighting wins over no decision, because the editor
 * already dealt with that event once and must not be asked again.
 */
export function seedRows(assessed: Assessed[]) {
  const byKey = new Map<string, Assessed[]>();
  for (const item of assessed) {
    if (!item.identityKey) continue;
    const list = byKey.get(item.identityKey) ?? [];
    list.push(item);
    byKey.set(item.identityKey, list);
  }

  return [...byKey.entries()].map(([identityKey, sightings]) => {
    const chronological = [...sightings].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    const newest = chronological[chronological.length - 1];
    const oldest = chronological[0];
    const created = chronological.find((item) => item.candidate._status === "created" && item.candidate._eventId);
    const ignored = chronological.find((item) => item.candidate._status === "ignored");
    const startsAt = newest.candidate.startsAt ? new Date(newest.candidate.startsAt) : null;

    return {
      identityKey,
      sourceScope: newest.scope,
      monitoredSourceId: newest.monitoredSourceId,
      contentHash: newest.contentHash,
      title: (newest.candidate.title || "(bez naslova)").slice(0, 500),
      titleKey: discoveryTitleKey(newest.candidate.title),
      startsAt: startsAt && Number.isFinite(startsAt.getTime()) ? startsAt : null,
      cityName: newest.candidate.city || null,
      detailUrl: newest.candidate.sourceUrl || null,
      firstSeenAt: oldest.createdAt,
      lastSeenAt: newest.createdAt,
      timesSeen: sightings.length,
      timesQueued: sightings.length,
      lastEventSourceId: newest.eventSourceId,
      importedEventId: created?.candidate._eventId ?? null,
      ignoredAt: created ? null : ignored ? ignored.createdAt : null,
    };
  });
}

async function main() {
  const json = process.argv.includes("--json");
  const apply = process.argv.includes("--apply");
  const prisma = new PrismaClient();

  try {
    const rows = await prisma.eventSource.findMany({
      where: { type: "SCRAPE_DISCOVERY" },
      select: { id: true, monitoredSourceId: true, sourceUrl: true, createdAt: true, parsedJson: true },
      orderBy: { createdAt: "asc" },
    });

    const assessed = assessStored(rows);
    const report = buildReport(assessed);
    const seeds = seedRows(assessed);

    if (json) {
      console.log(JSON.stringify({ report, seedCount: seeds.length, applied: apply }, null, 2));
    } else {
      console.log("\nDiscovery backlog — consolidation report (read-only)\n");
      console.log(`  review rows                 ${report.rows}`);
      console.log(`  candidate cards             ${report.candidates}`);
      console.log(`    identifiable              ${report.identified}`);
      console.log(`    too thin to identify      ${report.unidentified}  (queued every check, by design)`);
      console.log(`  distinct events             ${report.distinctEvents}`);
      console.log(`  duplicate cards             ${report.duplicateCards}  (${report.duplicateShare}% of all cards)`);
      console.log(`  already created             ${report.decided.created}`);
      console.log(`  already ignored             ${report.decided.ignored}`);
      console.log(`  fully redundant rows        ${report.redundantRows.length}  (every card on them seen earlier)`);
      console.log(`  DiscoveredEvent rows to seed ${seeds.length}\n`);

      if (report.topRepeated.length) {
        console.log("  Most repeated events:");
        for (const row of report.topRepeated) {
          console.log(`    ${String(row.copies).padStart(3)}× in ${String(row.rows).padStart(3)} rows  ${row.title}`);
        }
        console.log("");
      }
      if (report.redundantRows.length) {
        const preview = report.redundantRows.slice(0, 20).map((row) => `#${row.id} (${row.createdAt}, ${row.candidates})`);
        console.log(`  Redundant rows: ${preview.join(", ")}${report.redundantRows.length > 20 ? ", …" : ""}`);
        console.log("  Nothing is deleted here. Review them in /admin/sources and remove them by hand if you agree.\n");
      }
    }

    if (!apply) {
      if (!json) console.log("  Dry run. Re-run with -- --apply to seed DiscoveredEvent (no other table is touched).\n");
      return;
    }

    let written = 0;
    for (const seed of seeds) {
      await prisma.discoveredEvent.upsert({
        where: { identityKey: seed.identityKey },
        create: seed,
        // Re-running must not inflate the counters or move firstSeenAt, and it
        // must never clear a decision recorded since the last run.
        update: {
          contentHash: seed.contentHash,
          title: seed.title,
          titleKey: seed.titleKey,
          startsAt: seed.startsAt,
          cityName: seed.cityName,
          detailUrl: seed.detailUrl,
          lastSeenAt: seed.lastSeenAt,
          lastEventSourceId: seed.lastEventSourceId,
          ...(seed.importedEventId ? { importedEventId: seed.importedEventId } : {}),
          ...(seed.ignoredAt ? { ignoredAt: seed.ignoredAt } : {}),
        },
      });
      written += 1;
    }
    console.log(`  Seeded ${written} DiscoveredEvent row(s). No EventSource, Event or MonitoredSource was modified.\n`);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
