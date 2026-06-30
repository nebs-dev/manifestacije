import { IsInt, IsOptional, IsString, Min } from "class-validator";
import { Type } from "class-transformer";
import { EventUpsertDto } from "../events/event.dto";

export class AdminEventDto extends EventUpsertDto {
  @IsOptional()
  @IsString()
  status?: "DRAFT" | "PENDING_REVIEW" | "PUBLISHED" | "REJECTED" | "ARCHIVED";
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

export class CreateEventFromCandidateDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  candidateIndex?: number;
}

export class IgnoreCandidateDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  candidateIndex!: number;
}
