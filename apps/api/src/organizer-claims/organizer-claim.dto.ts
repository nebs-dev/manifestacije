import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from "class-validator";
import { Transform } from "class-transformer";

export class RequestOrganizerClaimDto {
  @IsString()
  organizerSlug!: string;

  @IsEmail()
  @Transform(({ value }) => (typeof value === "string" ? value.trim().toLowerCase() : value))
  email!: string;
}

export class VerifyOrganizerClaimDto {
  @IsString()
  @MinLength(32, { message: "Token nije valjan." })
  token!: string;
}

export class CompleteOrganizerClaimDto {
  @IsString()
  @MinLength(32, { message: "Token nije valjan." })
  token!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(10, { message: "Lozinka mora imati najmanje 10 znakova." })
  @MaxLength(128, { message: "Lozinka je predugačka." })
  password?: string;
}

export class RejectOrganizerClaimDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  internalReason?: string;
}
