/**
 * Event descriptions use a small Markdown subset (EVT-03): **bold**, *italic*,
 * [text](https://link), "- " / "1. " lists and blank-line paragraphs. They are
 * stored as plain text and rendered by the web app as React elements, never as
 * HTML. On input we still remove any pasted HTML so no markup is ever stored:
 * dangerous blocks are dropped with their content, line-breaking tags become
 * newlines, and every other tag is stripped. Plain "<3" or "a < b" text stays.
 */
export function sanitizeDescriptionInput(value: unknown): unknown {
  if (typeof value !== "string") return value;
  return value
    .replace(/<(script|style|iframe|object|embed|template|noscript|svg|math)\b[\s\S]*?<\/\1\s*>/gi, "")
    .replace(/<(script|style|iframe|object|embed|template|noscript|svg|math)\b[^>]*\/?>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6])\s*>/gi, "\n")
    .replace(/<\/?[a-zA-Z][^>]*>/g, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/\r\n?/g, "\n")
    .replace(/\n{3,}/g, "\n\n");
}
