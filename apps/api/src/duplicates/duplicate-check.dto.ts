import { Type } from "class-transformer";
import { ArrayMaxSize, IsArray, IsBoolean, IsDateString, IsInt, IsOptional, IsString, MaxLength, Min, ValidateNested } from "class-validator";
import { EventOccurrenceDto } from "../events/event.dto";

export class DuplicateCheckDto {
  @IsString() @MaxLength(500) title!: string;
  @IsOptional() @IsDateString() startsAt?: string;
  @IsOptional() @IsDateString() endsAt?: string | null;
  @IsOptional() @IsBoolean() isAllDay?: boolean;
  @IsOptional() @IsArray() @ArrayMaxSize(52) @ValidateNested({ each: true }) @Type(() => EventOccurrenceDto) occurrences?: EventOccurrenceDto[];
  @IsOptional() @IsInt() @Min(1) @Type(() => Number) cityId?: number | null;
  @IsOptional() @IsString() @MaxLength(300) cityName?: string;
  @IsOptional() @IsString() @MaxLength(500) venueName?: string;
  @IsOptional() @IsString() @MaxLength(1000) address?: string;
  @IsOptional() @IsString() @MaxLength(2000) sourceUrl?: string | null;
  @IsOptional() @IsDateString() repeatWeeklyUntil?: string;
}
