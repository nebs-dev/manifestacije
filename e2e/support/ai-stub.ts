/**
 * Control client for the local Anthropic stand-in (support/anthropic-stub.mjs).
 *
 * The stub is the one external provider the suite fakes. Everything else — our
 * API, our database, the web app — is the real build, as asked.
 */
import type { APIRequestContext } from "@playwright/test";
import { AI_STUB_URL } from "./env";
import { futureDate, localIso, type FixtureDate } from "./dates";

/** Mirrors the candidate shape the parser's prompt asks the model to return. */
export type StubCandidate = {
  title: string;
  description: string;
  startsAt: string;
  dateText: string;
  timeText: string;
  endsAt: string | null;
  endDateText: string;
  endTimeText: string;
  isAllDay: boolean;
  venueName: string;
  address: string;
  city: string;
  category: string;
  isFree: boolean | null;
  priceText: string;
  ticketUrl: string;
  organizerName: string;
  imageUrl: string;
  confidence: number;
  missingFields: string[];
  warnings: string[];
};

/**
 * A well-formed candidate and the source text that supports it, built together
 * so the parser's evidence check passes: `dateText`/`timeText` are quoted from
 * `sourceText` verbatim, which is exactly what ai-event-parser.service.ts
 * demands of a real model reply.
 */
export function wellFormedCandidate(overrides: Partial<StubCandidate> & { date?: FixtureDate } = {}) {
  const date = overrides.date ?? futureDate(30);
  const candidate: StubCandidate = {
    title: "E2E koncert u parku",
    description: "Sintetički događaj koji je napravio end-to-end test.",
    startsAt: localIso(date, "19:00"),
    dateText: date.croatian,
    timeText: "19:00",
    endsAt: localIso(date, "21:00"),
    endDateText: "",
    endTimeText: "21:00",
    isAllDay: false,
    venueName: "Gradski park",
    address: "Trg Ante Starčevića 1",
    city: "Osijek",
    category: "glazba",
    isFree: true,
    priceText: "",
    ticketUrl: "",
    organizerName: "",
    imageUrl: "",
    confidence: 0.9,
    missingFields: [],
    warnings: [],
    ...overrides,
  };
  const sourceText = [
    candidate.title,
    "",
    `Datum: ${candidate.dateText}`,
    `Vrijeme: ${candidate.timeText} – ${candidate.endTimeText}`,
    `Mjesto: ${candidate.venueName}, ${candidate.address}, ${candidate.city}`,
    "",
    candidate.description,
  ].join("\n");
  return { candidate, sourceText, date };
}

export class AiStub {
  constructor(private readonly request: APIRequestContext) {}

  /** Back to the default: one reply, no candidates. */
  async reset(): Promise<void> {
    await this.request.post(`${AI_STUB_URL}/__reset`);
  }

  /** The next parse returns these candidates. */
  async willReturn(candidates: StubCandidate[]): Promise<void> {
    await this.request.post(`${AI_STUB_URL}/__control`, { data: { mode: "candidates", candidates } });
  }

  /** The next parse gets an HTTP error, as a provider outage looks to the API. */
  async willFail(status = 503): Promise<void> {
    await this.request.post(`${AI_STUB_URL}/__control`, { data: { mode: "http-error", status } });
  }

  /** The next parse gets prose instead of JSON — the other common failure. */
  async willReturnProse(): Promise<void> {
    await this.request.post(`${AI_STUB_URL}/__control`, { data: { mode: "malformed" } });
  }

  async callCount(): Promise<number> {
    const response = await this.request.get(`${AI_STUB_URL}/__requests`);
    return ((await response.json()) as { count: number }).count;
  }
}
