import { IsArray, IsBoolean, IsDateString, IsEnum, IsInt, IsNumber, IsOptional, IsString, Min, MinLength, ValidateNested } from "class-validator";
import { Type } from "class-transformer";
import { EventStatus } from "@prisma/client";
import { EventUpsertDto } from "../events/event.dto";

export class AdminEventDto extends EventUpsertDto {
  @IsOptional()
  @IsEnum(EventStatus)
  status?: EventStatus;

  /** Creates one event per week on startsAt's weekday, up to and including
   *  this date, instead of a single event spanning the whole range — see
   *  AdminService.createEvent. */
  @IsOptional()
  @IsDateString()
  repeatWeeklyUntil?: string;
}

export class BulkStatusDto {
  @IsArray() @IsInt({ each: true }) @Type(() => Number) eventIds!: number[];
  @IsEnum(EventStatus) status!: EventStatus;
}

export class BulkShiftDatesDto {
  @IsArray() @IsInt({ each: true }) @Type(() => Number) eventIds!: number[];
  @IsInt() days!: number;
}

export class ResetPasswordDto {
  @IsString()
  @MinLength(8)
  password!: string;
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
  @IsOptional() @IsBoolean() useLlm?: boolean;
  @IsOptional() @IsString() screenshotBase64?: string;
  @IsOptional() @IsString() screenshotMediaType?: string;
  @IsOptional() @IsString() contextHint?: string;
}

export class ParseUrlDto {
  @IsString()
  sourceUrl!: string;

  @IsOptional()
  @IsBoolean()
  useLlm?: boolean;
}

export class CandidateOverrideDto {
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() startsAt?: string;
  @IsOptional() @IsString() endsAt?: string;
  @IsOptional() @IsBoolean() isAllDay?: boolean;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsString() countyName?: string;
  @IsOptional() @IsString() regionSlug?: string;
  @IsOptional() @IsString() venueName?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsNumber() lat?: number;
  @IsOptional() @IsNumber() lng?: number;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsArray() @IsInt({ each: true }) @Type(() => Number) categoryIds?: number[];
  @IsOptional() @IsBoolean() isFree?: boolean;
  @IsOptional() @IsBoolean() isFeatured?: boolean;
  @IsOptional() @IsString() priceText?: string;
  @IsOptional() @IsString() ticketUrl?: string;
  @IsOptional() @IsString() sourceUrl?: string | null;
  @IsOptional() @IsString() organizerName?: string;
  @IsOptional() @IsString() imageUrl?: string;
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

  @IsOptional()
  @IsBoolean()
  publish?: boolean;
}

export class IgnoreCandidateDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  candidateIndex!: number;
}

export class UpdateEventSourceDto {
  @IsOptional() @IsString() sourceUrl?: string | null;
}

export class CategoryDto {
  @IsString() name!: string;
  @IsString() slug!: string;
  @IsOptional() @IsInt() @Min(0) sortOrder?: number;
}

export class CityDto {
  @IsString() name!: string;
  @IsString() slug!: string;
  @IsInt() countyId!: number;
  @IsOptional() @IsNumber() lat?: number;
  @IsOptional() @IsNumber() lng?: number;
}

export class CountyDto {
  @IsString() name!: string;
  @IsString() slug!: string;
  @IsInt() regionId!: number;
}

export class RegionDto {
  @IsString() name!: string;
  @IsString() slug!: string;
  @IsOptional() @IsInt() @Min(0) sortOrder?: number;
}

export class PartnerDto {
  @IsString() name!: string;
  @IsString() logoUrl!: string;
  @IsOptional() @IsString() websiteUrl?: string;
  @IsOptional() @IsInt() @Min(0) sortOrder?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
