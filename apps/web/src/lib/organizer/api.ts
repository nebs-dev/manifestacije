import { API_URL } from "@/lib/api"
import { ORG_TOKEN_KEY } from "@/lib/organizer/auth"

export function orgFetch(path: string, init?: RequestInit): Promise<Response> {
  const token = typeof window !== "undefined" ? localStorage.getItem(ORG_TOKEN_KEY) : null
  const isFormData = init?.body instanceof FormData
  return fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      ...(!isFormData ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers as Record<string, string> | undefined),
    },
  })
}

export type City = { id: number; name: string; county: { name: string; region: { name: string } } }
export type Category = { id: number; name: string; slug: string }
export type OrgEvent = {
  id: number
  title: string
  status: string
  startsAt: string
  city: { name: string }
  category: { name: string }
}
