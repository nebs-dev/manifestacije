import { renderLayout, renderButton, escapeHtml } from "./email-layout";

export interface AdminNewOrganizerData {
  organizerName: string;
  organizerEmail: string;
  registeredAtLabel: string;
  adminOrganizersUrl: string;
  webUrl: string;
}

export function adminNewOrganizerSubject(data: Pick<AdminNewOrganizerData, "organizerName">): string {
  return `Novi organizator: ${data.organizerName}`;
}

export function adminNewOrganizerHtml(data: AdminNewOrganizerData): string {
  const body = `
    <p style="margin:0 0 16px;">Novi organizator se registrirao na Manifestacije.hr.</p>
    <p style="margin:0 0 16px;">
      <strong>Organizator:</strong> ${escapeHtml(data.organizerName)}<br/>
      <strong>Email:</strong> ${escapeHtml(data.organizerEmail)}<br/>
      <strong>Vrijeme:</strong> ${escapeHtml(data.registeredAtLabel)}
    </p>
    ${renderButton("Otvori organizatore", data.adminOrganizersUrl)}
  `;
  return renderLayout({ preheader: `Novi organizator: ${data.organizerName}`, bodyHtml: body, webUrl: data.webUrl });
}

export function adminNewOrganizerText(data: AdminNewOrganizerData): string {
  return [
    "Novi organizator se registrirao na Manifestacije.hr.",
    "",
    `Organizator: ${data.organizerName}`,
    `Email: ${data.organizerEmail}`,
    `Vrijeme: ${data.registeredAtLabel}`,
    "",
    `Pregled: ${data.adminOrganizersUrl}`,
  ].join("\n");
}
