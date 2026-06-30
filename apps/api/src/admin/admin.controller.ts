import { Body, Controller, Get, Param, Post, Put, UseGuards } from "@nestjs/common";
import { EventStatus, UserRole } from "@prisma/client";
import { Roles } from "../auth/auth.decorators";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { AdminService } from "./admin.service";
import { AdminEventDto, ManualEmailDto, OrganizerAdminDto } from "./admin.dto";

@Controller("admin")
@UseGuards(JwtAuthGuard)
@Roles(UserRole.ADMIN)
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get("events/pending") pendingEvents() { return this.admin.pendingEvents(); }
  @Get("events") events() { return this.admin.allEvents(); }
  @Get("events/:id") event(@Param("id") id: string) { return this.admin.event(Number(id)); }
  @Put("events/:id") updateEvent(@Param("id") id: string, @Body() dto: AdminEventDto) { return this.admin.updateEvent(Number(id), dto); }
  @Post("events/:id/approve") approve(@Param("id") id: string) { return this.admin.setEventStatus(Number(id), EventStatus.PENDING_REVIEW); }
  @Post("events/:id/reject") reject(@Param("id") id: string) { return this.admin.setEventStatus(Number(id), EventStatus.REJECTED); }
  @Post("events/:id/publish") publish(@Param("id") id: string) { return this.admin.setEventStatus(Number(id), EventStatus.PUBLISHED); }
  @Post("events/:id/archive") archive(@Param("id") id: string) { return this.admin.setEventStatus(Number(id), EventStatus.ARCHIVED); }

  @Get("organizers") organizers() { return this.admin.organizers(); }
  @Post("organizers") createOrganizer(@Body() dto: OrganizerAdminDto) { return this.admin.createOrganizer(dto); }
  @Put("organizers/:id") updateOrganizer(@Param("id") id: string, @Body() dto: OrganizerAdminDto) { return this.admin.updateOrganizer(Number(id), dto); }
  @Post("organizers/:id/verify") verify(@Param("id") id: string) { return this.admin.setOrganizerStatus(Number(id), "VERIFIED"); }
  @Post("organizers/:id/trust") trust(@Param("id") id: string) { return this.admin.setOrganizerStatus(Number(id), "TRUSTED"); }

  @Get("event-sources") eventSources() { return this.admin.eventSources(); }
  @Post("event-sources/manual-email") manualEmail(@Body() dto: ManualEmailDto) { return this.admin.createManualEmail(dto); }
  @Post("event-sources/parse-url") parseUrl(@Body() dto: ManualEmailDto) { return this.admin.parseUrl(dto); }
  @Post("event-sources/:id/reparse") reparse(@Param("id") id: string) { return this.admin.reparseSource(Number(id)); }
  @Post("event-sources/:id/create-event") createEvent(@Param("id") id: string) { return this.admin.createEventFromSource(Number(id)); }

  @Get("duplicates") duplicates() { return this.admin.duplicatesList(); }
  @Post("duplicates/:id/merge") mergeDuplicate(@Param("id") id: string) { return this.admin.mergeDuplicate(Number(id)); }
  @Post("duplicates/:id/dismiss") dismissDuplicate(@Param("id") id: string) { return this.admin.dismissDuplicate(Number(id)); }

  @Get("regions") regions() { return this.admin.regions(); }
  @Get("categories") categories() { return this.admin.categories(); }
}
