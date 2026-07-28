import { NextRequest, NextResponse } from "next/server"
import { fetchEvent } from "@/lib/public-api"
import { canAddToCalendar, eventToICS } from "@/lib/calendar"

export async function GET(_req: NextRequest, { params }: { params: { eventSlug: string } }) {
  const event = await fetchEvent(params.eventSlug)
  if (!event || !canAddToCalendar(event)) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 })
  }

  return new NextResponse(eventToICS(event), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${event.slug}.ics"`,
    },
  })
}
