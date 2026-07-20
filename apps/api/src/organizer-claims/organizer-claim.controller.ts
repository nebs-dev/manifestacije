import { Body, Controller, Post } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { OrganizerClaimService } from "./organizer-claim.service";
import { RequestOrganizerClaimDto, CompleteOrganizerClaimDto, VerifyOrganizerClaimDto } from "./organizer-claim.dto";

@Controller("organizer-claims")
export class OrganizerClaimController {
  constructor(private readonly claims: OrganizerClaimService) {}

  @Post("request")
  @Throttle({ default: { ttl: 15 * 60_000, limit: 5 } })
  request(@Body() dto: RequestOrganizerClaimDto) {
    return this.claims.requestClaim(dto);
  }

  @Post("verify")
  @Throttle({ default: { ttl: 15 * 60_000, limit: 20 } })
  verify(@Body() dto: VerifyOrganizerClaimDto) {
    return this.claims.verifyToken(dto);
  }

  @Post("complete")
  @Throttle({ default: { ttl: 15 * 60_000, limit: 10 } })
  complete(@Body() dto: CompleteOrganizerClaimDto) {
    return this.claims.completeClaim(dto);
  }
}
