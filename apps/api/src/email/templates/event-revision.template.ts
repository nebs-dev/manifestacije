import { escapeHtml, renderButton, renderLayout } from "./email-layout";

export type AdminEventRevisionData = { title: string; organizerName: string; reviewUrl: string; webUrl: string };
export type EventRevisionDecisionData = { title: string; approved: boolean; reason?: string; webUrl: string };

export function adminEventRevisionText(data: AdminEventRevisionData) {
  return `Izmjene događaja čekaju pregled: ${data.title}\nOrganizator: ${data.organizerName}\nTrenutačno objavljena verzija ostaje vidljiva.\nPregled: ${data.reviewUrl}`;
}
export function adminEventRevisionHtml(data: AdminEventRevisionData) {
  return renderLayout({ webUrl: data.webUrl, preheader: "Izmjene događaja čekaju pregled.", bodyHtml:
    `<p>Izmjene događaja čekaju pregled: <strong>${escapeHtml(data.title)}</strong></p><p>Organizator: ${escapeHtml(data.organizerName)}</p><p>Trenutačno objavljena verzija ostaje vidljiva.</p>${renderButton("Pregledaj izmjene", data.reviewUrl)}` });
}
export function eventRevisionDecisionText(data: EventRevisionDecisionData) {
  return `Izmjene ${data.approved ? "odobrene" : "odbijene"}: ${data.title}\n${data.approved ? "Odobrene izmjene sada su spremljene." : "Objavljena verzija nije promijenjena."}${data.reason ? `\nRazlog: ${data.reason}` : ""}`;
}
export function eventRevisionDecisionHtml(data: EventRevisionDecisionData) {
  return renderLayout({ webUrl: data.webUrl, preheader: `Izmjene ${data.approved ? "odobrene" : "odbijene"}.`, bodyHtml:
    `<p>${escapeHtml(eventRevisionDecisionText(data)).replace(/\n/g, "<br/>")}</p>${renderButton("Moji događaji", `${data.webUrl}/organizer/events`)}` });
}
