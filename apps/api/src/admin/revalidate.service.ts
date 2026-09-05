import { Injectable, Logger } from "@nestjs/common";
import { EventStatus } from "@prisma/client";

// Archived, previously published events still have public detail pages.
export function hasPublicEventOutput(event: { status?: EventStatus; publishedAt?: Date | null } | null | undefined): boolean {
  return event?.status === EventStatus.PUBLISHED ||
    (event?.status === EventStatus.ARCHIVED && Boolean(event.publishedAt));
}

@Injectable()
export class RevalidateService {
  private readonly logger = new Logger(RevalidateService.name);
  private readonly webUrl = process.env.WEB_URL;
  private readonly secret = process.env.REVALIDATE_SECRET;

  // Never throw: the database mutation has already committed. Awaiting bounds
  // request lifetime without turning a cache outage into a failed event save.
  async revalidate(tag: "events" | "partners" | "taxonomy" | "organizers" = "events"): Promise<boolean> {
    if (!this.webUrl?.trim() || !this.secret?.trim()) {
      this.logger.warn({ event: "cache_revalidation", outcome: "skipped", reason: "missing_config", tag,
        missing: [!this.webUrl?.trim() && "WEB_URL", !this.secret?.trim() && "REVALIDATE_SECRET"].filter(Boolean) });
      return false;
    }
    let url: URL;
    try {
      url = new URL(this.webUrl);
      if (!["https:", "http:"].includes(url.protocol) || url.username || url.password ||
          url.search || url.hash || url.pathname !== "/") throw new Error("invalid origin");
      url.pathname = "/api/revalidate";
    } catch {
      this.logger.warn({ event: "cache_revalidation", outcome: "final_failure", reason: "invalid_WEB_URL", tag });
      return false;
    }

    for (let attempt = 1; attempt <= 2; attempt++) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2500);
      let retryable = false;
      try {
        const response = await fetch(url, {
          method: "POST", redirect: "error", signal: controller.signal,
          headers: { "Content-Type": "application/json", "x-revalidate-secret": this.secret },
          body: JSON.stringify({ tag }),
        });
        if (response.ok) {
          // Check the acknowledgement too: a login/protection page is not success.
          const body = await response.json().catch(() => {
            if (controller.signal.aborted) throw new Error("timeout");
            return null;
          });
          if (body?.revalidated === true && body?.tag === tag) {
            this.logger.log({ event: "cache_revalidation", outcome: "success", tag, attempt });
            return true;
          }
          this.logger.warn({ event: "cache_revalidation", outcome: "invalid_acknowledgement", tag, attempt });
        } else {
          retryable = response.status >= 500 || response.status === 408 || response.status === 429;
          this.logger.warn({ event: "cache_revalidation", outcome: "http_failure", tag, attempt, status: response.status });
        }
      } catch {
        retryable = true;
        // Never include raw errors, response bodies, URLs or headers in logs.
        this.logger.warn({ event: "cache_revalidation", outcome: controller.signal.aborted ? "timeout" : "network_failure", tag, attempt });
      } finally {
        clearTimeout(timeout);
      }
      if (!retryable || attempt === 2) break;
      this.logger.warn({ event: "cache_revalidation", outcome: "retry", tag, attempt: attempt + 1 });
    }
    this.logger.warn({ event: "cache_revalidation", outcome: "final_failure", tag });
    return false;
  }
}
