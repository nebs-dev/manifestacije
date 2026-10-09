import { PrismaClient } from "@prisma/client";
import { normalizeSafeHttpUrl, SafeUrlOptions } from "../common/safe-url";

/**
 * READ-ONLY audit of stored user-supplied URLs. Lists every value that the
 * current input rules would reject (UNSAFE: javascript:, data:, relative
 * paths, junk text, ...) or rewrite (SCHEMELESS: "www.entrio.hr" would gain
 * https://). Only SELECT queries are issued; nothing is modified. Rows found
 * here are already neutralised at render time by the web app — clean them up
 * manually in the admin UI after review.
 *
 * Usage: pnpm --filter api urls:audit            (human-readable)
 *        pnpm --filter api urls:audit -- --json  (machine-readable)
 */

export type UrlFinding = { table: string; id: number; field: string; status: "UNSAFE" | "SCHEMELESS"; value: string };

/** Ticket links may also be tel:/mailto: (see SafeUrlOptions). */
const CONTACT_FIELDS = new Set(["ticketUrl"]);

export function classifyStoredUrl(value: unknown, options?: SafeUrlOptions): UrlFinding["status"] | null {
  if (typeof value !== "string" || value.trim() === "") return null;
  const safe = normalizeSafeHttpUrl(value, options);
  if (!safe) return "UNSAFE";
  return safe === value ? null : "SCHEMELESS";
}

export function auditRows(table: string, rows: Array<Record<string, unknown> & { id: number }>, fields: string[]): UrlFinding[] {
  const findings: UrlFinding[] = [];
  for (const row of rows) {
    for (const field of fields) {
      const value = row[field];
      const status = classifyStoredUrl(value, { allowContactLinks: CONTACT_FIELDS.has(field) });
      if (status) findings.push({ table, id: row.id, field, status, value: String(value) });
    }
  }
  return findings;
}

/** EventSource.parsedJson holds parser candidates that the admin UI renders as links. */
export function auditParsedJson(sources: Array<{ id: number; parsedJson: unknown }>): UrlFinding[] {
  const findings: UrlFinding[] = [];
  for (const source of sources) {
    const parsed = source.parsedJson as { sourceImageUrl?: unknown; candidates?: unknown } | null;
    if (!parsed || typeof parsed !== "object") continue;
    findings.push(...auditRows("EventSource.parsedJson", [{ id: source.id, sourceImageUrl: parsed.sourceImageUrl }], ["sourceImageUrl"]));
    // Legacy single-event format stores the candidate at the top level.
    const candidates = Array.isArray(parsed.candidates) ? parsed.candidates : [parsed];
    candidates.forEach((candidate, index) => {
      if (!candidate || typeof candidate !== "object") return;
      const row = { id: source.id, ...(candidate as Record<string, unknown>) };
      for (const finding of auditRows("EventSource.parsedJson", [row], ["ticketUrl", "sourceUrl", "imageUrl", "imageSourceUrl"])) {
        findings.push({ ...finding, field: `candidates[${index}].${finding.field}` });
      }
    });
  }
  return findings;
}

async function main() {
  const json = process.argv.includes("--json");
  const prisma = new PrismaClient();
  try {
    const [events, sources, organizers, partners] = await Promise.all([
      prisma.event.findMany({ select: { id: true, ticketUrl: true, sourceUrl: true, imageUrl: true }, orderBy: { id: "asc" } }),
      prisma.eventSource.findMany({ select: { id: true, sourceUrl: true, parsedJson: true }, orderBy: { id: "asc" } }),
      prisma.organizer.findMany({ select: { id: true, websiteUrl: true, facebookUrl: true, instagramUrl: true }, orderBy: { id: "asc" } }),
      prisma.partner.findMany({ select: { id: true, logoUrl: true, websiteUrl: true }, orderBy: { id: "asc" } }),
    ]);

    const findings = [
      ...auditRows("Event", events, ["ticketUrl", "sourceUrl", "imageUrl"]),
      ...auditRows("EventSource", sources, ["sourceUrl"]),
      ...auditParsedJson(sources),
      ...auditRows("Organizer", organizers, ["websiteUrl", "facebookUrl", "instagramUrl"]),
      ...auditRows("Partner", partners, ["logoUrl", "websiteUrl"]),
    ];

    if (json) {
      console.log(JSON.stringify(findings, null, 2));
      return;
    }
    console.log(`urls:audit — scanned events=${events.length} sources=${sources.length} organizers=${organizers.length} partners=${partners.length}`);
    for (const f of findings) {
      // JSON.stringify keeps control characters and quotes visible and inert in a terminal.
      console.log(`${f.status.padEnd(10)} ${f.table}#${f.id} ${f.field} ${JSON.stringify(f.value.slice(0, 200))}`);
    }
    const unsafe = findings.filter((f) => f.status === "UNSAFE").length;
    console.log(`urls:audit — unsafe=${unsafe} schemeless=${findings.length - unsafe} (read-only, nothing modified)`);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error("urls:audit failed:", err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
