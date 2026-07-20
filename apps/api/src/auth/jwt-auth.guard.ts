import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import { UserRole } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService
  ) {}

  async canActivate(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest();
    const auth = req.headers.authorization || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!token) throw new UnauthorizedException("Missing bearer token");

    let payload: { id: number; email: string; role: UserRole; organizerId?: number | null; authVersion?: number };
    try {
      payload = this.jwt.verify(token);
    } catch {
      throw new UnauthorizedException("Invalid token");
    }

    // Reject tokens issued before the user's last password reset. Tokens signed
    // before authVersion existed on the payload (authVersion === undefined) are
    // treated as version 0, matching the column default, so already-issued
    // tokens from before this feature shipped keep working until the next reset.
    const user = await this.prisma.user.findUnique({ where: { id: payload.id } });
    if (!user) throw new UnauthorizedException("User not found");
    if ((payload.authVersion ?? 0) !== user.authVersion) {
      throw new UnauthorizedException("Session expired — please log in again");
    }

    req.user = { id: user.id, email: user.email, role: user.role, organizerId: user.organizerId, authVersion: user.authVersion };

    const roles = this.reflector.getAllAndOverride<UserRole[]>("roles", [ctx.getHandler(), ctx.getClass()]);
    if (roles?.length && !roles.includes(req.user.role)) throw new UnauthorizedException("Insufficient role");
    return true;
  }
}
