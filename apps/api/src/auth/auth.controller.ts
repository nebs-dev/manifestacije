import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { Throttle, ThrottlerGuard } from "@nestjs/throttler";
import { AuthService } from "./auth.service";
import { ForgotPasswordDto, LoginDto, RegisterDto, ResetPasswordDto } from "./auth.dto";
import { CurrentUser } from "./auth.decorators";
import { JwtAuthGuard } from "./jwt-auth.guard";
import { AuthUser } from "./auth.types";

/** Brute-force window for password login and registration, per client IP. */
export const LOGIN_THROTTLE = { ttl: 60_000, limit: 10 };
/** Session checks run on every organizer/admin page load. They have their
 *  own bucket (throttler keys are per route) and a limit ordinary navigation
 *  never reaches, so browsing can neither hit a 429 nor eat into the login
 *  attempt quota. */
export const SESSION_CHECK_THROTTLE = { ttl: 60_000, limit: 300 };

@Controller("auth")
@UseGuards(ThrottlerGuard)
@Throttle({ default: LOGIN_THROTTLE })
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post("register")
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @Post("login")
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @Get("me")
  @Throttle({ default: SESSION_CHECK_THROTTLE })
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user.id);
  }

  @Post("forgot-password")
  @Throttle({ default: { ttl: 15 * 60_000, limit: 5 } })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.auth.forgotPassword(dto);
  }

  @Post("reset-password")
  @Throttle({ default: { ttl: 15 * 60_000, limit: 10 } })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.auth.resetPassword(dto);
  }
}
