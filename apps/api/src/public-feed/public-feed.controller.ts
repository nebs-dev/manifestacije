import { Controller, Get, Param, Query } from "@nestjs/common";
import { PublicFeedService } from "./public-feed.service";

@Controller("public")
export class PublicFeedController {
  constructor(private readonly feed: PublicFeedService) {}

  @Get("events")
  events(@Query() query: Record<string, string | undefined>) {
    return this.feed.events(query);
  }

  @Get("events/:slug")
  event(@Param("slug") slug: string) {
    return this.feed.event(slug);
  }

  @Get("organizers/:slug")
  organizer(@Param("slug") slug: string) {
    return this.feed.organizerBySlug(slug);
  }

  @Get("regions")
  regions() {
    return this.feed.regions();
  }

  @Get("cities")
  cities() {
    return this.feed.cities();
  }

  @Get("regions/:slug/events")
  regionEvents(@Param("slug") slug: string) {
    return this.feed.byRegion(slug);
  }

  @Get("cities/:slug/events")
  cityEvents(@Param("slug") slug: string) {
    return this.feed.byCity(slug);
  }

  @Get("categories")
  categories() {
    return this.feed.categories();
  }

  @Get("categories/:slug/events")
  categoryEvents(@Param("slug") slug: string) {
    return this.feed.byCategory(slug);
  }

  @Get("map/events")
  mapEvents() {
    return this.feed.mapEvents();
  }

  @Get("seo/sitemap-data")
  sitemapData() {
    return this.feed.sitemapData();
  }
}
