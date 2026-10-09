import { escapeHtml, renderButton, renderLayout } from "./email-layout";
export type AdminAutoPublishedData = { title: string; organizerName: string; adminEventUrl: string; publicEventUrl: string; webUrl: string };
export const adminAutoPublishedSubject = (data: AdminAutoPublishedData) => `Automatski objavljen događaj: ${data.title}`;
export const adminAutoPublishedText = (data: AdminAutoPublishedData) => `Pouzdani organizator ${data.organizerName} automatski je objavio događaj: ${data.title}\nInformativna obavijest — odobrenje nije potrebno.\nAdmin: ${data.adminEventUrl}\nJavna stranica: ${data.publicEventUrl}`;
export const adminAutoPublishedHtml = (data: AdminAutoPublishedData) => renderLayout({ webUrl: data.webUrl,
  preheader: adminAutoPublishedSubject(data), bodyHtml: `<p>Pouzdani organizator <strong>${escapeHtml(data.organizerName)}</strong> automatski je objavio događaj: <strong>${escapeHtml(data.title)}</strong>.</p><p>Informativna obavijest — odobrenje nije potrebno.</p>${renderButton("Otvori u adminu", data.adminEventUrl)}${renderButton("Otvori javnu stranicu", data.publicEventUrl)}` });
