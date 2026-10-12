import { safeExternalUrl } from "@/lib/safe-url"

/**
 * Event descriptions (EVT-03) are plain text with a small Markdown subset:
 *   **bold**, *italic*, [text](https://link), bare https:// links,
 *   "- item" / "1. item" lists, blank lines between paragraphs.
 * Legacy plain-text descriptions are valid input unchanged. Nothing here ever
 * produces HTML strings: renderers turn these nodes into React elements, and
 * links are kept only when safeExternalUrl accepts them.
 */
export type Inline =
  | { type: "text"; text: string }
  | { type: "strong"; children: Inline[] }
  | { type: "em"; children: Inline[] }
  | { type: "link"; href: string; children: Inline[] }

export type Block =
  | { type: "p"; lines: Inline[][] }
  | { type: "ul"; items: Inline[][] }
  | { type: "ol"; items: Inline[][] }

const BULLET = /^\s*[-*•]\s+/
const NUMBERED = /^\s*\d{1,3}[.)]\s+/
const BARE_URL = /^https?:\/\/[^\s<>()\[\]]+/i

export function parseRichText(source: string | null | undefined): Block[] {
  if (!source) return []
  return source
    .replace(/\r\n?/g, "\n")
    .split(/\n[ \t]*\n+/)
    .map((block) => block.split("\n").filter((line) => line.trim() !== ""))
    .filter((lines) => lines.length > 0)
    .map((lines): Block => {
      if (lines.every((line) => BULLET.test(line))) return { type: "ul", items: lines.map((line) => parseInline(line.replace(BULLET, ""))) }
      if (lines.every((line) => NUMBERED.test(line))) return { type: "ol", items: lines.map((line) => parseInline(line.replace(NUMBERED, ""))) }
      return { type: "p", lines: lines.map((line) => parseInline(line)) }
    })
}

export function parseInline(text: string): Inline[] {
  const out: Inline[] = []
  let buffer = ""
  const flush = () => { if (buffer) { out.push({ type: "text", text: buffer }); buffer = "" } }
  let i = 0
  while (i < text.length) {
    const rest = text.slice(i)
    if (rest[0] === "\\" && /[*\[\]\\_]/.test(rest[1] ?? "")) { buffer += rest[1]; i += 2; continue }
    if (rest.startsWith("**")) {
      const end = text.indexOf("**", i + 2)
      if (end > i + 2) { flush(); out.push({ type: "strong", children: parseInline(text.slice(i + 2, end)) }); i = end + 2; continue }
    }
    if (rest[0] === "*" && rest[1] && rest[1] !== " " && rest[1] !== "*") {
      const end = findItalicEnd(text, i + 1)
      if (end > 0) { flush(); out.push({ type: "em", children: parseInline(text.slice(i + 1, end)) }); i = end + 1; continue }
    }
    if (rest[0] === "[") {
      const link = /^\[([^\]\n]+)\]\(([^)\s]+)\)/.exec(rest)
      if (link) {
        flush()
        const href = safeExternalUrl(link[2], { allowContactLinks: true })
        const children = parseInline(link[1])
        if (href) out.push({ type: "link", href, children })
        else out.push(...children)
        i += link[0].length
        continue
      }
    }
    if ((rest[0] === "h" || rest[0] === "H") && (i === 0 || /[\s(]/.test(text[i - 1]))) {
      const url = BARE_URL.exec(rest)
      if (url) {
        const raw = url[0].replace(/[.,;:!?'"]+$/, "")
        const href = safeExternalUrl(raw)
        if (href) { flush(); out.push({ type: "link", href, children: [{ type: "text", text: raw }] }); i += raw.length; continue }
      }
    }
    buffer += rest[0]
    i += 1
  }
  flush()
  return out
}

function findItalicEnd(text: string, from: number): number {
  for (let j = from + 1; j < text.length; j++) {
    if (text[j] === "*" && text[j - 1] !== " " && text[j - 1] !== "\\" && text[j + 1] !== "*") return j
  }
  return -1
}

function inlineToPlain(nodes: Inline[]): string {
  return nodes.map((node) => node.type === "text" ? node.text : inlineToPlain(node.children)).join("")
}

/** Readable plain text for cards, meta descriptions, JSON-LD, calendar files and notifications. */
export function richTextToPlain(source: string | null | undefined): string {
  return parseRichText(source).map((block) => {
    if (block.type === "p") return block.lines.map(inlineToPlain).join("\n")
    return block.items.map((item, index) => `${block.type === "ol" ? `${index + 1}.` : "•"} ${inlineToPlain(item)}`).join("\n")
  }).join("\n\n")
}

/** Single-line plain summary, e.g. for <meta name="description">. */
export function richTextSummary(source: string | null | undefined, max = 300): string {
  const plain = richTextToPlain(source).replace(/\s+/g, " ").trim()
  return plain.length > max ? `${plain.slice(0, max - 1).trimEnd()}…` : plain
}
