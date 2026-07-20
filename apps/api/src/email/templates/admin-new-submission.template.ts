import { renderLayout, renderButton, escapeHtml } from "./email-layout";

export interface AdminNewSubmissionData {
  titleOrSource: string;
  organizerLabel?: string;
  sourceTypeLabel: string;
  adminReviewUrl: string;
  warningsCount?: number;
  webUrl: string;
}

export function adminNewSubmissionSubject(data: Pick<AdminNewSubmissionData, "titleOrSource">): string {
  return `Novi događaj čeka pregled: ${data.titleOrSource}`;
}

export function adminNewSubmissionHtml(data: AdminNewSubmissionData): string {
  const rows = [
    `<strong>Izvor:</strong> ${escapeHtml(data.sourceTypeLabel)}`,
    data.organizerLabel ? `<strong>Organizator:</strong> ${escapeHtml(data.organizerLabel)}` : null,
    typeof data.warningsCount === "number" && data.warningsCount > 0
      ? `<strong>Upozorenja/nedostajuća polja:</strong> ${data.warningsCount}`
      : null,
  ].filter(Boolean).join("<br/>");

  const body = `
    <p style="margin:0 0 16px;">Novi unos čeka pregled: <strong>${escapeHtml(data.titleOrSource)}</strong></p>
    <p style="margin:0 0 16px;">${rows}</p>
    ${renderButton("Pregledaj u adminu", data.adminReviewUrl)}
  `;
  return renderLayout({ preheader: `${data.titleOrSource} čeka pregled.`, bodyHtml: body, webUrl: data.webUrl });
}

export function adminNewSubmissionText(data: AdminNewSubmissionData): string {
  const lines = [
    `Novi događaj čeka pregled: ${data.titleOrSource}`,
    "",
    `Izvor: ${data.sourceTypeLabel}`,
  ];
  if (data.organizerLabel) lines.push(`Organizator: ${data.organizerLabel}`);
  if (typeof data.warningsCount === "number" && data.warningsCount > 0) {
    lines.push(`Upozorenja/nedostajuća polja: ${data.warningsCount}`);
  }
  lines.push("", `Pregled: ${data.adminReviewUrl}`);
  return lines.join("\n");
}
