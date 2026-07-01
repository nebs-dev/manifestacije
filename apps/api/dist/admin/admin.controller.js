"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const client_1 = require("@prisma/client");
const auth_decorators_1 = require("../auth/auth.decorators");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const admin_service_1 = require("./admin.service");
const admin_dto_1 = require("./admin.dto");
const uploads_service_1 = require("./uploads.service");
let AdminController = class AdminController {
    admin;
    uploads;
    constructor(admin, uploads) {
        this.admin = admin;
        this.uploads = uploads;
    }
    pendingEvents() { return this.admin.pendingEvents(); }
    events() { return this.admin.allEvents(); }
    createAdminEvent(dto) { return this.admin.createEvent(dto); }
    event(id) { return this.admin.event(Number(id)); }
    updateEvent(id, dto) { return this.admin.updateEvent(Number(id), dto); }
    approve(id) { return this.admin.setEventStatus(Number(id), client_1.EventStatus.PUBLISHED); }
    reject(id) { return this.admin.setEventStatus(Number(id), client_1.EventStatus.REJECTED); }
    publish(id) { return this.admin.setEventStatus(Number(id), client_1.EventStatus.PUBLISHED); }
    archive(id) { return this.admin.setEventStatus(Number(id), client_1.EventStatus.ARCHIVED); }
    deleteEvent(id) { return this.admin.deleteEvent(Number(id)); }
    organizers() { return this.admin.organizers(); }
    createOrganizer(dto) { return this.admin.createOrganizer(dto); }
    updateOrganizer(id, dto) { return this.admin.updateOrganizer(Number(id), dto); }
    verify(id) { return this.admin.setOrganizerStatus(Number(id), "VERIFIED"); }
    trust(id) { return this.admin.setOrganizerStatus(Number(id), "TRUSTED"); }
    deleteOrganizer(id) { return this.admin.deleteOrganizer(Number(id)); }
    uploadEventImage(file) {
        return this.uploads.uploadEventImage(file);
    }
    // Literal routes must be declared before parametric :id routes
    eventSources() { return this.admin.eventSources(); }
    manualEmail(dto) { return this.admin.createManualEmail(dto); }
    parseUrl(dto) { return this.admin.parseUrl(dto); }
    getEventSource(id) { return this.admin.getSource(Number(id)); }
    reparse(id) { return this.admin.reparseSource(Number(id)); }
    createEvent(id, dto) {
        return this.admin.createEventFromSource(Number(id), dto.candidateIndex ?? 0, dto.candidate);
    }
    ignoreCandidate(id, dto) {
        return this.admin.ignoreCandidate(Number(id), dto.candidateIndex);
    }
    deleteEventSource(id) { return this.admin.deleteEventSource(Number(id)); }
    duplicates() { return this.admin.duplicatesList(); }
    mergeDuplicate(id) { return this.admin.mergeDuplicate(Number(id)); }
    dismissDuplicate(id) { return this.admin.dismissDuplicate(Number(id)); }
    regions() { return this.admin.regions(); }
    categories() { return this.admin.categories(); }
};
exports.AdminController = AdminController;
__decorate([
    (0, common_1.Get)("events/pending"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "pendingEvents", null);
__decorate([
    (0, common_1.Get)("events"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "events", null);
__decorate([
    (0, common_1.Post)("events"),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [admin_dto_1.AdminEventDto]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "createAdminEvent", null);
__decorate([
    (0, common_1.Get)("events/:id"),
    __param(0, (0, common_1.Param)("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "event", null);
__decorate([
    (0, common_1.Put)("events/:id"),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, admin_dto_1.AdminEventDto]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "updateEvent", null);
__decorate([
    (0, common_1.Post)("events/:id/approve"),
    __param(0, (0, common_1.Param)("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "approve", null);
__decorate([
    (0, common_1.Post)("events/:id/reject"),
    __param(0, (0, common_1.Param)("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "reject", null);
__decorate([
    (0, common_1.Post)("events/:id/publish"),
    __param(0, (0, common_1.Param)("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "publish", null);
__decorate([
    (0, common_1.Post)("events/:id/archive"),
    __param(0, (0, common_1.Param)("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "archive", null);
__decorate([
    (0, common_1.Delete)("events/:id"),
    __param(0, (0, common_1.Param)("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "deleteEvent", null);
__decorate([
    (0, common_1.Get)("organizers"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "organizers", null);
__decorate([
    (0, common_1.Post)("organizers"),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [admin_dto_1.OrganizerAdminDto]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "createOrganizer", null);
__decorate([
    (0, common_1.Put)("organizers/:id"),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, admin_dto_1.OrganizerAdminDto]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "updateOrganizer", null);
__decorate([
    (0, common_1.Post)("organizers/:id/verify"),
    __param(0, (0, common_1.Param)("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "verify", null);
__decorate([
    (0, common_1.Post)("organizers/:id/trust"),
    __param(0, (0, common_1.Param)("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "trust", null);
__decorate([
    (0, common_1.Delete)("organizers/:id"),
    __param(0, (0, common_1.Param)("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "deleteOrganizer", null);
__decorate([
    (0, common_1.Post)("uploads/event-image"),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)("file", { limits: { fileSize: 5 * 1024 * 1024 } })),
    __param(0, (0, common_1.UploadedFile)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "uploadEventImage", null);
__decorate([
    (0, common_1.Get)("event-sources"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "eventSources", null);
__decorate([
    (0, common_1.Post)("event-sources/manual-email"),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [admin_dto_1.ManualEmailDto]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "manualEmail", null);
__decorate([
    (0, common_1.Post)("event-sources/parse-url"),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [admin_dto_1.ParseUrlDto]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "parseUrl", null);
__decorate([
    (0, common_1.Get)("event-sources/:id"),
    __param(0, (0, common_1.Param)("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "getEventSource", null);
__decorate([
    (0, common_1.Post)("event-sources/:id/reparse"),
    __param(0, (0, common_1.Param)("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "reparse", null);
__decorate([
    (0, common_1.Post)("event-sources/:id/create-event"),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, admin_dto_1.CreateEventFromCandidateDto]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "createEvent", null);
__decorate([
    (0, common_1.Post)("event-sources/:id/ignore-candidate"),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, admin_dto_1.IgnoreCandidateDto]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "ignoreCandidate", null);
__decorate([
    (0, common_1.Delete)("event-sources/:id"),
    __param(0, (0, common_1.Param)("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "deleteEventSource", null);
__decorate([
    (0, common_1.Get)("duplicates"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "duplicates", null);
__decorate([
    (0, common_1.Post)("duplicates/:id/merge"),
    __param(0, (0, common_1.Param)("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "mergeDuplicate", null);
__decorate([
    (0, common_1.Post)("duplicates/:id/dismiss"),
    __param(0, (0, common_1.Param)("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "dismissDuplicate", null);
__decorate([
    (0, common_1.Get)("regions"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "regions", null);
__decorate([
    (0, common_1.Get)("categories"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "categories", null);
exports.AdminController = AdminController = __decorate([
    (0, common_1.Controller)("admin"),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, auth_decorators_1.Roles)(client_1.UserRole.ADMIN),
    __metadata("design:paramtypes", [admin_service_1.AdminService, uploads_service_1.UploadsService])
], AdminController);
