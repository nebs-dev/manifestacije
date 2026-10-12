import { createHash } from "crypto";
import type { ParsedSourceResult } from "./ai-event-parser.service";

/**
 * Organizer submissions are stored before AI parsing (P1-B). Until parsing
 * succeeds, `parsedJson` carries an empty candidate list plus the evidence
 * needed for admin review or a retry. These keys are internal bookkeeping and
 * are removed once a parse result replaces them.
 */
export type SourceEvidence = {
  submissionKey?: string;
  sourceImageUrl?: string;
  /** Poster bytes, kept only when no uploaded image URL exists and parsing failed. */
  pendingScreenshot?: { mediaType: string; base64: string };
  /** Croatian, admin-facing reason the automatic parse did not complete. */
  parseError?: string;
};

export const SCREENSHOT_MEDIA_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

/** Stable key for "the same organizer submitted the same content", used to make retries idempotent. */
export function submissionKey(input: { sourceUrl?: string; rawText?: string; screenshotBase64?: string; sourceImageUrl?: string }): string {
  const screenshot = input.screenshotBase64 ? createHash("sha256").update(input.screenshotBase64).digest("hex") : "";
  return createHash("sha256")
    .update(JSON.stringify([input.sourceUrl ?? "", input.rawText ?? "", screenshot, input.sourceImageUrl ?? ""]))
    .digest("hex");
}

export function pendingSourceJson(sourceUrl: string | undefined, evidence: SourceEvidence): ParsedSourceResult & SourceEvidence {
  const defined = Object.fromEntries(Object.entries(evidence).filter(([, value]) => value !== undefined));
  return { sourceUrl: sourceUrl ?? "", sourceType: "single", candidates: [], ...defined };
}

export function readEvidence(parsedJson: unknown): SourceEvidence {
  const json = (parsedJson && typeof parsedJson === "object" ? parsedJson : {}) as Record<string, unknown>;
  const shot = json.pendingScreenshot as SourceEvidence["pendingScreenshot"] | undefined;
  return {
    submissionKey: typeof json.submissionKey === "string" ? json.submissionKey : undefined,
    sourceImageUrl: typeof json.sourceImageUrl === "string" ? json.sourceImageUrl : undefined,
    pendingScreenshot: shot && typeof shot.base64 === "string" && SCREENSHOT_MEDIA_TYPES.has(shot.mediaType) ? shot : undefined,
    parseError: typeof json.parseError === "string" ? json.parseError : undefined,
  };
}

/** A successful parse result, keeping only the durable evidence keys. */
export function parsedWithEvidence(result: ParsedSourceResult, evidence: SourceEvidence): ParsedSourceResult & SourceEvidence {
  const { pendingScreenshot: _shot, parseError: _error, ...rest } = result as ParsedSourceResult & SourceEvidence;
  return {
    ...rest,
    ...(evidence.submissionKey ? { submissionKey: evidence.submissionKey } : {}),
    ...(evidence.sourceImageUrl ? { sourceImageUrl: evidence.sourceImageUrl } : {}),
  };
}

/** Admin-facing Croatian reason; provider details are never stored. */
export function parseFailureReason(error: unknown): string {
  const status = error && typeof error === "object" && "getStatus" in error && typeof (error as { getStatus: unknown }).getStatus === "function"
    ? (error as { getStatus: () => number }).getStatus() : undefined;
  if (status === 400) return "Automatska obrada nije uspjela: sadržaj nije bilo moguće obraditi. Pregledajte izvor ručno.";
  if (status === 503) return "Automatska obrada trenutačno nije dostupna. Izvor je spremljen; pokušajte ponovno parsirati ili ga obradite ručno.";
  return "Automatska obrada nije uspjela. Izvor je spremljen; pokušajte ponovno parsirati ili ga obradite ručno.";
}

/** Drops inline poster bytes from list payloads; the source detail keeps them. */
export function withoutInlinePoster<T>(parsedJson: T): T {
  if (!parsedJson || typeof parsedJson !== "object" || !("pendingScreenshot" in parsedJson)) return parsedJson;
  const { pendingScreenshot: _shot, ...rest } = parsedJson as Record<string, unknown>;
  return { ...rest, hasPendingScreenshot: true } as T;
}
