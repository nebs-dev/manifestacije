import { timingSafeEqual } from "node:crypto"
import { revalidateTag } from "next/cache"
import { NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"
const allowedTags = new Set(["events", "partners", "taxonomy", "organizers"])

export async function POST(req: NextRequest) {
  const expected = process.env.REVALIDATE_SECRET
  if (!expected?.trim()) {
    console.error({ event: "cache_revalidation_web", outcome: "missing_config" })
    return NextResponse.json({ error: "Revalidation not configured" }, { status: 503 })
  }
  const secret = req.headers.get("x-revalidate-secret") ?? ""
  const supplied = Buffer.from(secret)
  const configured = Buffer.from(expected)
  if (supplied.length !== configured.length || !timingSafeEqual(supplied, configured)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const body = await req.json().catch(() => null)
  if (!body || typeof body.tag !== "string" || !allowedTags.has(body.tag)) {
    return NextResponse.json({ error: "Invalid tag" }, { status: 400 })
  }
  try {
    revalidateTag(body.tag)
    // Organizer responses include event lists and counts.
    if (body.tag === "events") revalidateTag("organizers")
    console.info({ event: "cache_revalidation_web", outcome: "success", tag: body.tag })
    return NextResponse.json({ revalidated: true, tag: body.tag })
  } catch {
    console.error({ event: "cache_revalidation_web", outcome: "failure", tag: body.tag })
    return NextResponse.json({ error: "Invalidation failed" }, { status: 500 })
  }
}
