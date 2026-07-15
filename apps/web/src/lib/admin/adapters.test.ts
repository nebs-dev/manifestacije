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

  it("falls back _categoryIds to the primary category when EventCategory rows are empty", () => {
    // Events created before the many-to-many EventCategory join existed (or created
    // via the admin quick-create path) only have a primary categoryId — the inline
    // category editor's checkbox popover reads _categoryIds, so without this fallback
    // it opened with nothing checked even though the event visibly has a category.
    const event = adaptEvent({
      id: 37,
      title: "Jazz Grmic",
      slug: "jazz-grmic",
      description: "Opis",
      status: "PENDING_REVIEW",
      categoryId: 13,
      category: { id: 13, name: "Tradicija i folklor", slug: "tradicija-i-folklor" },
      categories: [],
    })

    expect(event._categoryIds).toEqual([13])
  })

  it("uses the EventCategory join for _categoryIds when rows exist, ignoring the primary category id", () => {
    const event = adaptEvent({
      id: 38,
      title: "Festival",
      slug: "festival",
      description: "Opis",
      status: "PUBLISHED",
      categoryId: 4,
      category: { id: 4, name: "Glazba", slug: "glazba" },
      categories: [
        { categoryId: 4, category: { id: 4, name: "Glazba", slug: "glazba" } },
        { categoryId: 9, category: { id: 9, name: "Sport", slug: "sport" } },
      ],
    })

    expect(event._categoryIds).toEqual([4, 9])
  })

  it("returns an empty _categoryIds when there is no primary category and no EventCategory rows", () => {
    const event = adaptEvent({
      id: 39,
      title: "Bez kategorije",
      slug: "bez-kategorije",
      description: "Opis",
      status: "DRAFT",
      category: null,
      categories: [],
    })

    expect(event._categoryIds).toEqual([])
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
