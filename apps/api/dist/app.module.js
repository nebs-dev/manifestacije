"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
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
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            jwt_1.JwtModule.register({
                global: true,
                secret: process.env.JWT_SECRET || "dev-secret-change-me",
                signOptions: { expiresIn: "7d" }
            })
        ],
        controllers: [auth_controller_1.AuthController, public_feed_controller_1.PublicFeedController, organizer_controller_1.OrganizerController, admin_controller_1.AdminController],
        providers: [
            prisma_service_1.PrismaService,
            auth_service_1.AuthService,
            public_feed_service_1.PublicFeedService,
            organizer_service_1.OrganizerService,
            admin_service_1.AdminService,
            ai_event_parser_service_1.AiEventParserService,
            duplicates_service_1.DuplicatesService,
            events_service_1.EventsService
        ]
    })
], AppModule);
