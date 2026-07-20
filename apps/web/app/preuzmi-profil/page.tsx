import type { Metadata } from "next"
import { ClaimCompleteForm } from "@/components/organizer/claim-complete-form"

export const metadata: Metadata = {
  title: "Preuzmite profil",
  robots: { index: false, follow: false },
}

export default function OrganizerClaimCompletePage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <ClaimCompleteForm />
    </div>
  )
}
