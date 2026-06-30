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
const client_1 = require("@prisma/client");
const auth_decorators_1 = require("../auth/auth.decorators");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const admin_service_1 = require("./admin.service");
const admin_dto_1 = require("./admin.dto");
let AdminController = class AdminController {
    admin;
    constructor(admin) {
        this.admin = admin;
    }
    pendingEvents() { return this.admin.pendingEvents(); }
    events() { return this.admin.allEvents(); }
    event(id) { return this.admin.event(Number(id)); }
    updateEvent(id, dto) { return this.admin.updateEvent(Number(id), dto); }
    approve(id) { return this.admin.setEventStatus(Number(id), client_1.EventStatus.PENDING_REVIEW); }
    reject(id) { return this.admin.setEventStatus(Number(id), client_1.EventStatus.REJECTED); }
    publish(id) { return this.admin.setEventStatus(Number(id), client_1.EventStatus.PUBLISHED); }
    archive(id) { return this.admin.setEventStatus(Number(id), client_1.EventStatus.ARCHIVED); }
    organizers() { return this.admin.organizers(); }
    createOrganizer(dto) { return this.admin.createOrganizer(dto); }
    updateOrganizer(id, dto) { return this.admin.updateOrganizer(Number(id), dto); }
    verify(id) { return this.admin.setOrganizerStatus(Number(id), "VERIFIED"); }
    trust(id) { return this.admin.setOrganizerStatus(Number(id), "TRUSTED"); }
    eventSources() { return this.admin.eventSources(); }
    manualEmail(dto) { return this.admin.createManualEmail(dto); }
    parseUrl(dto) { return this.admin.parseUrl(dto); }
    reparse(id) { return this.admin.reparseSource(Number(id)); }
    createEvent(id) { return this.admin.createEventFromSource(Number(id)); }
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
    __metadata("design:paramtypes", [admin_dto_1.ManualEmailDto]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "parseUrl", null);
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
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "createEvent", null);
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
    __metadata("design:paramtypes", [admin_service_1.AdminService])
], AdminController);
