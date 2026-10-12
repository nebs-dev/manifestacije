import { describe, expect, it } from "vitest"
import { submissionMessage } from "./submission"

describe("submissionMessage", () => {
  it("confirms a parsed submission", () => {
    expect(submissionMessage({ parseStatus: "parsed", alreadySubmitted: false }).title).toBe("Poslano na pregled! Admin će obraditi vaš zahtjev.")
  })
  it("tells the organizer an unparsed submission was still saved for manual review", () => {
    const message = submissionMessage({ parseStatus: "pending_review", alreadySubmitted: false })
    expect(message.title).toBe("Zahtjev je spremljen i poslan na pregled.")
    expect(message.description).toContain("administrator obraditi ručno")
  })
  it("does not claim a second submission for repeated content", () => {
    expect(submissionMessage({ parseStatus: "parsed", alreadySubmitted: true }).title).toBe("Ovaj sadržaj je već zaprimljen.")
  })
  it("falls back to the generic confirmation for older API responses", () => {
    expect(submissionMessage({}).title).toBe("Poslano na pregled! Admin će obraditi vaš zahtjev.")
  })
})
