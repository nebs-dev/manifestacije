import { IsOptional, IsString } from "class-validator";
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
  @IsString() rawText!: string;
  @IsOptional() @IsString() sourceUrl?: string;
}
