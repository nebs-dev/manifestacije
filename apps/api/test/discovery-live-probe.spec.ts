import { readFileSync } from "node:fs";
import { AiEventParserService } from "../src/ai-parser/ai-event-parser.service";
import { contentFingerprint } from "../src/monitored-sources/content-fingerprint";
import { stampCandidates } from "../src/monitored-sources/discovery-identity";

/**
 * Opt-in probe against the real Anthropic API.
 *
 * Every other test in this suite stubs the provider, and that is exactly how
 * the defect in PR #4 reached production: a stub answers identically every
 * time, so nothing could show whether identity survived a second real parse of
 * the same page. This one spends money, so it never runs unless asked.
 *
 *   # against a stored page (no network fetch of the source)
 *   DISCOVERY_LIVE_PROBE_HTML=/path/to/page.html \
 *   DISCOVERY_LIVE_PROBE_SOURCE_URL=https://example.hr/program/ \
 *     railway run --service manifestacije -- \
 *     pnpm --filter api exec jest --runInBand test/discovery-live-probe.spec.ts
 *
 *   # or fetching the page itself
 *   DISCOVERY_LIVE_PROBE_URL=https://example.hr/program/ ... (same command)
 *
 * `railway run` is how the key reaches the process without ever being printed
 * or written down. Two model calls per run, on one page: a few cents.
 */

const htmlPath = process.env.DISCOVERY_LIVE_PROBE_HTML;
const pageUrl = process.env.DISCOVERY_LIVE_PROBE_URL;
const sourceUrl = process.env.DISCOVERY_LIVE_PROBE_SOURCE_URL ?? pageUrl ?? "https://example.hr/";
const live = htmlPath || pageUrl ? describe : describe.skip;

live("identity survives a second real parse of the same page", () => {
  const parser = new AiEventParserService();
  let html = "";

  beforeAll(async () => {
    if (htmlPath) {
      html = readFileSync(htmlPath, "utf8");
      return;
    }
    const response = await fetch(pageUrl!, {
      headers: { "User-Agent": "Manifestacije/1.0 event-ingestion-bot (+https://manifestacije.hr)" },
    });
    html = await response.text();
  }, 60_000);

  it("gives the same fingerprint, the same identities and the same hashes twice", async () => {
    const first = await parser.parseBatchWithLlm({ rawHtml: html, sourceUrl });
    const second = await parser.parseBatchWithLlm({ rawHtml: html, sourceUrl });

    const stamp = (candidates: typeof first.candidates) =>
      stampCandidates(candidates, sourceUrl)
        .map((c) => `${c._discoveryKey ?? "(unkeyed)"}::${c._discoveryHash}`)
        .sort();

    const a = stamp(first.candidates);
    const b = stamp(second.candidates);

    // Printed because the number itself is the point: a page that yields two
    // candidates proves far less than one that yields forty.
    console.log(`[live-probe] run1 ${first.candidates.length} candidates, run2 ${second.candidates.length}`);
    console.log(`[live-probe] identical stamps: ${a.filter((k, i) => k === b[i]).length}/${a.length}`);
    const drifted = a.filter((key) => !b.includes(key));
    if (drifted.length) console.log(`[live-probe] drifted:\n  ${drifted.slice(0, 10).join("\n  ")}`);

    expect(first.candidates.length).toBeGreaterThan(0);
    expect(b).toEqual(a);
  }, 600_000);

  it("fingerprints the page identically however often it is read", () => {
    const fingerprint = () =>
      contentFingerprint({
        text: parser.textForFingerprint(html),
        links: parser.extractEventSubLinks(html, sourceUrl),
        html,
        baseUrl: sourceUrl,
      });

    expect(fingerprint()).toBe(fingerprint());
  });
});
