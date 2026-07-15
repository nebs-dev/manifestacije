import type { ReactNode } from "react"
import type { Metadata } from "next"

import { AdminShell } from "@/components/admin/admin-shell"
import { Toaster } from "@/components/ui/sonner"

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <AdminShell>
      {children}
      <Toaster />
    </AdminShell>
  )
}
