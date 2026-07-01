import { API_URL } from "@/lib/api"

export function orgFetch(path: string, init?: RequestInit): Promise<Response> {
  const token = typeof window !== "undefined" ? localStorage.getItem("orgToken") : null
  return fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
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
