/**
 * Instrumentation for the UX audit.
 *
 * The audit measures the daily editorial workflow rather than asserting on it:
 * how many clicks a task takes, how many page loads, how many fields are typed
 * into, and where the editor has to carry something in their head from one
 * screen to the next. Every interaction goes through this recorder so the
 * counts come from the real run and not from reading the code.
 *
 * This lives outside e2e/specs on purpose: it is exploration, and it is run on
 * demand with `pnpm e2e:audit`. Only the specs are the regression suite.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { Locator, Page } from "@playwright/test";

export const AUDIT_DIR = path.resolve(__dirname, "..", ".artifacts", "audit");

type Step = {
  label: string;
  clicks: number;
  fills: number;
  navigations: number;
  note?: string;
};

export type Finding = {
  /** Which screen or transition it was seen on. */
  where: string;
  /** What was observed, in one sentence. */
  what: string;
  kind: "clicks" | "retyping" | "memory" | "state-loss" | "status" | "mobile" | "a11y" | "combinable";
};

export class Journey {
  private readonly steps: Step[] = [];
  private current: Step | null = null;
  private navigations = 0;
  readonly findings: Finding[] = [];
  private shots = 0;

  constructor(
    readonly name: string,
    private readonly page: Page
  ) {
    mkdirSync(AUDIT_DIR, { recursive: true });
    page.on("framenavigated", (frame) => {
      if (frame === page.mainFrame()) this.navigations += 1;
    });
  }

  step(label: string): void {
    this.current = { label, clicks: 0, fills: 0, navigations: 0 };
    this.steps.push(this.current);
    this.navigations = 0;
  }

  private bump(key: "clicks" | "fills"): void {
    if (!this.current) this.step("(unlabelled)");
    this.current![key] += 1;
  }

  /** Every counted click goes through here. */
  async click(target: Locator, note?: string): Promise<void> {
    this.bump("clicks");
    if (note && this.current) this.current.note = note;
    await target.click();
  }

  /** A field the editor has to type into. */
  async fill(target: Locator, value: string): Promise<void> {
    this.bump("fills");
    await target.fill(value);
  }

  async select(target: Locator, value: string): Promise<void> {
    this.bump("clicks");
    await target.selectOption(value);
  }

  /** Closes the current step, folding in the navigations it caused. */
  end(): void {
    if (this.current) this.current.navigations = this.navigations;
    this.navigations = 0;
    this.current = null;
  }

  find(kind: Finding["kind"], where: string, what: string): void {
    this.findings.push({ kind, where, what });
  }

  /**
   * `fullPage` does not help here: the admin shell scrolls an inner element
   * rather than the document, so a full-page capture returns one viewport.
   * Passing a locator captures that element in full instead, which is what is
   * wanted for a candidate card taller than the screen.
   */
  async shot(label: string, target?: Locator): Promise<string> {
    this.shots += 1;
    const slug = `${this.name}-${String(this.shots).padStart(2, "0")}-${label.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.png`;
    const file = path.join(AUDIT_DIR, slug);
    if (target) await target.screenshot({ path: file });
    else await this.page.screenshot({ path: file, fullPage: true });
    return slug;
  }

  /**
   * How many viewports tall the card holding `markerText` is — i.e. how much
   * scrolling the editor does to work one of them. Measured in the page rather
   * than through a locator, because these cards nest and picking the right
   * wrapper by selector is guesswork.
   */
  async viewportsTall(markerText: string): Promise<number> {
    const height = this.page.viewportSize()?.height ?? 900;
    const px = await this.page.evaluate((marker) => {
      const button = [...document.querySelectorAll("button")].find((element) => element.textContent?.includes(marker));
      const card = button?.closest("[data-slot='card']") as HTMLElement | undefined;
      return card?.getBoundingClientRect().height ?? 0;
    }, markerText);
    return Math.round((px / height) * 10) / 10;
  }

  get totals() {
    return this.steps.reduce(
      (sum, step) => ({
        clicks: sum.clicks + step.clicks,
        fills: sum.fills + step.fills,
        navigations: sum.navigations + step.navigations,
      }),
      { clicks: 0, fills: 0, navigations: 0 }
    );
  }

  report(): string {
    const { clicks, fills, navigations } = this.totals;
    const rows = this.steps
      .map((step) => `| ${step.label} | ${step.clicks} | ${step.fills} | ${step.navigations} | ${step.note ?? ""} |`)
      .join("\n");
    return [
      `### ${this.name}`,
      "",
      `**${clicks} clicks · ${fills} fields typed · ${navigations} page loads**`,
      "",
      "| Step | Clicks | Fields | Page loads | Note |",
      "| --- | --- | --- | --- | --- |",
      rows,
      "",
    ].join("\n");
  }
}

/**
 * Collects every journey's report into one file per project. Playwright gives
 * each project its own module registry, so the desktop and phone runs each
 * have their own `journeys` array and need their own file — one shared name
 * would mean the second run silently overwrote the first.
 */
export function writeAuditReport(journeys: Journey[], project: string): string {
  const findings = journeys.flatMap((journey) => journey.findings.map((finding) => ({ ...finding, journey: journey.name })));
  const body = [
    `# Editorial UX audit — measured walkthrough (${project})`,
    "",
    "Counts are from a real browser run against local production builds, with",
    "synthetic accounts and a disposable database. Generated by `pnpm e2e:audit`;",
    "screenshots are beside this file.",
    "",
    ...journeys.map((journey) => journey.report()),
    "## Observations",
    "",
    "| Kind | Where | What |",
    "| --- | --- | --- |",
    ...findings.map((finding) => `| ${finding.kind} | ${finding.where} | ${finding.what} |`),
    "",
  ].join("\n");
  mkdirSync(AUDIT_DIR, { recursive: true });
  const target = path.join(AUDIT_DIR, `MEASUREMENTS-${project}.md`);
  writeFileSync(target, body);
  return target;
}
