import { describe, expect, it } from "vitest"
import { adaptEvent, adaptEventSource, adaptEventSourceCandidates } from "./adapters"
import { EVENT_STATUS_OPTIONS, toApiEventStatus, toUiEventStatus } from "./status"

describe("admin adapters", () => {
  it.each([true, false, null, undefined])("preserves pricing %s in events and imported candidates", isFree => {
    expect(adaptEvent({ id: 1, isFree }).isFree).toBe(isFree ?? null)
    expect(adaptEventSourceCandidates({ id: 1, parsedJson: { candidates: [{ isFree }] } })[0].isFree).toBe(isFree ?? null)
  })

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

describe("adaptEventSource unparsed submissions", () => {
  it("exposes the parse error and an inline poster only for allowed image types", () => {
    const pending = adaptEventSource({ id: 5, status: "NEEDS_REVIEW", parsedJson: { candidates: [], parseError: "Automatska obrada trenutačno nije dostupna.", pendingScreenshot: { mediaType: "image/png", base64: "cG9zdGVy" } } })
    expect(pending.parseError).toBe("Automatska obrada trenutačno nije dostupna.")
    expect(pending.pendingScreenshotSrc).toBe("data:image/png;base64,cG9zdGVy")
    expect(adaptEventSource({ id: 6, parsedJson: { pendingScreenshot: { mediaType: "image/svg+xml", base64: "PHN2Zz4=" } } }).pendingScreenshotSrc).toBeUndefined()
    expect(adaptEventSource({ id: 7, parsedJson: { pendingScreenshot: { mediaType: "image/png", base64: "x\" onerror=" } } }).pendingScreenshotSrc).toBeUndefined()
    expect(adaptEventSource({ id: 8, parsedJson: { candidates: [] } }).parseError).toBeUndefined()
  })
})
