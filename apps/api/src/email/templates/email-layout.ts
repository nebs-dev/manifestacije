/**
 * Shared HTML shell for all transactional emails. Inline styles only (email
 * clients strip <style> blocks unpredictably), single-column layout, no
 * external assets, no Resend branding. Dark navy header, warm off-white body,
 * amber accent for the CTA button — matches the site's visual identity.
 */

const NAVY = "#101820";
const OFF_WHITE = "#f7f4ee";
const AMBER = "#f28c00";
const TEXT = "#1a2238";
const MUTED = "#6b7280";

export function renderLayout(params: { preheader?: string; bodyHtml: string; webUrl: string }): string {
  const { preheader, bodyHtml, webUrl } = params;
  return `<!DOCTYPE html>
<html lang="hr">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Manifestacije.hr</title>
</head>
<body style="margin:0;padding:0;background-color:${OFF_WHITE};font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
${preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>` : ""}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${OFF_WHITE};padding:24px 0;">
  <tr>
    <td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background-color:#ffffff;border-radius:12px;overflow:hidden;">
        <tr>
          <td style="background-color:${NAVY};padding:24px 32px;">
            <span style="color:#ffffff;font-size:20px;font-weight:700;">Manifestacije<span style="color:${AMBER};">.hr</span></span>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;color:${TEXT};font-size:15px;line-height:1.6;">
            ${bodyHtml}
          </td>
        </tr>
        <tr>
          <td style="padding:20px 32px;border-top:1px solid #eee;color:${MUTED};font-size:12px;line-height:1.5;">
            Manifestacije.hr — otkrij što se događa u Slavoniji i Baranji.<br/>
            <a href="${webUrl}" style="color:${MUTED};">${webUrl.replace(/^https?:\/\//, "")}</a>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

export function renderButton(label: string, url: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;">
  <tr>
    <td style="background-color:${AMBER};border-radius:8px;">
      <a href="${url}" style="display:inline-block;padding:12px 24px;color:#101820;font-weight:600;font-size:14px;text-decoration:none;">${escapeHtml(label)}</a>
    </td>
  </tr>
</table>`;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
