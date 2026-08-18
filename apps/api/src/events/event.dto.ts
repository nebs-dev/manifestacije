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

export class EventUpsertDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  slug?: string;

  @Type(() => Number)
  @IsInt()
  @IsOptional()
  cityId?: number | null;

  @IsOptional()
  @IsString()
  cityName?: string;

  @IsOptional()
  @IsString()
  countyName?: string;

  @IsOptional()
  @IsString()
  regionSlug?: string;

  @Type(() => Number)
  @IsInt()
  @IsOptional()
  categoryId?: number | null;

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @Type(() => Number)
  categoryIds?: number[];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  organizerId?: number | null;

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
  @IsBoolean()
  isFeatured?: boolean;

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
