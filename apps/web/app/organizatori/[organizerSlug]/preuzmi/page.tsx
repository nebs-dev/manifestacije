import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { fetchOrganizer } from "@/lib/public-api"
import { ClaimRequestForm } from "@/components/organizer/claim-request-form"

export async function generateMetadata({ params }: { params: { organizerSlug: string } }): Promise<Metadata> {
  const organizer = await fetchOrganizer(params.organizerSlug)
  return {
    title: organizer ? `Preuzmite profil — ${organizer.name}` : "Preuzmite profil",
    robots: { index: false, follow: false },
  }
}

export default async function OrganizerClaimRequestPage({ params }: { params: { organizerSlug: string } }) {
  const organizer = await fetchOrganizer(params.organizerSlug)
  if (!organizer) notFound()

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <ClaimRequestForm organizerSlug={organizer.slug} organizerName={organizer.name} />
    </div>
  )
}
