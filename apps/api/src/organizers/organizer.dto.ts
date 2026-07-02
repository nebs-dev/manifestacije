import { IsBoolean, IsOptional, IsString, IsUrl } from "class-validator";

export class OrganizerProfileDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsUrl({ require_protocol: true }) websiteUrl?: string;
  @IsOptional() @IsString() facebookUrl?: string;
  @IsOptional() @IsString() instagramUrl?: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsString() phone?: string;
}

export class SubmitSourceDto {
  @IsOptional() @IsString() sourceUrl?: string;
  @IsOptional() @IsString() rawText?: string;
  @IsOptional() @IsString() screenshotBase64?: string;
  @IsOptional() @IsString() screenshotMediaType?: string;
  @IsOptional() @IsString() sourceImageUrl?: string;
  @IsOptional() @IsString() contextHint?: string;
  @IsOptional() @IsBoolean() useLlm?: boolean;
}
