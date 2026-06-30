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
exports.OrganizerController = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const auth_decorators_1 = require("../auth/auth.decorators");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const event_dto_1 = require("../events/event.dto");
const organizer_dto_1 = require("./organizer.dto");
const organizer_service_1 = require("./organizer.service");
let OrganizerController = class OrganizerController {
    organizer;
    constructor(organizer) {
        this.organizer = organizer;
    }
    profile(user) {
        return this.organizer.profile(user.organizerId);
    }
    updateProfile(user, dto) {
        return this.organizer.updateProfile(user.organizerId, dto);
    }
    events(user) {
        return this.organizer.listEvents(user.organizerId);
    }
    createEvent(user, dto) {
        return this.organizer.createEvent(user.organizerId, dto);
    }
    updateEvent(user, id, dto) {
        return this.organizer.updateEvent(user.organizerId, Number(id), dto);
    }
    submitSource(user, dto) {
        return this.organizer.submitSource(user.organizerId, dto);
    }
};
exports.OrganizerController = OrganizerController;
__decorate([
    (0, common_1.Get)("profile"),
    __param(0, (0, auth_decorators_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], OrganizerController.prototype, "profile", null);
__decorate([
    (0, common_1.Put)("profile"),
    __param(0, (0, auth_decorators_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, organizer_dto_1.OrganizerProfileDto]),
    __metadata("design:returntype", void 0)
], OrganizerController.prototype, "updateProfile", null);
__decorate([
    (0, common_1.Get)("events"),
    __param(0, (0, auth_decorators_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], OrganizerController.prototype, "events", null);
__decorate([
    (0, common_1.Post)("events"),
    __param(0, (0, auth_decorators_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, event_dto_1.EventUpsertDto]),
    __metadata("design:returntype", void 0)
], OrganizerController.prototype, "createEvent", null);
__decorate([
    (0, common_1.Put)("events/:id"),
    __param(0, (0, auth_decorators_1.CurrentUser)()),
    __param(1, (0, common_1.Param)("id")),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, event_dto_1.EventUpsertDto]),
    __metadata("design:returntype", void 0)
], OrganizerController.prototype, "updateEvent", null);
__decorate([
    (0, common_1.Post)("events/submit-url"),
    __param(0, (0, auth_decorators_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, organizer_dto_1.SubmitSourceDto]),
    __metadata("design:returntype", void 0)
], OrganizerController.prototype, "submitSource", null);
exports.OrganizerController = OrganizerController = __decorate([
    (0, common_1.Controller)("organizer"),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, auth_decorators_1.Roles)(client_1.UserRole.ORGANIZER),
    __metadata("design:paramtypes", [organizer_service_1.OrganizerService])
], OrganizerController);
