import AdminEventsPage from "@/components/admin/events-page"

// Organizer/creator navigation must receive request-specific query parameters.
export const dynamic = "force-dynamic"

export default function EventsPage({ searchParams }: { searchParams?: Record<string, string | string[] | undefined> }) {
  return <AdminEventsPage searchParams={searchParams} />
}
