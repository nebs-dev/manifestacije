import type { MetadataRoute } from "next";
import { WEB_URL } from "@/lib/api";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/organizer"] },
    sitemap: `${WEB_URL}/sitemap.xml`,
  };
}
