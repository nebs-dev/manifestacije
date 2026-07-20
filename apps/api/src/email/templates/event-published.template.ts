import { renderLayout, renderButton, escapeHtml } from "./email-layout";

export interface EventPublishedData {
  eventTitle: string;
  eventDateLabel?: string;
  eventLocationLabel?: string;
  publicEventUrl: string;
  webUrl: string;
}

export function eventPublishedSubject(data: Pick<EventPublishedData, "eventTitle">): string {
  return `Vaš događaj je objavljen: ${data.eventTitle}`;
}

export function eventPublishedHtml(data: EventPublishedData): string {
  const details = [
    data.eventDateLabel ? `<strong>Datum:</strong> ${escapeHtml(data.eventDateLabel)}` : null,
    data.eventLocationLabel ? `<strong>Lokacija:</strong> ${escapeHtml(data.eventLocationLabel)}` : null,
  ].filter(Boolean).join("<br/>");

  const body = `
    <p style="margin:0 0 16px;">Pozdrav,</p>
    <p style="margin:0 0 16px;">Sjajne vijesti — vaš događaj <strong>${escapeHtml(data.eventTitle)}</strong> je objavljen i sada je vidljiv svim posjetiteljima Manifestacije.hr.</p>
    ${details ? `<p style="margin:0 0 16px;">${details}</p>` : ""}
    ${renderButton("Pogledaj objavu", data.publicEventUrl)}
    <p style="margin:16px 0 0;">Imate još događaja? Slobodno nam pošaljite sljedeći — postupak je isti.</p>
    <p style="margin:16px 0 0;color:#6b7280;font-size:13px;">Pitanja: info@manifestacije.hr</p>
  `;
  return renderLayout({ preheader: `${data.eventTitle} je sada objavljen.`, bodyHtml: body, webUrl: data.webUrl });
}

export function eventPublishedText(data: EventPublishedData): string {
  const lines = [
    `Vaš događaj je objavljen: ${data.eventTitle}`,
    "",
    `Objava: ${data.publicEventUrl}`,
  ];
  if (data.eventDateLabel) lines.push(`Datum: ${data.eventDateLabel}`);
  if (data.eventLocationLabel) lines.push(`Lokacija: ${data.eventLocationLabel}`);
  lines.push("", "Imate još događaja? Pošaljite nam sljedeći na isti način.", "", "Pitanja: info@manifestacije.hr");
  return lines.join("\n");
}
