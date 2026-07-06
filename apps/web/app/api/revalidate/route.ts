import { revalidateTag } from "next/cache"
import { NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-revalidate-secret")
  if (secret !== process.env.REVALIDATE_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { tag } = await req.json().catch(() => ({ tag: "events" }))
  revalidateTag(tag ?? "events")

  return NextResponse.json({ revalidated: true, tag })
}
