import { Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";

const SCOPE = "event-preview";
const TTL_MINUTES = 30;

type PreviewClaims = { scope?: string; eventId?: number; slug?: string };

/**
 * Short-lived links that let an admin open an unpublished event on its real
 * public page. The token names one event, expires on its own and carries no
 * user identity, so it can never stand in for a session (JwtAuthGuard rejects
 * any token carrying a scope claim).
 */
@Injectable()
export class EventPreviewService {
  constructor(private readonly jwt: JwtService) {}

  readonly expiresInMinutes = TTL_MINUTES;

  sign(event: { id: number; slug: string }) {
    return this.jwt.sign(
      { scope: SCOPE, eventId: event.id, slug: event.slug },
      { expiresIn: `${TTL_MINUTES}m` }
    );
  }

  /** True only for a live token issued for this exact slug. */
  allows(slug: string, token: string | undefined): boolean {
    if (!token) return false;
    try {
      const claims = this.jwt.verify<PreviewClaims>(token);
      return claims.scope === SCOPE && claims.slug === slug;
    } catch {
      return false;
    }
  }
}
