import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/public/site-header";
import { SiteFooter } from "@/components/public/site-footer";
import { EventCard } from "@/components/public/event-card";
import { fetchEvents, WEB_URL } from "@/lib/public-api";
import { breadcrumbsToJsonLd, safeJsonLdString } from "@/lib/event-jsonld";
import { dateParts } from "@/lib/data";
import { groupWeekendEvents } from "@/lib/weekend";
import { weekendPageCanonical, weekendPageDescription, weekendPageTitle } from "@/lib/weekend-page";

export const metadata: Metadata = {
  title: { absolute: weekendPageTitle },
  description: weekendPageDescription,
  alternates: { canonical: weekendPageCanonical },
  openGraph: {
    type: "website",
    title: weekendPageTitle,
    description: weekendPageDescription,
    url: weekendPageCanonical,
  },
};

export default async function WeekendPage() {
  const events = await fetchEvents({ when: "ovaj-vikend" });
  const grouped = groupWeekendEvents(events);
  const visibleDays = grouped.days.filter((day) => day.events.length > 0);
  const breadcrumbJsonLd = breadcrumbsToJsonLd(
    [
      { name: "Početna", path: "/" },
      { name: "Ovaj vikend", path: "/ovaj-vikend" },
    ],
    WEB_URL,
  );
  return (
    <>
      <SiteHeader />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLdString(breadcrumbJsonLd) }} />
      <main className="mx-auto max-w-6xl px-4 py-10 md:py-14">
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-accent-foreground">Vikend</p>
        <h1 className="mt-2 font-heading text-3xl font-semibold md:text-4xl">Što se događa ovaj vikend?</h1>
        <p className="mb-8 mt-2 text-muted-foreground">
          {events.length} {events.length === 1 ? "događanje" : "događanja"} {grouped.weekend.longLabel}.
        </p>

        {visibleDays.length > 0 ? (
          <div className="flex flex-col gap-12">
            {visibleDays.map((day) => {
              const parts = dateParts(dateKeyFromDate(day.date));
              return (
                <section key={day.key}>
                  <div className="mb-5">
                    <h2 className="font-heading text-2xl font-semibold">{day.label}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">{parts.day}. {parts.monthLong} · {day.events.length} {day.events.length === 1 ? "događanje" : "događanja"}</p>
                  </div>
                  <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
                    {day.events.map((event) => (
                      <EventCard key={`${day.key}-${event.slug}`} event={event} />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-border bg-card/50 p-10 text-center">
            <p className="font-heading text-xl font-semibold">Trenutačno nemamo objavljenih događanja za ovaj vikend.</p>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
              <Link href="/eventi" className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
                Sva nadolazeća događanja
              </Link>
              <Link href="/dodaj-event" className="rounded-full border border-border px-5 py-2.5 text-sm font-semibold hover:bg-muted">
                Dodaj događaj
              </Link>
            </div>
          </div>
        )}
      </main>
      <SiteFooter />
    </>
  );
}

function dateKeyFromDate(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
