import { renderLayout, renderButton, escapeHtml } from "./email-layout";

export interface EventSubmittedData {
  eventTitle: string;
  eventDateLabel?: string;
  eventLocationLabel?: string;
  organizerEventUrl?: string;
  webUrl: string;
}

export function eventSubmittedSubject(data: Pick<EventSubmittedData, "eventTitle">): string {
  return `Zaprimili smo vaš događaj: ${data.eventTitle}`;
}

export function eventSubmittedHtml(data: EventSubmittedData): string {
  const details = [
    data.eventDateLabel ? `<strong>Datum:</strong> ${escapeHtml(data.eventDateLabel)}` : null,
    data.eventLocationLabel ? `<strong>Lokacija:</strong> ${escapeHtml(data.eventLocationLabel)}` : null,
  ].filter(Boolean).join("<br/>");

  const body = `
    <p style="margin:0 0 16px;">Pozdrav,</p>
    <p style="margin:0 0 16px;">Zaprimili smo vaš događaj <strong>${escapeHtml(data.eventTitle)}</strong> i on trenutno čeka pregled našeg tima.</p>
    ${details ? `<p style="margin:0 0 16px;">${details}</p>` : ""}
    <p style="margin:0 0 16px;">Događaj još nije objavljen — javit ćemo vam se čim ga pregledamo.</p>
    ${data.organizerEventUrl ? renderButton("Pogledaj status događaja", data.organizerEventUrl) : ""}
    <p style="margin:16px 0 0;color:#6b7280;font-size:13px;">Pitanja: info@manifestacije.hr</p>
  `;
  return renderLayout({ preheader: `${data.eventTitle} čeka pregled.`, bodyHtml: body, webUrl: data.webUrl });
}

export function eventSubmittedText(data: EventSubmittedData): string {
  const lines = [
    `Zaprimili smo vaš događaj: ${data.eventTitle}`,
    "",
    "Događaj čeka pregled našeg tima i još nije objavljen.",
  ];
  if (data.eventDateLabel) lines.push(`Datum: ${data.eventDateLabel}`);
  if (data.eventLocationLabel) lines.push(`Lokacija: ${data.eventLocationLabel}`);
  if (data.organizerEventUrl) { lines.push(""); lines.push(`Status događaja: ${data.organizerEventUrl}`); }
  lines.push("", "Pitanja: info@manifestacije.hr");
  return lines.join("\n");
}
