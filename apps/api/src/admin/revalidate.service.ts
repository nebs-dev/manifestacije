import { Injectable, Logger } from "@nestjs/common";

@Injectable()
export class RevalidateService {
  private readonly logger = new Logger(RevalidateService.name);
  private readonly webUrl = process.env.WEB_URL?.replace(/\/$/, "");
  private readonly secret = process.env.REVALIDATE_SECRET;

  async revalidate(tag = "events"): Promise<void> {
    if (!this.webUrl || !this.secret) return;
    try {
      await fetch(`${this.webUrl}/api/revalidate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-revalidate-secret": this.secret },
        body: JSON.stringify({ tag }),
      });
    } catch (err) {
      this.logger.warn(`Revalidate failed: ${err}`);
    }
  }
}
