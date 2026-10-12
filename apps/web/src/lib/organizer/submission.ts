export type SubmissionResult = { parseStatus?: "parsed" | "pending_review" | "processing"; alreadySubmitted?: boolean }

/** Croatian confirmation for an organizer link/poster submission; the submission is stored in every case. */
export function submissionMessage(result: SubmissionResult): { title: string; description?: string } {
  if (result.alreadySubmitted) {
    return { title: "Ovaj sadržaj je već zaprimljen.", description: "Nije poslan ponovno; administrator će ga pregledati." }
  }
  if (result.parseStatus === "pending_review") {
    return { title: "Zahtjev je spremljen i poslan na pregled.", description: "Automatska obrada trenutačno nije uspjela, pa će ga administrator obraditi ručno." }
  }
  return { title: "Poslano na pregled! Admin će obraditi vaš zahtjev." }
}
