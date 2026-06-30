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
exports.PublicFeedController = void 0;
const common_1 = require("@nestjs/common");
const public_feed_service_1 = require("./public-feed.service");
let PublicFeedController = class PublicFeedController {
    feed;
    constructor(feed) {
        this.feed = feed;
    }
    events(query) {
        return this.feed.events(query);
    }
    event(slug) {
        return this.feed.event(slug);
    }
    regions() {
        return this.feed.regions();
    }
    regionEvents(slug) {
        return this.feed.byRegion(slug);
    }
    cityEvents(slug) {
        return this.feed.byCity(slug);
    }
    categories() {
        return this.feed.categories();
    }
    categoryEvents(slug) {
        return this.feed.byCategory(slug);
    }
    mapEvents() {
        return this.feed.mapEvents();
    }
    sitemapData() {
        return this.feed.sitemapData();
    }
};
exports.PublicFeedController = PublicFeedController;
__decorate([
    (0, common_1.Get)("events"),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], PublicFeedController.prototype, "events", null);
__decorate([
    (0, common_1.Get)("events/:slug"),
    __param(0, (0, common_1.Param)("slug")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], PublicFeedController.prototype, "event", null);
__decorate([
    (0, common_1.Get)("regions"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], PublicFeedController.prototype, "regions", null);
__decorate([
    (0, common_1.Get)("regions/:slug/events"),
    __param(0, (0, common_1.Param)("slug")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], PublicFeedController.prototype, "regionEvents", null);
__decorate([
    (0, common_1.Get)("cities/:slug/events"),
    __param(0, (0, common_1.Param)("slug")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], PublicFeedController.prototype, "cityEvents", null);
__decorate([
    (0, common_1.Get)("categories"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], PublicFeedController.prototype, "categories", null);
__decorate([
    (0, common_1.Get)("categories/:slug/events"),
    __param(0, (0, common_1.Param)("slug")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], PublicFeedController.prototype, "categoryEvents", null);
__decorate([
    (0, common_1.Get)("map/events"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], PublicFeedController.prototype, "mapEvents", null);
__decorate([
    (0, common_1.Get)("seo/sitemap-data"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], PublicFeedController.prototype, "sitemapData", null);
exports.PublicFeedController = PublicFeedController = __decorate([
    (0, common_1.Controller)("public"),
    __metadata("design:paramtypes", [public_feed_service_1.PublicFeedService])
], PublicFeedController);
