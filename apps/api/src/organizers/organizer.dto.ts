import { IsBoolean, IsOptional, IsString, IsUrl } from "class-validator";
import { EventContentDto } from "../events/event.dto";

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

/**
 * Body of organizer event create/update. Only content fields are accepted;
 * the owner, status and every admin-controlled field are decided on the
 * server.
 *
 * Policy for anything else in the body (organizerId, isFeatured, slug,
 * status, countyName, regionSlug, publishedAt, ...): silently ignored, as for
 * every other endpoint — the global ValidationPipe runs with
 * `whitelist: true`, and OrganizerService additionally passes the body
 * through pickOrganizerEventInput, so an unexpected field can never reach a
 * write even if the pipe configuration changes.
 */
export class OrganizerEventDto extends EventContentDto {}

/** Must list exactly the properties of OrganizerEventDto (a test enforces it). */
export const ORGANIZER_EVENT_FIELDS = [
  "title",
  "description",
  "cityId",
  "cityName",
  "categoryId",
  "categoryIds",
  "startsAt",
  "endsAt",
  "isAllDay",
  "occurrences",
  "isFree",
  "priceText",
  "ticketUrl",
  "sourceUrl",
  "venueName",
  "address",
  "lat",
  "lng",
  "imageUrl",
] as const satisfies readonly (keyof OrganizerEventDto)[];

/** Copies only allowlisted fields. Keeps a field whenever the key is present —
 *  even as null/undefined — because EventsService.updateEvent treats key
 *  presence as "change this field" (e.g. endsAt: null clears the end). */
export function pickOrganizerEventInput(input: OrganizerEventDto): OrganizerEventDto {
  const source = (input ?? {}) as Record<string, unknown>;
  const picked: Record<string, unknown> = {};
  for (const field of ORGANIZER_EVENT_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(source, field)) picked[field] = source[field];
  }
  return picked as OrganizerEventDto;
}
