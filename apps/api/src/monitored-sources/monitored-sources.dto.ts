import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Min, MinLength } from "class-validator";
import { MonitoredSourceType } from "@prisma/client";

export class CreateMonitoredSourceDto {
  @IsString() @MinLength(1) name!: string;
  @IsString() url!: string;
  @IsEnum(MonitoredSourceType) sourceType!: MonitoredSourceType;
  @IsOptional() @IsInt() organizerId?: number;
  @IsOptional() @IsInt() @Min(15) checkIntervalMinutes?: number;
}

export class UpdateMonitoredSourceDto {
  @IsOptional() @IsString() @MinLength(1) name?: string;
  @IsOptional() @IsString() url?: string;
  @IsOptional() @IsEnum(MonitoredSourceType) sourceType?: MonitoredSourceType;
  @IsOptional() @IsInt() organizerId?: number | null;
  @IsOptional() @IsInt() @Min(15) checkIntervalMinutes?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
