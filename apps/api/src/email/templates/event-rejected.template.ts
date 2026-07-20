import { renderLayout, escapeHtml } from "./email-layout";

export interface EventRejectedData {
  eventTitle: string;
  /** Only included when the current workflow actually stores a reason — schema has no rejection-reason field today, so this is normally undefined. */
  reason?: string;
  webUrl: string;
}

export function eventRejectedSubject(data: Pick<EventRejectedData, "eventTitle">): string {
  return `Potrebna je dorada događaja: ${data.eventTitle}`;
}

export function eventRejectedHtml(data: EventRejectedData): string {
  const reasonBlock = data.reason
    ? `<p style="margin:0 0 16px;"><strong>Razlog:</strong> ${escapeHtml(data.reason)}</p>`
    : `<p style="margin:0 0 16px;">Za detalje nas slobodno kontaktirajte na info@manifestacije.hr — rado ćemo objasniti što treba doraditi.</p>`;

  const body = `
    <p style="margin:0 0 16px;">Pozdrav,</p>
    <p style="margin:0 0 16px;">Vaš događaj <strong>${escapeHtml(data.eventTitle)}</strong> trenutno nije objavljen na Manifestacije.hr.</p>
    ${reasonBlock}
    <p style="margin:16px 0 0;">Slobodno ga doradite i pošaljite ponovno.</p>
    <p style="margin:16px 0 0;color:#6b7280;font-size:13px;">Pitanja: info@manifestacije.hr</p>
  `;
  return renderLayout({ preheader: `${data.eventTitle} nije objavljen.`, bodyHtml: body, webUrl: data.webUrl });
}

export function eventRejectedText(data: EventRejectedData): string {
  const lines = [
    `Potrebna je dorada događaja: ${data.eventTitle}`,
    "",
    "Vaš događaj trenutno nije objavljen na Manifestacije.hr.",
  ];
  lines.push(data.reason ? `Razlog: ${data.reason}` : "Za detalje nas kontaktirajte na info@manifestacije.hr.");
  lines.push("", "Slobodno ga doradite i pošaljite ponovno.", "", "Pitanja: info@manifestacije.hr");
  return lines.join("\n");
}
