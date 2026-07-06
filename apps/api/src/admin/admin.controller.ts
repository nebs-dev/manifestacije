import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { EventStatus, UserRole } from "@prisma/client";
import { Roles } from "../auth/auth.decorators";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { AdminService } from "./admin.service";
import { AdminEventDto, CategoryDto, CityDto, CountyDto, CreateEventFromCandidateDto, IgnoreCandidateDto, ManualEmailDto, OrganizerAdminDto, ParseUrlDto, RegionDto, ResetPasswordDto, UpdateEventSourceDto } from "./admin.dto";
import { UploadsService } from "./uploads.service";

@Controller("admin")
@UseGuards(JwtAuthGuard)
@Roles(UserRole.ADMIN)
export class AdminController {
  constructor(private readonly admin: AdminService, private readonly uploads: UploadsService) {}

  @Get("pending-counts") pendingCounts(@Query("since") since?: string) { return this.admin.pendingCounts(since); }
  @Post("events/bulk-categories") bulkCategories(@Body() body: { eventIds: number[]; categoryId: number; action: "add" | "remove" }) { return this.admin.bulkAssignCategory(body.eventIds, body.categoryId, body.action); }
  @Get("events/pending") pendingEvents() { return this.admin.pendingEvents(); }
  @Get("events") events() { return this.admin.allEvents(); }
  @Post("events") createAdminEvent(@Body() dto: AdminEventDto) { return this.admin.createEvent(dto); }
  @Get("events/:id") event(@Param("id") id: string) { return this.admin.event(Number(id)); }
  @Put("events/:id") updateEvent(@Param("id") id: string, @Body() dto: AdminEventDto) { return this.admin.updateEvent(Number(id), dto); }
  @Post("events/:id/approve") approve(@Param("id") id: string) { return this.admin.setEventStatus(Number(id), EventStatus.PUBLISHED); }
  @Post("events/:id/reject") reject(@Param("id") id: string) { return this.admin.setEventStatus(Number(id), EventStatus.REJECTED); }
  @Post("events/:id/publish") publish(@Param("id") id: string) { return this.admin.setEventStatus(Number(id), EventStatus.PUBLISHED); }
  @Post("events/:id/archive") archive(@Param("id") id: string) { return this.admin.setEventStatus(Number(id), EventStatus.ARCHIVED); }
  @Post("events/:id/duplicate") duplicateEvent(@Param("id") id: string) { return this.admin.duplicateEvent(Number(id)); }
  @Delete("events/:id") deleteEvent(@Param("id") id: string) { return this.admin.deleteEvent(Number(id)); }

  @Get("organizers") organizers() { return this.admin.organizers(); }
  @Post("organizers") createOrganizer(@Body() dto: OrganizerAdminDto) { return this.admin.createOrganizer(dto); }
  @Put("organizers/:id") updateOrganizer(@Param("id") id: string, @Body() dto: OrganizerAdminDto) { return this.admin.updateOrganizer(Number(id), dto); }
  @Post("organizers/:id/verify") verify(@Param("id") id: string) { return this.admin.setOrganizerStatus(Number(id), "VERIFIED"); }
  @Post("organizers/:id/trust") trust(@Param("id") id: string) { return this.admin.setOrganizerStatus(Number(id), "TRUSTED"); }
  @Post("organizers/:id/reset-password") resetPassword(@Param("id") id: string, @Body() dto: ResetPasswordDto) { return this.admin.resetOrganizerPassword(Number(id), dto.password); }
  @Delete("organizers/:id") deleteOrganizer(@Param("id") id: string) { return this.admin.deleteOrganizer(Number(id)); }

  @Post("uploads/event-image")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 5 * 1024 * 1024 } }))
  uploadEventImage(@UploadedFile() file: unknown) {
    return this.uploads.uploadEventImage(file as never);
  }

  // Literal routes must be declared before parametric :id routes
  @Get("event-sources") eventSources() { return this.admin.eventSources(); }
  @Post("event-sources/manual-email") manualEmail(@Body() dto: ManualEmailDto) { return this.admin.createManualEmail(dto); }
  @Post("event-sources/parse-url") parseUrl(@Body() dto: ParseUrlDto) { return this.admin.parseUrl(dto); }
  @Get("event-sources/:id") getEventSource(@Param("id") id: string) { return this.admin.getSource(Number(id)); }
  @Put("event-sources/:id") updateEventSource(@Param("id") id: string, @Body() dto: UpdateEventSourceDto) { return this.admin.updateEventSource(Number(id), dto); }
  @Post("event-sources/:id/reparse") reparse(@Param("id") id: string) { return this.admin.reparseSource(Number(id)); }
  @Post("event-sources/:id/create-event") createEvent(@Param("id") id: string, @Body() dto: CreateEventFromCandidateDto) {
    return this.admin.createEventFromSource(Number(id), dto.candidateIndex ?? 0, dto.candidate, dto.publish ?? false);
  }
  @Post("event-sources/:id/ignore-candidate") ignoreCandidate(@Param("id") id: string, @Body() dto: IgnoreCandidateDto) {
    return this.admin.ignoreCandidate(Number(id), dto.candidateIndex);
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

  @Get("venues/search") searchVenues(@Query("q") q: string) { return this.admin.searchVenues(q ?? ""); }

  @Get("categories") categories() { return this.admin.categories(); }
  @Post("categories") createCategory(@Body() dto: CategoryDto) { return this.admin.createCategory(dto); }
  @Put("categories/:id") updateCategory(@Param("id") id: string, @Body() dto: CategoryDto) { return this.admin.updateCategory(Number(id), dto); }
  @Delete("categories/:id") deleteCategory(@Param("id") id: string) { return this.admin.deleteCategory(Number(id)); }
}
