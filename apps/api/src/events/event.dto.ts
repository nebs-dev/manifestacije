import { Type } from "class-transformer";
import { IsArray, IsBoolean, IsDateString, IsInt, IsNumber, IsOptional, IsString } from "class-validator";

export class EventUpsertDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsOptional()
  @IsString()
  shortDescription?: string;

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

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  organizerId?: number | null;

  @IsDateString()
  @IsOptional()
  startsAt?: string;

  @IsOptional()
  @IsDateString()
  endsAt?: string;

  @IsOptional()
  @IsBoolean()
  isAllDay?: boolean;

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

  @IsOptional()
  @IsString()
  imageAlt?: string | null;

  @IsOptional()
  @IsString()
  imageCredit?: string | null;

  @IsOptional()
  @IsString()
  imageSourceUrl?: string | null;
}
