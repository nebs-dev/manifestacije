import { EventItem } from "../lib/api";
import { EventCard } from "./EventCard";

export function EventList({ events }: { events: EventItem[] }) {
  if (!events.length) return <p className="rounded border bg-white p-4">Nema objavljenih događaja za ove filtere.</p>;
  return <div className="grid gap-4">{events.map((event) => <EventCard key={event.id} event={event} />)}</div>;
}
