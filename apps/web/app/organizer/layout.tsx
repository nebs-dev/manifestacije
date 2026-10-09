import type { Metadata } from "next"
import { OrganizerShell } from "@/components/organizer/organizer-shell"
import { Toaster } from "@/components/ui/sonner"

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default function OrganizerLayout({ children }: { children: React.ReactNode }) {
  // Without a Toaster the organizer forms' save errors (e.g. an invalid link)
  // and success messages were never shown.
  return (
    <OrganizerShell>
      {children}
      <Toaster />
    </OrganizerShell>
  )
}
