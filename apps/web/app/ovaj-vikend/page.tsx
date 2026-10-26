import type { Metadata } from "next";
import { WeekendLanding } from "@/components/public/weekend-landing";
import { fetchEvents } from "@/lib/public-api";
import { weekendPageCanonical, weekendPageDescription, weekendPageTitle } from "@/lib/weekend-page";
import { DEFAULT_OG_IMAGE } from "@/lib/seo-images";

export const metadata: Metadata = {
  title: { absolute: weekendPageTitle },
  description: weekendPageDescription,
  alternates: { canonical: weekendPageCanonical },
  openGraph: {
    type: "website",
    title: weekendPageTitle,
    description: weekendPageDescription,
    url: weekendPageCanonical,
    images: [DEFAULT_OG_IMAGE],
  },
};

export const revalidate = 0;

export default async function WeekendPage() {
  const events = await fetchEvents({ when: "ovaj-vikend" });
  return <WeekendLanding events={events} eyebrow="Vikend" h1="Kamo za vikend? Što se događa ovaj vikend" intro="Aktualna događanja od petka do nedjelje." breadcrumbs={[{ name: "Početna", path: "/" }, { name: "Ovaj vikend", path: "/ovaj-vikend" }]} />;
}
