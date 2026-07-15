import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SiteHeader } from "@/components/public/site-header";
import { SiteFooter } from "@/components/public/site-footer";
import { HomeHero } from "@/components/public/home-hero";
import { SectionHeading } from "@/components/public/section-heading";
import { EventRail } from "@/components/public/event-rail";
import { CategoryStrip } from "@/components/public/category-strip";
import { OrganizerCta } from "@/components/public/organizer-cta";
import { EventCard } from "@/components/public/event-card";
import { fetchEvents, WEB_URL } from "@/lib/public-api";
import { safeJsonLdString } from "@/lib/event-jsonld";

export default async function Home() {
  const events = await fetchEvents();
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
  const upcoming = events.slice(0, 6);
  const featured = featuredStrict.length >= 3
    ? featuredStrict.slice(0, 3)
    : [...featuredStrict, ...events.filter((e) => !e.featured)].slice(0, 3);
  const free = events.filter((event) => event.free).slice(0, 3);

  return (
    <>
      <SiteHeader />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLdString(websiteJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLdString(organizationJsonLd) }} />
      <main>
        <HomeHero />
        <div className="mx-auto max-w-6xl px-4">
          <section className="py-14 md:py-20">
            <SectionHeading eyebrow="Izdvojeno" title="Događanja koja ne želiš propustiti" description="Ručno odabrani vrhunci sezone diljem zemlje." href="/eventi" hrefLabel="Sva događanja" />
            <EventRail events={featured} />
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

          <section className="py-14 md:py-20">
            <SectionHeading eyebrow="Bez ulaznice" title="Besplatna događanja" description="Kultura dostupna svima — bez troška." href="/eventi?besplatno=1" hrefLabel="Sva besplatna" />
            <EventRail events={free.length ? free : upcoming.slice(0, 3)} />
          </section>
        </div>

        <OrganizerCta />

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
