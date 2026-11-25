/**
 * CSV for Excel, in Croatian conventions (STAT-11).
 *
 * Excel on a Croatian locale reads `;` as the column separator and `,` as the
 * decimal mark; a comma-separated file opens as one column per row and the
 * numbers come out wrong. The BOM is what makes Excel read the file as UTF-8,
 * without which every č and ž is mangled.
 */
const BOM = "﻿"

const cell = (value: string | number | null | undefined): string => {
  if (value === null || value === undefined) return ""
  // Decimal comma, so Excel treats 2.5 as a number rather than a date.
  const text = typeof value === "number" ? String(value).replace(".", ",") : value
  return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export function toCsv(rows: (string | number | null | undefined)[][]): string {
  return BOM + rows.map(row => row.map(cell).join(";")).join("\r\n")
}

/** Hands the file to the browser. Returns the object URL it created so a
 *  caller — or a test — can see what was produced. */
export function downloadCsv(filename: string, content: string): string {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  document.body.append(link)
  link.click()
  link.remove()
  // Revoked on the next tick: Safari needs the URL alive through the click.
  setTimeout(() => URL.revokeObjectURL(url), 0)
  return url
}
