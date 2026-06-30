export const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
export const WEB_URL = process.env.NEXT_PUBLIC_WEB_URL || "http://localhost:3000";

export type EventItem = {
  id: number;
  title: string;
  slug: string;
  description: string;
  shortDescription?: string | null;
  startsAt: string;
  endsAt?: string | null;
  isFree?: boolean | null;
  priceText?: string | null;
  ticketUrl?: string | null;
  sourceUrl?: string | null;
  status?: string;
  organizer?: { id: number; name: string } | null;
  venue?: { id: number; name: string; address?: string | null } | null;
  city: { id: number; name: string; slug: string; lat?: number | null; lng?: number | null };
  county?: { id: number; name: string; slug: string };
  region?: { id: number; name: string; slug: string };
  category: { id: number; name: string; slug: string };
};

export type Taxonomy = { id: number; name: string; slug: string };

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}/api${path}`, { ...init, cache: "no-store" });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
}

export function formatDate(date: string) {
  return new Intl.DateTimeFormat("hr-HR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(date));
}
