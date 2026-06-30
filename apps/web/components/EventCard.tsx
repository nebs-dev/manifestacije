import Link from "next/link";
import { EventItem, formatDate } from "../lib/api";

export function EventCard({ event }: { event: EventItem }) {
  return (
    <article className="rounded border bg-white p-4">
      <div className="text-sm text-slate-600">{formatDate(event.startsAt)} · {event.city.name} · {event.category.name}</div>
      <h2 className="mt-1 text-xl font-semibold">
        <Link href={`/eventi/${event.slug}`}>{event.title}</Link>
      </h2>
      <p className="mt-2 text-sm text-slate-700">{event.shortDescription || event.description.slice(0, 180)}</p>
      <div className="mt-3 text-sm text-slate-600">
        {event.venue?.name || "Lokacija u najavi"} · {event.isFree ? "Besplatno" : event.priceText || "Plaća se"}
      </div>
      <div className="mt-1 text-xs text-slate-500">{event.organizer?.name || "Izvor/organizator nije naveden"}</div>
    </article>
  );
}
