import { Body, Controller, Delete, Get, Param, Post, Put, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { EventStatus, UserRole } from "@prisma/client";
import { Roles } from "../auth/auth.decorators";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { AdminService } from "./admin.service";
import { AdminEventDto, CreateEventFromCandidateDto, IgnoreCandidateDto, ManualEmailDto, OrganizerAdminDto, ParseUrlDto } from "./admin.dto";
import { UploadsService } from "./uploads.service";

@Controller("admin")
@UseGuards(JwtAuthGuard)
@Roles(UserRole.ADMIN)
export class AdminController {
  constructor(private readonly admin: AdminService, private readonly uploads: UploadsService) {}

  @Get("events/pending") pendingEvents() { return this.admin.pendingEvents(); }
  @Get("events") events() { return this.admin.allEvents(); }
  @Post("events") createAdminEvent(@Body() dto: AdminEventDto) { return this.admin.createEvent(dto); }
  @Get("events/:id") event(@Param("id") id: string) { return this.admin.event(Number(id)); }
  @Put("events/:id") updateEvent(@Param("id") id: string, @Body() dto: AdminEventDto) { return this.admin.updateEvent(Number(id), dto); }
  @Post("events/:id/approve") approve(@Param("id") id: string) { return this.admin.setEventStatus(Number(id), EventStatus.PENDING_REVIEW); }
  @Post("events/:id/reject") reject(@Param("id") id: string) { return this.admin.setEventStatus(Number(id), EventStatus.REJECTED); }
  @Post("events/:id/publish") publish(@Param("id") id: string) { return this.admin.setEventStatus(Number(id), EventStatus.PUBLISHED); }
  @Post("events/:id/archive") archive(@Param("id") id: string) { return this.admin.setEventStatus(Number(id), EventStatus.ARCHIVED); }
  @Delete("events/:id") deleteEvent(@Param("id") id: string) { return this.admin.deleteEvent(Number(id)); }

  @Get("organizers") organizers() { return this.admin.organizers(); }
  @Post("organizers") createOrganizer(@Body() dto: OrganizerAdminDto) { return this.admin.createOrganizer(dto); }
  @Put("organizers/:id") updateOrganizer(@Param("id") id: string, @Body() dto: OrganizerAdminDto) { return this.admin.updateOrganizer(Number(id), dto); }
  @Post("organizers/:id/verify") verify(@Param("id") id: string) { return this.admin.setOrganizerStatus(Number(id), "VERIFIED"); }
  @Post("organizers/:id/trust") trust(@Param("id") id: string) { return this.admin.setOrganizerStatus(Number(id), "TRUSTED"); }
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
  @Post("event-sources/:id/reparse") reparse(@Param("id") id: string) { return this.admin.reparseSource(Number(id)); }
  @Post("event-sources/:id/create-event") createEvent(@Param("id") id: string, @Body() dto: CreateEventFromCandidateDto) {
    return this.admin.createEventFromSource(Number(id), dto.candidateIndex ?? 0, dto.candidate);
  }
  @Post("event-sources/:id/ignore-candidate") ignoreCandidate(@Param("id") id: string, @Body() dto: IgnoreCandidateDto) {
    return this.admin.ignoreCandidate(Number(id), dto.candidateIndex);
  }
  @Delete("event-sources/:id") deleteEventSource(@Param("id") id: string) { return this.admin.deleteEventSource(Number(id)); }

  @Get("duplicates") duplicates() { return this.admin.duplicatesList(); }
  @Post("duplicates/:id/merge") mergeDuplicate(@Param("id") id: string) { return this.admin.mergeDuplicate(Number(id)); }
  @Post("duplicates/:id/dismiss") dismissDuplicate(@Param("id") id: string) { return this.admin.dismissDuplicate(Number(id)); }

  @Get("regions") regions() { return this.admin.regions(); }
  @Get("categories") categories() { return this.admin.categories(); }
}
