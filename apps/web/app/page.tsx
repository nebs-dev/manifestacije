import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SiteHeader } from "@/components/public/site-header";
import { SiteFooter } from "@/components/public/site-footer";
import { HomeHero } from "@/components/public/home-hero";
import { SectionHeading } from "@/components/public/section-heading";
import { EventRail } from "@/components/public/event-rail";
import { CategoryStrip } from "@/components/public/category-strip";
import { OrganizerCta } from "@/components/public/organizer-cta";
import { PartnersStrip } from "@/components/public/partners-strip";
import { EventCard } from "@/components/public/event-card";
import { fetchEvents, fetchPartners, WEB_URL } from "@/lib/public-api";
import { safeJsonLdString } from "@/lib/event-jsonld";

const UPCOMING_VISIBLE_COUNT = 6;
const UPCOMING_ROTATION_POOL_SIZE = 18;
const FREE_VISIBLE_COUNT = 3;
const FREE_ROTATION_POOL_SIZE = 12;
const ZAGREB_TIME_ZONE = "Europe/Zagreb";

export default async function Home() {
  const [events, partners] = await Promise.all([fetchEvents(), fetchPartners()]);
  const websiteJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Manifestacije",
    url: WEB_URL,
    potentialAction: {
      "@type": "SearchAction",
      target: `${WEB_URL}/eventi?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };
  const organizationJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Manifestacije",
    url: WEB_URL,
    logo: `${WEB_URL}/logo/logo.svg`,
  };
  const featuredStrict = events.filter((event) => event.featured);
  const featured = featuredStrict.length >= 3
    ? featuredStrict
    : [...featuredStrict, ...events.filter((event) => !event.featured)].slice(0, 3);
  const featuredSlugs = new Set(featured.map((event) => event.slug));
  const upcoming = rotateEventsByDay(events.filter((event) => !featuredSlugs.has(event.slug)).slice(0, UPCOMING_ROTATION_POOL_SIZE)).slice(0, UPCOMING_VISIBLE_COUNT);
  const shownSlugs = new Set([...featured.map((event) => event.slug), ...upcoming.map((event) => event.slug)]);
  const free = rotateEventsByDay(
    events
      .filter((event) => event.free && !shownSlugs.has(event.slug))
      .slice(0, FREE_ROTATION_POOL_SIZE),
  ).slice(0, FREE_VISIBLE_COUNT);

  return (
    <>
      <SiteHeader />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLdString(websiteJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLdString(organizationJsonLd) }} />
      <main>
        <HomeHero />
        <div className="mx-auto max-w-6xl px-4">
          <section className="py-14 md:py-20">
            <SectionHeading eyebrow="Izdvojeno" title="Događanja koja ne želiš propustiti" description="Ručno odabrani vrhunci sezone diljem Slavonije i Baranje." href="/eventi" hrefLabel="Sva događanja" />
            <EventRail events={featured} carousel />
          </section>

          <section className="py-14 md:py-20">
            <SectionHeading eyebrow="Uskoro" title="Nadolazeća događanja" href="/eventi" hrefLabel="Pogledaj sve" />
            <div className="grid grid-cols-1 items-stretch gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {upcoming.map((event) => <EventCard key={event.slug} event={event} />)}
            </div>
          </section>

          <section className="py-14 md:py-20">
            <SectionHeading eyebrow="Po kategoriji" title="Pronađi svoj žanr" description="Koncerti, festivali, radionice i još mnogo toga." />
            <CategoryStrip events={events} />
          </section>

          {free.length > 0 && (
            <section className="py-14 md:py-20">
              <SectionHeading eyebrow="Bez ulaznice" title="Besplatna događanja" description="Kultura dostupna svima — bez troška." href="/eventi?besplatno=1" hrefLabel="Sva besplatna" />
              <EventRail events={free} />
            </section>
          )}
        </div>

        <OrganizerCta />

        <PartnersStrip partners={partners} />

        <section className="border-t border-border bg-ink py-16 text-ink-foreground md:py-24">
          <div className="mx-auto flex max-w-6xl flex-col items-center px-4 text-center">
            <h2 className="max-w-2xl text-balance font-heading text-3xl font-semibold md:text-4xl">Vidi sva događanja na karti</h2>
            <p className="mt-4 max-w-lg text-pretty text-ink-foreground/75 leading-relaxed">Otkrij što se zbiva u tvojoj blizini ili planiraj putovanje uz interaktivnu kartu Slavonije i Baranje.</p>
            <Link href="/mapa" className="mt-8 inline-flex items-center gap-2 rounded-full bg-accent px-7 py-3.5 text-sm font-semibold text-accent-foreground transition-colors hover:bg-accent/90">
              Otvori kartu
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}

function rotateEventsByDay<T>(items: T[]) {
  if (items.length <= 1) return items;
  const offset = dayOfYearInZagreb(new Date()) % items.length;
  return [...items.slice(offset), ...items.slice(0, offset)];
}

function dayOfYearInZagreb(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: ZAGREB_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  const year = value("year");
  const month = value("month");
  const day = value("day");
  const start = Date.UTC(year, 0, 1);
  const current = Date.UTC(year, month - 1, day);
  return Math.floor((current - start) / 86_400_000);
}
