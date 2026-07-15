import type { Metadata } from "next"
import { OrganizerShell } from "@/components/organizer/organizer-shell"

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default function OrganizerLayout({ children }: { children: React.ReactNode }) {
  return <OrganizerShell>{children}</OrganizerShell>
}
