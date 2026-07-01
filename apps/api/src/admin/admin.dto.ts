import { IsBoolean, IsEnum, IsInt, IsNumber, IsOptional, IsString, Min, ValidateNested } from "class-validator";
import { Type } from "class-transformer";
import { EventStatus } from "@prisma/client";
import { EventUpsertDto } from "../events/event.dto";

export class AdminEventDto extends EventUpsertDto {
  @IsOptional()
  @IsEnum(EventStatus)
  status?: EventStatus;
}

export class OrganizerAdminDto {
  @IsString()
  name!: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() websiteUrl?: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsString() phone?: string;
}

export class ManualEmailDto {
  @IsOptional() @IsString() rawEmailSubject?: string;
  @IsOptional() @IsString() rawEmailFrom?: string;
  @IsOptional() @IsString() rawText?: string;
  @IsOptional() @IsString() sourceUrl?: string;
}

export class ParseUrlDto {
  @IsString()
  sourceUrl!: string;
}

export class CandidateOverrideDto {
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() startsAt?: string;
  @IsOptional() @IsString() endsAt?: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsString() venueName?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsNumber() lat?: number;
  @IsOptional() @IsNumber() lng?: number;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsBoolean() isFree?: boolean;
  @IsOptional() @IsString() priceText?: string;
  @IsOptional() @IsString() ticketUrl?: string;
  @IsOptional() @IsString() organizerName?: string;
  @IsOptional() @IsString() imageUrl?: string;
  @IsOptional() @IsString() imageAlt?: string;
  @IsOptional() @IsString() imageCredit?: string;
  @IsOptional() @IsString() imageSourceUrl?: string;
}

export class CreateEventFromCandidateDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  candidateIndex?: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => CandidateOverrideDto)
  candidate?: CandidateOverrideDto;
}

export class IgnoreCandidateDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  candidateIndex!: number;
}
