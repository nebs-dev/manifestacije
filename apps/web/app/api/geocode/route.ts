import { NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") ?? ""
  if (q.length < 2) return NextResponse.json([])

  const url = new URL("https://nominatim.openstreetmap.org/search")
  url.searchParams.set("q", q)
  url.searchParams.set("format", "json")
  url.searchParams.set("addressdetails", "1")
  url.searchParams.set("limit", "7")
  url.searchParams.set("accept-language", "hr")
  // Bias toward Croatia without hard filtering so venue names work too
  url.searchParams.set("viewbox", "13.5,46.5,19.5,42.0")
  url.searchParams.set("bounded", "0")

  const res = await fetch(url.toString(), {
    headers: { "User-Agent": "Manifestacije/1.0 (contact@manifestacije.hr)" },
  }).catch(() => null)

  if (!res?.ok) return NextResponse.json([])
  return NextResponse.json(await res.json())
}
