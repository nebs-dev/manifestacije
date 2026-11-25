import { Body, Controller, Delete, Get, Header, NotFoundException, Param, Patch, Post, Put, Query, UploadedFile, UseGuards, UseInterceptors , ParseIntPipe } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { EventStatus, UserRole } from "@prisma/client";
import { CurrentUser, Roles } from "../auth/auth.decorators";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { AuthUser } from "../auth/auth.types";
import { AdminService, AdminEventListParams } from "./admin.service";
import { AdminEventDto, BulkShiftDatesDto, BulkStatusDto, CategoryDto, CityDto, CountyDto, CreateEventFromCandidateDto, IgnoreCandidateDto, IgnoreCandidatesDto, ManualEmailDto, MergeVenuesDto, OrganizerAdminDto, PartnerDto, ParseUrlDto, RegionDto, ResetPasswordDto, SplitWeeklySeriesDto, UpdateEventSourceDto , SupplementDto } from "./admin.dto";
import { UploadsService } from "./uploads.service";
import { OrganizerClaimService } from "../organizer-claims/organizer-claim.service";
import { EventPreviewService } from "../events/event-preview.service";
import { RejectOrganizerClaimDto, BulkInviteUnclaimedDto } from "../organizer-claims/organizer-claim.dto";

@Controller("admin")
@UseGuards(JwtAuthGuard)
@Roles(UserRole.ADMIN)
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly uploads: UploadsService,
    private readonly claims: OrganizerClaimService,
    private readonly preview: EventPreviewService
  ) {}

  @Get("pending-counts") @Header("Cache-Control", "private, no-store") pendingCounts(@CurrentUser() user: AuthUser) { return this.admin.pendingCounts(user.id); }
  @Post("events/bulk-categories") bulkCategories(@Body() body: { eventIds: number[]; categoryId: number; action: "add" | "remove" }) { return this.admin.bulkAssignCategory(body.eventIds, body.categoryId, body.action); }
  @Post("events/bulk-status") bulkStatus(@CurrentUser() user: AuthUser, @Body() dto: BulkStatusDto) { return this.admin.bulkSetStatus(dto.eventIds, dto.status, user.id); }
  @Post("events/bulk-shift-dates") bulkShiftDates(@Body() dto: BulkShiftDatesDto) { return this.admin.bulkShiftDates(dto.eventIds, dto.days); }
  @Get("events/pending") pendingEvents(
    @Query("sortBy") sortBy?: string,
    @Query("sortDir") sortDir?: string,
    @Query("search") search?: string,
    @Query("organizerId") organizerId?: string,
    @Query("createdByUserId") createdByUserId?: string,
    @Query("startsFrom") startsFrom?: string,
    @Query("startsTo") startsTo?: string,
    @Query("createdFrom") createdFrom?: string,
    @Query("createdTo") createdTo?: string,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
    @Query("fieldFilters") fieldFilters?: string,
  ) { return this.admin.pendingEvents({ sortBy, sortDir, search, organizerId, createdByUserId, startsFrom, startsTo, createdFrom, createdTo, page, pageSize, fieldFilters }); }
  @Get("events") events(
    @Query("sortBy") sortBy?: string,
    @Query("sortDir") sortDir?: string,
    @Query("search") search?: string,
    @Query("status") status?: string,
    @Query("organizerId") organizerId?: string,
    @Query("createdByUserId") createdByUserId?: string,
    @Query("startsFrom") startsFrom?: string,
    @Query("startsTo") startsTo?: string,
    @Query("createdFrom") createdFrom?: string,
    @Query("createdTo") createdTo?: string,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
    @Query("fieldFilters") fieldFilters?: string,
  ) { return this.admin.allEvents({ sortBy, sortDir, search, status, organizerId, createdByUserId, startsFrom, startsTo, createdFrom, createdTo, page, pageSize, fieldFilters }); }
  @Get("events/creator-report") eventCreatorReport(@Query() params: AdminEventListParams) { return this.admin.eventCreatorReport(params); }
  @Post("events") createAdminEvent(@CurrentUser() user: AuthUser, @Body() dto: AdminEventDto) { return this.admin.createEvent(dto, user.id); }
  @Get("events/:id") @Header("Cache-Control", "private, no-store") async event(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    const event = await this.admin.event(Number(id));
    if (event) await this.admin.markItemViewed(user.id, "event", Number(id));
    return event;
  }
  /** A link that opens an unpublished event on its real public page. */
  @Post("events/:id/preview-link") @Header("Cache-Control", "private, no-store") async previewLink(@Param("id", ParseIntPipe) id: number) {
    const event = await this.admin.event(id);
    if (!event) throw new NotFoundException("Događaj nije pronađen");
    return { slug: event.slug, token: this.preview.sign(event), expiresInMinutes: this.preview.expiresInMinutes };
  }
  @Put("events/:id") updateEvent(@Param("id") id: string, @Body() dto: AdminEventDto) { return this.admin.updateEvent(Number(id), dto); }
  @Post("events/:id/approve") approve(@CurrentUser() user: AuthUser, @Param("id") id: string) { return this.admin.setEventStatus(Number(id), EventStatus.PUBLISHED, user.id); }
  @Post("events/:id/reject") reject(@CurrentUser() user: AuthUser, @Param("id") id: string) { return this.admin.setEventStatus(Number(id), EventStatus.REJECTED, user.id); }
  @Post("events/:id/publish") publish(@CurrentUser() user: AuthUser, @Param("id") id: string) { return this.admin.setEventStatus(Number(id), EventStatus.PUBLISHED, user.id); }
  @Post("events/:id/archive") archive(@CurrentUser() user: AuthUser, @Param("id") id: string) { return this.admin.setEventStatus(Number(id), EventStatus.ARCHIVED, user.id); }
  @Post("events/:id/duplicate") duplicateEvent(@CurrentUser() user: AuthUser, @Param("id") id: string) { return this.admin.duplicateEvent(Number(id), user.id); }
  @Post("events/:id/split-weekly") splitWeekly(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: SplitWeeklySeriesDto) { return this.admin.splitIntoWeeklySeries(Number(id), dto, user.id); }
  @Delete("events/:id") deleteEvent(@CurrentUser() user: AuthUser, @Param("id") id: string) { return this.admin.deleteEvent(Number(id), user.id); }

  @Get("organizers") @Header("Cache-Control", "private, no-store") organizers(@CurrentUser() user: AuthUser) { return this.admin.organizers(user.id); }
  @Get("organizers/:id") @Header("Cache-Control", "private, no-store") async organizer(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    const organizer = await this.admin.organizer(Number(id));
    await this.admin.markItemViewed(user.id, "organizer", Number(id));
    return organizer;
  }
  @Post("organizers") createOrganizer(@Body() dto: OrganizerAdminDto) { return this.admin.createOrganizer(dto); }
  @Put("organizers/:id") updateOrganizer(@Param("id") id: string, @Body() dto: OrganizerAdminDto) { return this.admin.updateOrganizer(Number(id), dto); }
  @Post("organizers/:id/verify") verify(@Param("id") id: string) { return this.admin.setOrganizerStatus(Number(id), "VERIFIED"); }
  @Post("organizers/:id/trust") trust(@Param("id") id: string) { return this.admin.setOrganizerStatus(Number(id), "TRUSTED"); }
  @Post("organizers/:id/reset-password") resetPassword(@Param("id") id: string, @Body() dto: ResetPasswordDto) { return this.admin.resetOrganizerPassword(Number(id), dto.password); }
  @Post("organizers/:id/send-claim-invite") sendClaimInvite(@Param("id") id: string) { return this.claims.sendClaimInvite(Number(id)); }
  @Post("organizers/bulk-invite-unclaimed") bulkInviteUnclaimed(@Body() dto: BulkInviteUnclaimedDto) { return this.claims.bulkInviteUnclaimedOrganizers({ limit: dto.limit }); }
  @Delete("organizers/:id") deleteOrganizer(@Param("id") id: string) { return this.admin.deleteOrganizer(Number(id)); }

  @Get("users") users() { return this.admin.users(); }
  @Delete("users/:id") deleteUser(@CurrentUser() user: AuthUser, @Param("id") id: string) { return this.admin.deleteUser(Number(id), user.id); }

  @Get("organizer-claims") organizerClaims() { return this.claims.listClaims(); }
  @Post("organizer-claims/:id/approve") approveClaim(@Param("id") id: string) { return this.claims.approveClaim(Number(id)); }
  @Post("organizer-claims/:id/reject") rejectClaim(@Param("id") id: string, @Body() dto: RejectOrganizerClaimDto) { return this.claims.rejectClaim(Number(id), dto.internalReason); }

  @Post("uploads/event-image")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 5 * 1024 * 1024 } }))
  uploadEventImage(@UploadedFile() file: unknown) {
    return this.uploads.uploadEventImage(file as never);
  }

  @Post("uploads/partner-logo")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 5 * 1024 * 1024 } }))
  uploadPartnerLogo(@UploadedFile() file: unknown) {
    return this.uploads.uploadPartnerLogo(file as never);
  }

  // Literal routes must be declared before parametric :id routes
  @Get("event-sources") @Header("Cache-Control", "private, no-store") eventSources(
    @CurrentUser() user: AuthUser,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
    @Query("type") type?: string,
    @Query("status") status?: string,
    @Query("actionable") actionable?: string,
    @Query("unviewed") unviewed?: string,
    @Query("q") q?: string,
  ) {
    return this.admin.eventSources(
      { page, pageSize, type, status, actionable: actionable === "true", unviewed: unviewed === "true", q },
      user.id,
    );
  }
  @Post("event-sources/manual-email") manualEmail(@Body() dto: ManualEmailDto) { return this.admin.createManualEmail(dto); }
  @Post("event-sources/parse-url") parseUrl(@Body() dto: ParseUrlDto) { return this.admin.parseUrl(dto); }
  @Get("event-sources/:id") @Header("Cache-Control", "private, no-store") async getEventSource(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    const source = await this.admin.getSource(Number(id));
    if (source) await this.admin.markItemViewed(user.id, "source", Number(id));
    return source;
  }
  @Put("event-sources/:id") updateEventSource(@Param("id") id: string, @Body() dto: UpdateEventSourceDto) { return this.admin.updateEventSource(Number(id), dto); }
  @Post("event-sources/:id/reparse") reparse(@Param("id") id: string) { return this.admin.reparseSource(Number(id)); }
  @Post("event-sources/:id/supplement") supplementSource(@CurrentUser() user: AuthUser, @Param("id", ParseIntPipe) id: number, @Body() dto: SupplementDto) {
    return this.admin.supplementSource(id, dto, user.id);
  }
  @Post("events/:id/supplement-parse") supplementEvent(@CurrentUser() user: AuthUser, @Param("id", ParseIntPipe) id: number, @Body() dto: SupplementDto) {
    return this.admin.supplementEvent(id, dto, user.id);
  }
  @Post("event-sources/:id/create-event") createEvent(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: CreateEventFromCandidateDto) {
    return this.admin.createEventFromSource(Number(id), dto.candidateIndex ?? 0, dto.candidate, dto.publish ?? false, user.id);
  }
  @Post("event-sources/:id/ignore-candidates") ignoreCandidates(@Param("id") id: string, @Body() dto: IgnoreCandidatesDto) {
    return this.admin.ignoreCandidates(Number(id), dto.candidateIndexes);
  }
  @Post("event-sources/:id/ignore-candidate") ignoreCandidate(@Param("id") id: string, @Body() dto: IgnoreCandidateDto) {
    return this.admin.ignoreCandidate(Number(id), dto.candidateIndex, dto.undo ?? false);
  }
  @Delete("event-sources/:id") deleteEventSource(@Param("id") id: string) { return this.admin.deleteEventSource(Number(id)); }

  @Get("duplicates") duplicates() { return this.admin.duplicatesList(); }
  @Post("duplicates/:id/merge") mergeDuplicate(@Param("id") id: string) { return this.admin.mergeDuplicate(Number(id)); }
  @Post("duplicates/:id/dismiss") dismissDuplicate(@Param("id") id: string) { return this.admin.dismissDuplicate(Number(id)); }

  @Get("regions") regions() { return this.admin.regions(); }
  @Post("regions") createRegion(@Body() dto: RegionDto) { return this.admin.createRegion(dto); }
  @Delete("regions/:id") deleteRegion(@Param("id") id: string) { return this.admin.deleteRegion(Number(id)); }

  @Post("counties") createCounty(@Body() dto: CountyDto) { return this.admin.createCounty(dto); }
  @Delete("counties/:id") deleteCounty(@Param("id") id: string) { return this.admin.deleteCounty(Number(id)); }

  @Post("cities") createCity(@Body() dto: CityDto) { return this.admin.createCity(dto); }
  @Put("cities/:id") updateCity(@Param("id") id: string, @Body() dto: CityDto) { return this.admin.updateCity(Number(id), dto); }
  @Delete("cities/:id") deleteCity(@Param("id") id: string) { return this.admin.deleteCity(Number(id)); }

  @Get("stats/entries") @Header("Cache-Control", "private, no-store") entryStats(
    @Query("preset") preset?: string,
    @Query("month") month?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ) { return this.admin.entryStats({ preset, month, from, to }); }

  @Get("stats/trends") @Header("Cache-Control", "private, no-store") entryTrends(@Query("months") months?: string) {
    return this.admin.entryTrends({ months: months ? Number(months) : undefined });
  }

  @Get("stats/content") @Header("Cache-Control", "private, no-store") contentStats(
    @Query("preset") preset?: string,
    @Query("month") month?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ) { return this.admin.contentStats({ preset, month, from, to }); }

  @Get("stats/entries/day") @Header("Cache-Control", "private, no-store") entryTimeline(
    @Query("date") date: string,
    @Query("userId") userId?: string,
    @Query("gapCapMinutes") gapCapMinutes?: string,
  ) {
    return this.admin.entryTimeline({
      date: date ?? "",
      userId: userId ? Number(userId) : undefined,
      gapCapMinutes: gapCapMinutes ? Number(gapCapMinutes) : null,
    });
  }

  @Get("venues") @Header("Cache-Control", "private, no-store") venues(@Query("search") search?: string) { return this.admin.venues({ search }); }
  @Get("venues/duplicates") @Header("Cache-Control", "private, no-store") venueDuplicates() { return this.admin.venueDuplicates(); }
  @Post("venues/:id/merge") mergeVenues(@Param("id", ParseIntPipe) id: number, @Body() dto: MergeVenuesDto) {
    return this.admin.mergeVenues(id, dto.intoId);
  }

  @Get("venues/search") searchVenues(@Query("q") q: string, @Query("city") city?: string) { return this.admin.searchVenues(q ?? "", { cityName: city }); }

  @Get("categories") categories() { return this.admin.categories(); }
  @Post("categories") createCategory(@Body() dto: CategoryDto) { return this.admin.createCategory(dto); }
  @Put("categories/:id") updateCategory(@Param("id") id: string, @Body() dto: CategoryDto) { return this.admin.updateCategory(Number(id), dto); }
  @Delete("categories/:id") deleteCategory(@Param("id") id: string) { return this.admin.deleteCategory(Number(id)); }

  @Get("partners") partners() { return this.admin.partners(); }
  @Post("partners") createPartner(@Body() dto: PartnerDto) { return this.admin.createPartner(dto); }
  @Put("partners/:id") updatePartner(@Param("id") id: string, @Body() dto: PartnerDto) { return this.admin.updatePartner(Number(id), dto); }
  @Delete("partners/:id") deletePartner(@Param("id") id: string) { return this.admin.deletePartner(Number(id)); }
}
