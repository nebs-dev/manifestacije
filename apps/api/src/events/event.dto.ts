import { Type } from "class-transformer";
import { ArrayMinSize, IsArray, IsBoolean, IsDateString, IsInt, IsNumber, IsOptional, IsString, ValidateNested } from "class-validator";

export class EventOccurrenceDto {
  @Type(() => Number)
  @IsInt()
  @IsOptional()
  id?: number;

  @IsDateString()
  startsAt!: string;

  @IsDateString()
  @IsOptional()
  endsAt?: string | null;

  @IsBoolean()
  @IsOptional()
  isAllDay?: boolean;
}

/**
 * Event content fields any authenticated event author may supply. Organizer
 * endpoints accept exactly this shape (OrganizerEventDto); everything else on
 * an Event — owner, status, publication, featuring, slug, attribution,
 * sourceType/confidence and taxonomy (county/region) writes — is set by the
 * server or by admins only. Add a field here only if organizers may legitimately set it.
 */
export class EventContentDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @Type(() => Number)
  @IsInt()
  @IsOptional()
  cityId?: number | null;

  @IsOptional()
  @IsString()
  cityName?: string;

  @Type(() => Number)
  @IsInt()
  @IsOptional()
  categoryId?: number | null;

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @Type(() => Number)
  categoryIds?: number[];

  @IsDateString()
  @IsOptional()
  startsAt?: string;

  @IsOptional()
  @IsDateString()
  endsAt?: string | null;

  @IsOptional()
  @IsBoolean()
  isAllDay?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => EventOccurrenceDto)
  occurrences?: EventOccurrenceDto[];

  @IsOptional()
  @IsBoolean()
  isFree?: boolean;

  @IsOptional()
  @IsString()
  priceText?: string;

  @IsOptional()
  @IsString()
  ticketUrl?: string;

  @IsOptional()
  @IsString()
  sourceUrl?: string | null;

  @IsOptional()
  @IsString()
  venueName?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  lat?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  lng?: number;

  @IsOptional()
  @IsString()
  imageUrl?: string | null;
}

/** Admin-facing event shape: content fields plus admin-controlled fields. */
export class EventUpsertDto extends EventContentDto {
  @IsString()
  @IsOptional()
  slug?: string;

  @IsOptional()
  @IsString()
  countyName?: string;

  @IsOptional()
  @IsString()
  regionSlug?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  organizerId?: number | null;

  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;
}
