import { describe, expect, it } from "vitest"
import { adaptEvent, adaptEventSourceCandidates } from "./adapters"
import { EVENT_STATUS_OPTIONS, toApiEventStatus, toUiEventStatus } from "./status"

describe("admin adapters", () => {
  it("maps parsed candidate review fields without dropping warnings or image metadata", () => {
    const candidates = adaptEventSourceCandidates({
      id: 12,
      sourceUrl: "https://source.example/page",
      parsedJson: {
        candidates: [{
          title: "Festival",
          description: "Opis",
          startsAt: "",
          city: "",
          category: "festivali",
          imageUrl: "https://source.example/og.jpg",
          missingFields: ["startsAt", "city"],
          warnings: ["Only month/year provided; exact date missing."],
          confidence: 0.5,
          _status: "pending",
        }],
      },
    })

    expect(candidates[0]).toEqual(expect.objectContaining({
      id: "12-0",
      sourceId: "12",
      sourceUrl: "https://source.example/page",
      imageUrl: "https://source.example/og.jpg",
      missingFields: ["startsAt", "city"],
      warnings: ["Only month/year provided; exact date missing."],
      _status: "pending",
    }))
  })

  it("maps backend event status and image fields for admin edit", () => {
    const event = adaptEvent({
      id: 31,
      title: "Događaj",
      slug: "dogadjaj",
      description: "Opis",
      status: "PENDING_REVIEW",
      imageUrl: "https://res.cloudinary.com/demo/image/upload/event.jpg",
      city: { id: 1, name: "Osijek" },
      category: { id: 2, name: "Festivali", slug: "festivali" },
      categories: [{ categoryId: 2, category: { id: 2, name: "Festivali", slug: "festivali" } }],
    })

    expect(event.status).toBe("pending")
    expect(event.imageUrl).toBe("https://res.cloudinary.com/demo/image/upload/event.jpg")
  })

  it("keeps status mapping explicit and has no approved UI status", () => {
    expect(toUiEventStatus("DRAFT")).toBe("draft")
    expect(toUiEventStatus("PENDING_REVIEW")).toBe("pending")
    expect(toUiEventStatus("PUBLISHED")).toBe("published")
    expect(toUiEventStatus("REJECTED")).toBe("rejected")
    expect(toUiEventStatus("ARCHIVED")).toBe("archived")

    expect(toApiEventStatus("draft")).toBe("DRAFT")
    expect(toApiEventStatus("pending")).toBe("PENDING_REVIEW")
    expect(toApiEventStatus("published")).toBe("PUBLISHED")
    expect(toApiEventStatus("rejected")).toBe("REJECTED")
    expect(toApiEventStatus("archived")).toBe("ARCHIVED")
    expect(EVENT_STATUS_OPTIONS.map((o) => o.value)).not.toContain("approved")
  })
})
