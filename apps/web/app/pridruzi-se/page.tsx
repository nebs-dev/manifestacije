import type { Metadata } from "next"
import { JoinForm } from "@/components/organizer/join-form"

export const metadata: Metadata = {
  title: "Pridružite se kao organizator",
  robots: { index: false, follow: false },
}

export default function OrganizerJoinPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <JoinForm />
    </div>
  )
}
