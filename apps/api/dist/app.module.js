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
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const throttler_1 = require("@nestjs/throttler");
const jwt_1 = require("@nestjs/jwt");
const prisma_service_1 = require("./prisma/prisma.service");
const auth_controller_1 = require("./auth/auth.controller");
const auth_service_1 = require("./auth/auth.service");
const public_feed_controller_1 = require("./public-feed/public-feed.controller");
const public_feed_service_1 = require("./public-feed/public-feed.service");
const organizer_controller_1 = require("./organizers/organizer.controller");
const organizer_service_1 = require("./organizers/organizer.service");
const admin_controller_1 = require("./admin/admin.controller");
const admin_service_1 = require("./admin/admin.service");
const ai_event_parser_service_1 = require("./ai-parser/ai-event-parser.service");
const duplicates_service_1 = require("./duplicates/duplicates.service");
const events_service_1 = require("./events/events.service");
const uploads_service_1 = require("./admin/uploads.service");
const jwtSecret = process.env.JWT_SECRET || "dev-secret-change-me";
if (process.env.NODE_ENV === "production" && jwtSecret === "dev-secret-change-me") {
    throw new Error("JWT_SECRET must be set to a non-default value in production");
}
let HealthController = class HealthController {
    health() {
        return { ok: true };
    }
};
__decorate([
    (0, common_1.Get)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], HealthController.prototype, "health", null);
HealthController = __decorate([
    (0, common_1.Controller)("health")
], HealthController);
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            throttler_1.ThrottlerModule.forRoot([{ ttl: 60_000, limit: 10 }]),
            jwt_1.JwtModule.register({
                global: true,
                secret: jwtSecret,
                signOptions: { expiresIn: "7d" }
            })
        ],
        controllers: [HealthController, auth_controller_1.AuthController, public_feed_controller_1.PublicFeedController, organizer_controller_1.OrganizerController, admin_controller_1.AdminController],
        providers: [
            prisma_service_1.PrismaService,
            auth_service_1.AuthService,
            public_feed_service_1.PublicFeedService,
            organizer_service_1.OrganizerService,
            admin_service_1.AdminService,
            uploads_service_1.UploadsService,
            ai_event_parser_service_1.AiEventParserService,
            duplicates_service_1.DuplicatesService,
            events_service_1.EventsService
        ]
    })
], AppModule);
