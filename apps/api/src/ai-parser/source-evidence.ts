import { createHash } from "crypto";
import type { ParsedSourceResult } from "./ai-event-parser.service";

/**
 * Source bookkeeping kept inside `parsedJson` (no schema change).
 *
 * P1-B: organizer submissions are stored before AI parsing; until parsing
 * succeeds, `parsedJson` has an empty candidate list plus what is needed for
 * review or retry. EVT-07: several posters/screenshots per source. EVT-08:
 * editor supplements (text and images) attached to a source over time.
 *
 * Older rows used single `sourceImageUrl` / `pendingScreenshot` keys; they are
 * read transparently and the single key is still written for compatibility.
 */
export type InlineImage = { mediaType: string; base64: string };

export type SourceSupplement = {
  id: string;
  at: string;
  byUserId?: number;
  text?: string;
  imageUrls: string[];
  /** Bytes only for images that could not be stored in Cloudinary. */
  inlineImages?: InlineImage[];
};

export type SourceEvidence = {
  submissionKey?: string;
  sourceImageUrls?: string[];
  /** Poster bytes, kept only when no uploaded copy exists and parsing failed. */
  pendingScreenshots?: InlineImage[];
  supplements?: SourceSupplement[];
  /** Croatian, admin-facing reason the automatic parse did not complete. */
  parseError?: string;
};

export const SCREENSHOT_MEDIA_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
export const MAX_SUPPLEMENTS = 20;

const sha = (value: string) => createHash("sha256").update(value).digest("hex");

/** Stable key for "the same organizer submitted the same content", used to make retries idempotent. */
export function submissionKey(input: { sourceUrl?: string; rawText?: string; screenshots?: string[]; sourceImageUrls?: string[] }): string {
  const shots = input.screenshots ?? [];
  const screenshot = shots.length === 1 ? sha(shots[0]) : shots.length ? sha(shots.map(sha).join(",")) : "";
  return sha(JSON.stringify([input.sourceUrl ?? "", input.rawText ?? "", screenshot, (input.sourceImageUrls ?? []).join(" ")]));
}

export function supplementId(input: { text?: string; images: string[]; imageUrls: string[] }): string {
  return sha(JSON.stringify([input.text?.trim() ?? "", input.images.map(sha), input.imageUrls])).slice(0, 32);
}

function validImage(value: unknown): value is InlineImage {
  const image = value as InlineImage | undefined;
  return Boolean(image && typeof image.base64 === "string" && image.base64 && SCREENSHOT_MEDIA_TYPES.has(image.mediaType));
}

function evidenceKeys(evidence: SourceEvidence): Record<string, unknown> {
  const urls = evidence.sourceImageUrls ?? [];
  return Object.fromEntries(Object.entries({
    submissionKey: evidence.submissionKey,
    sourceImageUrls: urls.length ? urls : undefined,
    sourceImageUrl: urls[0],
    pendingScreenshots: evidence.pendingScreenshots?.length ? evidence.pendingScreenshots : undefined,
    supplements: evidence.supplements?.length ? evidence.supplements : undefined,
    parseError: evidence.parseError,
  }).filter(([, value]) => value !== undefined));
}

export function pendingSourceJson(sourceUrl: string | undefined, evidence: SourceEvidence): ParsedSourceResult & Record<string, unknown> {
  return { sourceUrl: sourceUrl ?? "", sourceType: "single", candidates: [], ...evidenceKeys(evidence) };
}

export function readEvidence(parsedJson: unknown): SourceEvidence {
  const json = (parsedJson && typeof parsedJson === "object" ? parsedJson : {}) as Record<string, unknown>;
  const urls = [
    ...(Array.isArray(json.sourceImageUrls) ? json.sourceImageUrls : []),
    ...(typeof json.sourceImageUrl === "string" ? [json.sourceImageUrl] : []),
  ].filter((url, index, all): url is string => typeof url === "string" && all.indexOf(url) === index);
  const shots = [
    ...(Array.isArray(json.pendingScreenshots) ? json.pendingScreenshots : []),
    ...(json.pendingScreenshot ? [json.pendingScreenshot] : []),
  ].filter(validImage);
  const supplements = (Array.isArray(json.supplements) ? json.supplements : []).filter((item): item is SourceSupplement =>
    Boolean(item && typeof item === "object" && typeof (item as SourceSupplement).id === "string"));
  return {
    submissionKey: typeof json.submissionKey === "string" ? json.submissionKey : undefined,
    sourceImageUrls: urls.length ? urls : undefined,
    pendingScreenshots: shots.length ? shots : undefined,
    supplements: supplements.length ? supplements : undefined,
    parseError: typeof json.parseError === "string" ? json.parseError : undefined,
  };
}

/**
 * A successful parse result plus the durable evidence keys. Inline poster
 * bytes are original evidence when no stored copy exists, so they are kept for
 * later review, supplements and retries (EVT-07/08); only the error is cleared.
 */
export function parsedWithEvidence(result: ParsedSourceResult, evidence: SourceEvidence): ParsedSourceResult & Record<string, unknown> {
  const { pendingScreenshot: _a, pendingScreenshots: _b, parseError: _c, sourceImageUrl: _d, sourceImageUrls: _e, supplements: _f, submissionKey: _g, ...rest } =
    result as ParsedSourceResult & Record<string, unknown>;
  return { ...rest, ...evidenceKeys({ ...evidence, parseError: undefined }) } as ParsedSourceResult & Record<string, unknown>;
}

/** All supplement texts in order, for the parser. */
export function supplementText(evidence: SourceEvidence): string | undefined {
  const parts = (evidence.supplements ?? []).map((item) => item.text?.trim()).filter(Boolean);
  return parts.length ? parts.join("\n\n---\n\n") : undefined;
}

/** Admin-facing Croatian reason; provider details are never stored. */
export function parseFailureReason(error: unknown): string {
  const status = error && typeof error === "object" && "getStatus" in error && typeof (error as { getStatus: unknown }).getStatus === "function"
    ? (error as { getStatus: () => number }).getStatus() : undefined;
  if (status === 400) return "Automatska obrada nije uspjela: sadržaj nije bilo moguće obraditi. Pregledajte izvor ručno.";
  if (status === 503) return "Automatska obrada trenutačno nije dostupna. Izvor je spremljen; pokušajte ponovno parsirati ili ga obradite ručno.";
  return "Automatska obrada nije uspjela. Izvor je spremljen; pokušajte ponovno parsirati ili ga obradite ručno.";
}

/** Drops inline image bytes from list payloads; the source detail keeps them. */
export function withoutInlinePoster<T>(parsedJson: T): T {
  if (!parsedJson || typeof parsedJson !== "object") return parsedJson;
  const json = parsedJson as Record<string, unknown>;
  const hasInline = "pendingScreenshot" in json || "pendingScreenshots" in json
    || (Array.isArray(json.supplements) && json.supplements.some((item) => (item as SourceSupplement)?.inlineImages?.length));
  if (!hasInline) return parsedJson;
  const { pendingScreenshot: _shot, pendingScreenshots: _shots, ...rest } = json;
  if (Array.isArray(rest.supplements)) {
    rest.supplements = rest.supplements.map((item) => {
      const { inlineImages, ...kept } = item as SourceSupplement;
      return { ...kept, inlineImageCount: inlineImages?.length ?? 0 };
    });
  }
  return { ...rest, hasPendingScreenshot: true } as T;
}
