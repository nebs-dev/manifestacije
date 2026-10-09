"use client"
import { useParams } from "next/navigation"
import { EventRevisionReview } from "@/components/admin/event-revision-review"
export default function EventRevisionPage() {
  const { id } = useParams<{ id: string }>()
  return <EventRevisionReview id={Number(id)} />
}
