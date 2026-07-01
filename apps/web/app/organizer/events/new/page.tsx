import { OrganizerEventForm } from "@/components/organizer/event-form"

export default function NewEventPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-heading text-2xl font-semibold">Novi event</h1>
      <OrganizerEventForm />
    </div>
  )
}
