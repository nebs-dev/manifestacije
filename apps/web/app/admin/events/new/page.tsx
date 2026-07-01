"use client"

import { PageHeader } from "@/components/admin/page-header"
import { EventCreateForm } from "@/components/admin/event-create-form"

export default function NewAdminEventPage() {
  return (
    <>
      <PageHeader
        title="Novi događaj"
        description="Ručno kreiraj događaj i po potrebi dodaj sliku."
        breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Događaji", href: "/admin/events" }, { label: "Novi događaj" }]}
      />
      <EventCreateForm />
    </>
  )
}
