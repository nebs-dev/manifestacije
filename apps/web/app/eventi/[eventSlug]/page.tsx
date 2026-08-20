import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Baby, Building2, CalendarDays, Clock, MapPin, Tags, Ticket, Trees } from "lucide-react";
import { SiteHeader } from "@/components/public/site-header";
import { SiteFooter } from "@/components/public/site-footer";
import { EventPoster } from "@/components/public/event-poster";
import { EventCard } from "@/components/public/event-card";
import { CategoryBadge, PriceBadge } from "@/components/public/badges";
import { ShareButton } from "@/components/public/share-button";
import { AddToCalendarButton } from "@/components/public/add-to-calendar-button";
import { EventDetailTracking } from "@/components/public/event-detail-tracking";
import { TicketLink, MapLink } from "@/components/public/tracked-links";
import { formatDateRange, priceLabel, regionName } from "@/lib/data";
import { fetchEvent, fetchRelatedEvents, WEB_URL } from "@/lib/public-api";
import { eventToJsonLd, breadcrumbsToJsonLd, safeJsonLdString } from "@/lib/event-jsonld";
import { citySlugForEvent } from "@/lib/seo-taxonomy";
import { publicAddressLine } from "@/lib/location-display";
import { effectiveOccurrences, formatOccurrenceLabel } from "@/lib/event-schedule";
import { Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";

const BACK_LINKS = {
  kalendar: { href: "/kalendar", label: "Natrag na kalendar" },
  mapa: { href: "/mapa", label: "Natrag na kartu" },
  eventi: { href: "/eventi", label: "Natrag" },
} as const;

function safeReturnTo(value: string | undefined) {
  if (!value) return null;
  if (value.startsWith("//")) return null;
  if (value === "/eventi" || value.startsWith("/eventi?")) return value;
  if (value === "/kalendar" || value.startsWith("/kalendar?")) return value;
  if (value === "/mapa" || value.startsWith("/mapa?")) return value;
  return null;
}

function backLinkFrom(searchParams: Record<string, string | string[] | undefined> | undefined) {
  const returnTo = safeReturnTo(Array.isArray(searchParams?.returnTo) ? searchParams?.returnTo[0] : searchParams?.returnTo);
  if (returnTo?.startsWith("/kalendar")) return { href: returnTo, label: "Natrag na kalendar" };
  if (returnTo?.startsWith("/mapa")) return { href: returnTo, label: "Natrag na kartu" };
  if (returnTo) return { href: returnTo, label: "Natrag na rezultate" };
  const source = Array.isArray(searchParams?.from) ? searchParams?.from[0] : searchParams?.from;
  if (source === "kalendar" || source === "mapa") return BACK_LINKS[source];
  return BACK_LINKS.eventi;
}

export async function generateMetadata({ params }: { params: { eventSlug: string } }): Promise<Metadata> {
  const event = await fetchEvent(params.eventSlug);
  if (!event) return { title: "Događanje nije pronađeno" };
  return {
    title: event.title,
    description: event.description,
    openGraph: {
      type: "article",
      title: event.title,
      description: event.description,
      images: event.image ? [{ url: event.image, alt: event.title }] : [],
      url: `${WEB_URL}/eventi/${event.slug}`,
    },
    twitter: {
      card: event.image ? "summary_large_image" : "summary",
      title: event.title,
      description: event.description,
      images: event.image ? [event.image] : [],
    },
    alternates: { canonical: `${WEB_URL}/eventi/${event.slug}` }
  };
}

export default async function EventDetailPage({
  params,
  searchParams,
}: {
  params: { eventSlug: string };
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const event = await fetchEvent(params.eventSlug);
  if (!event) notFound();
  const backLink = backLinkFrom(searchParams);
  const related = await fetchRelatedEvents(event);
  const eventCategories = event.categories.length > 0 ? event.categories : [{ slug: event.category, name: event.category }];
  const citySlug = event.city ? citySlugForEvent(event) : undefined;
  const addressLine = publicAddressLine(event.address, event.city, event.venue);
  const imageUrl = event.image?.startsWith("http") ? event.image : event.image ? `${WEB_URL}${event.image}` : undefined;
  const jsonLd = eventToJsonLd({ ...event, image: imageUrl }, WEB_URL);
  const schedule = effectiveOccurrences(event);
  const hasExplicitSchedule = (event.occurrences?.length ?? 0) > 1;
  const breadcrumbCrumbs = [
    { name: "Početna", path: "/" },
    { name: "Događanja", path: "/eventi" },
    ...(citySlug && event.city ? [{ name: event.city, path: `/gradovi/${citySlug}` }] : []),
    { name: event.title, path: `/eventi/${event.slug}` },
  ];
  const breadcrumbJsonLd = breadcrumbsToJsonLd(
    breadcrumbCrumbs,
    WEB_URL
  );

  return (
    <>
      <SiteHeader />
      <main>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLdString(jsonLd) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLdString(breadcrumbJsonLd) }} />
        <EventDetailTracking slug={event.slug} title={event.title} />
        <section className="relative isolate h-[44vh] min-h-[320px] w-full overflow-hidden bg-ink text-ink-foreground md:h-[56vh]">
          <div className="absolute inset-0">
            <EventPoster image={event.heroImage ?? event.image} title={event.title} alt={event.title} category={event.category} sizes="100vw" priority fit="contain-blur" />
          </div>
          <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/40 to-ink/20" aria-hidden />
          <div className="relative mx-auto flex h-full max-w-5xl flex-col justify-end px-4 pb-8">
            <Link href={backLink.href} className="absolute left-4 top-6 inline-flex items-center gap-1.5 rounded-full bg-ink/40 px-3 py-1.5 text-sm text-ink-foreground backdrop-blur hover:bg-ink/60">
              <ArrowLeft className="size-4" aria-hidden /> {backLink.label}
            </Link>
            <div className="flex flex-wrap items-center gap-2">
              {eventCategories.map((category) => (
                <CategoryBadge key={category.slug} category={category.slug} label={category.name} className="border-transparent bg-ink-foreground/15 text-ink-foreground backdrop-blur" />
              ))}
              <PriceBadge free={event.free} price={event.price} />
            </div>
            <h1 className="mt-3 max-w-3xl text-balance font-heading text-3xl font-semibold leading-tight text-shadow-lg md:text-5xl">{event.title}</h1>
            <p className="mt-2 inline-flex items-center gap-1.5 text-ink-foreground/85">
              <MapPin className="size-4 shrink-0" aria-hidden />
              {event.venue && event.venue !== event.city
                ? `${event.venue} · ${event.city}, ${regionName(event.region)}`
                : addressLine
                  ? `${addressLine} · ${event.city}, ${regionName(event.region)}`
                  : `${event.city} · ${regionName(event.region)}`}
            </p>
          </div>
        </section>

        <div className="mx-auto max-w-5xl px-4 py-10 md:py-14">
          <Breadcrumb className="mb-6">
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink render={<Link href="/" />}>Početna</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink render={<Link href="/eventi" />}>Događanja</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              {citySlug && event.city && (
                <>
                  <BreadcrumbItem>
                    <BreadcrumbLink render={<Link href={`/gradovi/${citySlug}`} />}>{event.city}</BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                </>
              )}
              <BreadcrumbItem>
                <BreadcrumbPage className="line-clamp-1">{event.title}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_320px]">
            <article>
              <div className="space-y-4 text-pretty text-lg leading-relaxed text-foreground/90">
                {event.description.split("\n\n").map((para, index) => <p key={index} className="whitespace-pre-line">{para}</p>)}
              </div>
              {event.longDescription !== event.description && (
                <div className="mt-6 space-y-4 text-pretty leading-relaxed text-muted-foreground">
                  {event.longDescription.split("\n\n").map((para, index) => <p key={index} className="whitespace-pre-line">{para}</p>)}
                </div>
              )}

              {(event.forKids || event.outdoor) && (
                <div className="mt-8 flex flex-wrap gap-3">
                  {event.forKids && <span className="inline-flex items-center gap-2 rounded-full bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground"><Baby className="size-4" aria-hidden /> Pogodno za djecu</span>}
                  {event.outdoor && <span className="inline-flex items-center gap-2 rounded-full bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground"><Trees className="size-4" aria-hidden /> Na otvorenom</span>}
                </div>
              )}

              {event.source && event.source !== "Manifestacije.hr" && (
                <p className="mt-12 text-xs text-muted-foreground/60">
                  Izvor: <a href={event.source} target="_blank" rel="noopener noreferrer" className="hover:underline">{event.source}</a>
                </p>
              )}
            </article>

            <aside>
              <div className="sticky top-24 rounded-2xl border border-border bg-card p-6 shadow-poster">
                <dl className="space-y-5">
                  {hasExplicitSchedule ? (
                    <InfoRow icon={<CalendarDays className="size-5" aria-hidden />} label="Raspored">
                      <ul className="space-y-1.5">
                        {schedule.map((occurrence) => <li key={occurrence.id}>{formatOccurrenceLabel(occurrence, true)}</li>)}
                      </ul>
                      <AddToCalendarButton event={event} compact />
                    </InfoRow>
                  ) : (
                    <>
                      <InfoRow icon={<CalendarDays className="size-5" aria-hidden />} label="Datum">
                        {formatDateRange(event.date, event.endDate)}
                        <AddToCalendarButton event={event} compact />
                      </InfoRow>
                      {!event.allDay && <InfoRow icon={<Clock className="size-5" aria-hidden />} label="Vrijeme">{event.time}</InfoRow>}
                    </>
                  )}
                  <InfoRow icon={<MapPin className="size-5" aria-hidden />} label="Lokacija">
                    {event.venue && event.venue !== event.city && (
                      <span className="block font-medium">{event.venue}</span>
                    )}
                    {addressLine && (
                      <span className="block text-sm text-muted-foreground">{addressLine}</span>
                    )}
                    <span className="block text-muted-foreground">{event.city}, {regionName(event.region)}</span>
                    <MapLink
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.address ?? `${event.venue}, ${event.city}`)}`}
                      slug={event.slug}
                      title={event.title}
                    />
                  </InfoRow>
                  <InfoRow icon={<Building2 className="size-5" aria-hidden />} label="Organizator">
                    {event.organizer}
                    {event.organizerClaimable && event.organizerSlug && (
                      <Link
                        href={`/organizatori/${event.organizerSlug}/preuzmi`}
                        className="ml-2 text-xs font-medium text-muted-foreground hover:text-primary hover:underline"
                      >
                        Vi organizirate ovaj događaj? Preuzmite profil
                      </Link>
                    )}
                  </InfoRow>
                  <InfoRow icon={<Tags className="size-5" aria-hidden />} label="Kategorije">
                    <span className="flex flex-wrap gap-1.5">
                      {eventCategories.map((category) => (
                        <CategoryBadge key={category.slug} category={category.slug} label={category.name} />
                      ))}
                    </span>
                  </InfoRow>
                  {!event.free && <InfoRow icon={<Ticket className="size-5" aria-hidden />} label="Ulaznica">{priceLabel(event)}</InfoRow>}
                </dl>
                <div className="mt-6 flex flex-col gap-3">
                  {event.ticketUrl ? (
                    <TicketLink href={event.ticketUrl} slug={event.slug} title={event.title} free={event.free} />
                  ) : event.free ? (
                    <span className="rounded-full bg-muted px-5 py-3 text-center text-sm font-medium text-muted-foreground">Ulaz slobodan</span>
                  ) : null}
                  <ShareButton title={event.title} slug={event.slug} />
                </div>
              </div>
            </aside>
          </div>

          {related.length > 0 && (
            <section className="mt-16 border-t border-border pt-12">
              <h2 className="mb-6 font-heading text-2xl font-semibold">Slična događanja</h2>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {related.map((item) => <EventCard key={item.slug} event={item} />)}
              </div>
            </section>
          )}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

function InfoRow({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="mt-0.5 shrink-0 text-primary">{icon}</span>
      <div className="text-sm">
        <dt className="font-semibold uppercase tracking-wide text-muted-foreground text-[0.7rem]">{label}</dt>
        <dd className="mt-0.5 font-medium text-foreground">{children}</dd>
      </div>
    </div>
  );
}
